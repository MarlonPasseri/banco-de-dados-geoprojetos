import XLSX from "xlsx";

function textOrDash(v: any): string {
  const s = v == null ? "" : String(v).trim();
  return s ? s : "-";
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIntOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNumOrNull(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  let s = String(v).trim();
  if (!s) return null;

  // aceita negativos como (1.234,56)
  const isNeg = /^\(.*\)$/.test(s);
  if (isNeg) s = s.slice(1, -1);

  // remove moeda e símbolos (mantém dígitos , . -)
  s = s.replace(/[^\d,.\-]/g, "");

  // BR: 1.234,56
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return isNeg ? -n : n;
}

// -----------------------------
// CONTRATOS (schema fixo)
// -----------------------------
export function parseContratosSheet(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });

  // tenta CONTRATOS primeiro; se não existir, tenta CONTATOS (pra facilitar)
  const ws = wb.Sheets["CONTRATOS"] || wb.Sheets["CONTATOS"];
  if (!ws) throw new Error('Aba "CONTRATOS" (ou "CONTATOS") não encontrada.');

  const rows = XLSX.utils.sheet_to_json<any>(ws, {
    range: 3,
    defval: null, // vazio vira null
    blankrows: false,
  });

  // só mantém linhas que tenham N.º
  const clean = rows.filter((r) => r && (r["N.º"] != null || r["Nº"] != null || r["N°"] != null));

  return clean
    .map((r) => {
      const rawNumero = r["N.º"] ?? r["Nº"] ?? r["N°"];
      const numero = toIntOrNull(rawNumero);
      if (!numero) return null;

      return {
        numero,
        ordemDataEntrega: toIntOrNull(r["ORDEM DE DATA DE ENTREGA"]),
        followUp: textOrDash(r["Follow Up"]),
        grupo: textOrDash(r["GRUPO"]),
        convite: toDateOrNull(r["CONVITE"]),
        ano: toIntOrNull(r["ANO"]),
        entrega: toDateOrNull(r["ENTREGA"]),
        ultimoContato: toDateOrNull(r["ULTIMO CONTATO"]),
        nomeProjetoLocal: textOrDash(r["NOME DO PROJETO E LOCAL"]),
        cliente: textOrDash(r["CLIENTE"]),
        tipoServico: textOrDash(r["TIPO DE SERVIÇO"]),
        resp: textOrDash(r["RESP"]),
        status: textOrDash(r["STATUS"]),
        contatos: textOrDash(r["CONTATOS"]), // se existir
        valor: toNumOrNull(r["VALOR"]),
        prazoMes: toIntOrNull(r["PRAZO (MÊS)"]),
        go: textOrDash(r["GO"]),
        observacoes: textOrDash(r["OSERVAÇÕES"]), // se existir
        certidao: textOrDash(r["CERTIDÃO"]), // se existir
        mediaMensal: toNumOrNull(r["MEDIA MENSAL"]), // se existir
        total: toNumOrNull(r["TOTAL"]), // se existir
        _parcelas: [], // compatibilidade
      };
    })
    .filter(Boolean) as any[];
}

// -----------------------------
// GRID (schema dinâmico: colunas/linhas editáveis)
// -----------------------------
function dash(v: any) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string" && v.trim() === "") return "-";
  return v;
}

function slugKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function parseSheetToGrid(buffer: Buffer, sheetName: string) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba "${sheetName}" não encontrada.`);

  // matriz: [ [header1, header2...], [row1...], ... ]
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "-",
    blankrows: false,
  });

  // encontra header (primeira linha com >=2 células não vazias)
  const headerIndex = matrix.findIndex(
    (r) => (r ?? []).filter((c) => String(c ?? "").trim() !== "").length >= 2
  );

  if (headerIndex < 0) return { columns: [], rows: [] };

  const headerRaw = matrix[headerIndex] ?? [];
  const columns = headerRaw.map((h: any, idx: number) => {
    const label = String(h ?? "").trim() || `COL_${idx + 1}`;
    const key = slugKey(label) || `col_${idx + 1}`;
    return { key, label };
  });

  const dataRows = matrix.slice(headerIndex + 1);

  const rows = dataRows
    .map((r, rowIdx) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i].key] = dash(r?.[i]);
      }

      // descarta linha totalmente vazia ("-")
      const ok = Object.values(obj).some((v) => v !== "-");
      if (!ok) return null;

      return { rowNumber: headerIndex + 2 + rowIdx, data: obj };
    })
    .filter(Boolean) as Array<{ rowNumber: number; data: Record<string, any> }>;

  return { columns, rows };
}
