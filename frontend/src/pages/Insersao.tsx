import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createRow, deleteRow, fetchGrid, searchGrid, updateCell, type GridColumn, type GridRow } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { safeUUID } from "../utils/uuid";

function norm(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toDash(v: any) {
  const s = v == null ? "" : String(v).trim();
  return s ? s : "-";
}

// Aceita dd/mm/yyyy, yyyy-mm-dd ou vazio
function normalizeDateInput(v: string) {
  const s = v.trim();
  if (!s) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

// Converte "R$ 1.234,56" -> 1234.56 (number)
// Se inválido ou vazio -> "-"
function normalizeMoneyInput(v: string) {
  let s = String(v ?? "").trim();
  if (!s) return "-";

  // aceita negativo no formato (1.234,56)
  const isNeg = /^\(.*\)$/.test(s);
  if (isNeg) s = s.slice(1, -1);

  // remove moeda/símbolos e mantém dígitos , . -
  s = s.replace(/[^\d,.\-]/g, "");

  // BR: 1.234,56 -> 1234.56
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return "-";
  return isNeg ? -n : n;
}

type KeyMap = {
  cliente?: string;
  numero?: string; // N.º
  grupo?: string;
  convite?: string;
  ano?: string;
  entrega?: string;
  ultimoContato?: string;
  valor?: string;
  status?: string;
};

export default function Insersao() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const sheet = "CONTRATOS";

  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [keyMap, setKeyMap] = useState<KeyMap>({});

  const [cliente, setCliente] = useState("");
  const [numero, setNumero] = useState("");
  const [grupo, setGrupo] = useState("");
  const [convite, setConvite] = useState("");
  const [ano, setAno] = useState("");
  const [entrega, setEntrega] = useState("");
  const [ultimoContato, setUltimoContato] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState("");

  const [currentRow, setCurrentRow] = useState<GridRow | null>(null);
  const [loading, setLoading] = useState(false);

  const canSearch = useMemo(() => String(numero).trim().length > 0, [numero]);

  function toastError(title: string, text: string) {
    setToast({ id: safeUUID(), type: "error", title, text });
  }
  function toastOk(title: string, text: string) {
    setToast({ id: safeUUID(), type: "success", title, text });
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchGrid({ sheet, page: 1, pageSize: 1 });
        const cols = (r.columns || []).filter((c) => !c.hidden);
        setColumns(cols);

        const byLabel = new Map<string, string>();
        for (const c of cols) byLabel.set(norm(c.label), c.key);

        const map: KeyMap = {
          cliente: byLabel.get(norm("CLIENTE")),
          numero:
            byLabel.get(norm("N.º")) ||
            byLabel.get(norm("Nº")) ||
            byLabel.get(norm("N°")) ||
            byLabel.get(norm("N")),
          grupo: byLabel.get(norm("GRUPO")),
          convite: byLabel.get(norm("CONVITE")),
          ano: byLabel.get(norm("ANO")),
          entrega: byLabel.get(norm("ENTREGA")),
          ultimoContato: byLabel.get(norm("ULTIMO CONTATO")) || byLabel.get(norm("ÚLTIMO CONTATO")),
          valor: byLabel.get(norm("VALOR")),
          status: byLabel.get(norm("STATUS")),
        };

        setKeyMap(map);
      } catch (e: any) {
        toastError("Erro", e?.message || "Falha ao carregar colunas");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearForm() {
    setCliente("");
    setNumero("");
    setGrupo("");
    setConvite("");
    setAno("");
    setEntrega("");
    setUltimoContato("");
    setValor("");
    setStatus("");
    setCurrentRow(null);
  }

  function fillFromRow(row: GridRow) {
    const d = row.data || {};
    setCliente(String(d[keyMap.cliente || ""] ?? "").trim());
    setNumero(String(d[keyMap.numero || ""] ?? "").trim());
    setGrupo(String(d[keyMap.grupo || ""] ?? "").trim());
    setConvite(String(d[keyMap.convite || ""] ?? "").trim());
    setAno(String(d[keyMap.ano || ""] ?? "").trim());
    setEntrega(String(d[keyMap.entrega || ""] ?? "").trim());
    setUltimoContato(String(d[keyMap.ultimoContato || ""] ?? "").trim());
    setValor(String(d[keyMap.valor || ""] ?? "").trim());
    setStatus(String(d[keyMap.status || ""] ?? "").trim());
  }

  function buildDataPayload() {
    const data: Record<string, any> = {};

    if (keyMap.cliente) data[keyMap.cliente] = toDash(cliente);
    if (keyMap.numero) data[keyMap.numero] = toDash(numero);
    if (keyMap.grupo) data[keyMap.grupo] = toDash(grupo);

    if (keyMap.convite) data[keyMap.convite] = normalizeDateInput(convite);
    if (keyMap.ano) data[keyMap.ano] = toDash(ano);
    if (keyMap.entrega) data[keyMap.entrega] = normalizeDateInput(entrega);
    if (keyMap.ultimoContato) data[keyMap.ultimoContato] = normalizeDateInput(ultimoContato);

    if (keyMap.valor) data[keyMap.valor] = normalizeMoneyInput(valor);
    if (keyMap.status) data[keyMap.status] = toDash(status);

    return data;
  }

  async function onBuscar() {
    if (!canSearch) return;
    if (!keyMap.numero) return toastError("Configuração", 'Não encontrei a coluna "N.º" no GridColumn. Importe a planilha primeiro.');

    setLoading(true);
    try {
      const r = await searchGrid(String(numero).trim(), sheet, 1, 30);
      const exact = (r.items || []).find((it) => String(it.data?.[keyMap.numero!]).trim() === String(numero).trim());
      const row = exact || (r.items || [])[0];

      if (!row) {
        toastError("Não encontrado", `Nenhum registro com N.º = ${numero}`);
        setCurrentRow(null);
        return;
      }

      setCurrentRow(row);
      fillFromRow(row);
      toastOk("Encontrado", "Registro carregado para edição.");
    } catch (e: any) {
      toastError("Erro", e?.message || "Falha ao buscar");
    } finally {
      setLoading(false);
    }
  }

  async function onInserir() {
    if (!keyMap.numero) return toastError("Configuração", 'Não encontrei a coluna "N.º" no GridColumn. Importe a planilha primeiro.');
    if (!String(numero).trim()) return toastError("Validação", "Informe o N.º (GP).");

    setLoading(true);
    try {
      const data = buildDataPayload();
      await createRow(sheet, data);
      toastOk("Inserido", "Registro criado com sucesso.");
      clearForm();
    } catch (e: any) {
      toastError("Erro ao inserir", e?.message || "Falha ao criar");
    } finally {
      setLoading(false);
    }
  }

  async function onSalvarEdicao() {
    if (!currentRow) return toastError("Edição", "Busque um registro primeiro (pelo N.º) para editar.");

    setLoading(true);
    try {
      const payload = buildDataPayload();
      await Promise.all(Object.entries(payload).map(([k, v]) => updateCell(currentRow.id, k, v)));
      toastOk("Salvo", "Alterações salvas com sucesso.");
    } catch (e: any) {
      toastError("Erro ao salvar", e?.message || "Falha ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function onExcluir() {
    if (!currentRow) return toastError("Excluir", "Busque um registro primeiro (pelo N.º) para excluir.");
    const ok = confirm(`Excluir o registro N.º ${numero}?`);
    if (!ok) return;

    setLoading(true);
    try {
      await deleteRow(currentRow.id);
      toastOk("Excluído", "Registro removido.");
      clearForm();
    } catch (e: any) {
      toastError("Erro ao excluir", e?.message || "Falha ao excluir");
    } finally {
      setLoading(false);
    }
  }

  const missingCols = useMemo(() => {
    const req: Array<[keyof KeyMap, string]> = [
      ["cliente", "CLIENTE"],
      ["numero", "N.º"],
      ["grupo", "GRUPO"],
      ["convite", "CONVITE"],
      ["ano", "ANO"],
      ["entrega", "ENTREGA"],
      ["ultimoContato", "ULTIMO CONTATO"],
      ["valor", "VALOR"],
      ["status", "STATUS"],
    ];
    return req.filter(([k]) => !keyMap[k]).map(([, label]) => label);
  }, [keyMap]);

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div
        className="card p-5"
        variants={item}
      >
        <div className="text-xs uppercase tracking-wide text-zinc-500">Cadastros</div>
        <h1 className="text-2xl font-semibold">Inserção</h1>
        <p className="text-sm text-zinc-500">Insira, edite ou exclua registros no Grid ({sheet}).</p>
      </motion.div>

      {missingCols.length > 0 && (
        <motion.div className="card p-4 text-sm" variants={item}>
          <p className="font-semibold text-amber-700">Atenção</p>
          <p className="text-zinc-600">
            Não encontrei estas colunas no GridColumn: <b>{missingCols.join(", ")}</b>.
          </p>
          <p className="text-zinc-600">Importe a planilha novamente pelo Dashboard para criar as colunas.</p>
        </motion.div>
      )}

      <motion.div
        className="card p-4 space-y-4 bg-white/80"
        variants={item}
      >
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">N.º (GP)</label>
            <input className="input w-64" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 2949" />
            <p className="text-xs text-zinc-500">Use para buscar e editar.</p>
          </div>

          <div className="flex gap-2">
            <button className="btn" disabled={!canSearch || loading} onClick={onBuscar}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button className="btn" disabled={loading} onClick={clearForm}>
              Limpar
            </button>
          </div>

          <div className="ml-auto text-sm text-zinc-600">
            {currentRow ? <span className="badge">Modo edição</span> : <span className="badge">Modo inserção</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Cliente</label>
            <input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Grupo (GP)</label>
            <input className="input" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Status</label>
            <input className="input" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Ex: OK, Pendente, Em andamento..." />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Valor</label>
            <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: R$ 1.234,56" />
            <p className="text-xs text-zinc-500">Aceita 1.234,56 / 1234.56 / R$...</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Ano</label>
            <input className="input" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="Ex: 2025" />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Convite</label>
            <input className="input" value={convite} onChange={(e) => setConvite(e.target.value)} placeholder="dd/mm/aaaa ou aaaa-mm-dd" />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Entrega</label>
            <input className="input" value={entrega} onChange={(e) => setEntrega(e.target.value)} placeholder="dd/mm/aaaa ou aaaa-mm-dd" />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Último Contato</label>
            <input className="input" value={ultimoContato} onChange={(e) => setUltimoContato(e.target.value)} placeholder="dd/mm/aaaa ou aaaa-mm-dd" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {!currentRow ? (
            <button className="btn btn-primary" disabled={loading} onClick={onInserir}>
              {loading ? "Salvando..." : "Inserir"}
            </button>
          ) : (
            <>
              <button className="btn btn-primary" disabled={loading} onClick={onSalvarEdicao}>
                {loading ? "Salvando..." : "Salvar edição"}
              </button>
              <button className="btn btn-danger" disabled={loading} onClick={onExcluir}>
                Excluir
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
