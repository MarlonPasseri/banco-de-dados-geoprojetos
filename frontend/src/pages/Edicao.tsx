import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FilePenLine } from "lucide-react";
import { useLocation } from "react-router-dom";
import { fetchGrid, searchGrid, updateCell, type GridColumn, type GridRow } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { EmptyState } from "../components/UiStates";
import { safeUUID } from "../utils/uuid";

function norm(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeLoose(s: string) {
  return norm(s).replace(/[^a-z0-9]/g, "");
}

function toDash(v: any) {
  const s = v == null ? "" : String(v).trim();
  return s ? s : "-";
}

function editableValue(v: any) {
  const s = v == null ? "" : String(v).trim();
  return s === "-" ? "" : s;
}

function findNumeroKey(columns: GridColumn[]) {
  const aliases = new Set(["n", "numero"]);

  for (const col of columns) {
    if (aliases.has(normalizeLoose(col.label))) return col.key;
  }

  for (const col of columns) {
    if (aliases.has(normalizeLoose(col.key))) return col.key;
  }

  return null;
}

function isDateField(label: string) {
  const s = norm(label);
  return s.includes("data") || s.includes("entrega") || s.includes("convite") || s.includes("ultimo contato");
}

function isMoneyField(label: string) {
  const s = norm(label);
  return s.includes("valor") || s.includes("total") || s.includes("media mensal");
}

function isLongTextField(label: string) {
  const s = norm(label);
  return s.includes("observ") || s.includes("descricao") || s.includes("nome do projeto");
}

function getPlaceholder(label: string) {
  if (isDateField(label)) return "dd/mm/aaaa ou aaaa-mm-dd";
  if (isMoneyField(label)) return "Ex: R$ 1.234,56";

  const s = norm(label);
  if (s.includes("contato")) return "Ex: nome, telefone ou e-mail";
  return "";
}

type EdicaoLocationState = {
  row?: GridRow;
  sheet?: string;
  numero?: string;
};

export default function Edicao() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const location = useLocation();
  const routeState = (location.state || {}) as EdicaoLocationState;
  const [sheet, setSheet] = useState(routeState.sheet || "CONTRATOS");

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [keyNumero, setKeyNumero] = useState<string | null>(null);

  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentRow, setCurrentRow] = useState<GridRow | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const prefillAppliedRef = useRef(false);

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
        setKeyNumero(findNumeroKey(cols));
      } catch (e: any) {
        toastError("Erro", e?.message || "Falha ao carregar colunas");
      }
    })();
  }, [sheet]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (!routeState.row) return;

    if (routeState.sheet) setSheet(routeState.sheet);
    setCurrentRow(routeState.row);
    setFormData({ ...(routeState.row.data || {}) });
    setNumero(routeState.numero || "");
    prefillAppliedRef.current = true;
  }, [routeState.numero, routeState.row, routeState.sheet]);

  function clearForm() {
    setNumero("");
    setCurrentRow(null);
    setFormData({});
  }

  function loadRow(row: GridRow, numeroValue?: string) {
    setCurrentRow(row);
    setFormData({ ...(row.data || {}) });

    if (numeroValue != null) {
      setNumero(numeroValue);
      return;
    }

    if (keyNumero) {
      setNumero(String(row.data?.[keyNumero] ?? "").trim());
    }
  }

  async function onBuscar() {
    if (!canSearch) return;
    if (!keyNumero) return toastError("Configuracao", 'Nao encontrei a coluna "Numero". Importe a planilha primeiro.');

    setLoading(true);
    try {
      const numeroBusca = String(numero).trim();
      const r = await searchGrid(numeroBusca, sheet, 1, 50);
      const exact = (r.items || []).find((it) => String(it.data?.[keyNumero]).trim() === numeroBusca);
      const row = exact || (r.items || [])[0];

      if (!row) {
        toastError("Nao encontrado", `Nenhum registro com Numero = ${numero}`);
        setCurrentRow(null);
        setFormData({});
        return;
      }

      loadRow(row, numeroBusca);
      toastOk("Encontrado", "Registro carregado para edicao.");
    } catch (e: any) {
      toastError("Erro", e?.message || "Falha ao buscar");
    } finally {
      setLoading(false);
    }
  }

  async function onSalvar() {
    if (!currentRow) return toastError("Edicao", "Busque um registro primeiro.");

    setLoading(true);
    try {
      const mergedData = { ...formData };

      for (const c of columns) {
        const value = toDash(mergedData[c.key]);
        await updateCell(currentRow.id, c.key, value);
      }

      const numeroAtualizado = keyNumero ? editableValue(mergedData[keyNumero]) : String(numero).trim();
      if (numeroAtualizado) {
        setNumero(numeroAtualizado);
        const r = await searchGrid(numeroAtualizado, sheet, 1, 50);
        const exact = keyNumero
          ? (r.items || []).find((it) => String(it.data?.[keyNumero] ?? "").trim() === numeroAtualizado)
          : null;
        const row = exact || (r.items || [])[0] || null;
        if (row) {
          loadRow(row, numeroAtualizado);
        }
      }

      toastOk("Salvo", "Alteracoes salvas com sucesso.");
    } catch (e: any) {
      toastError("Erro ao salvar", e?.message || "Falha ao salvar");
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (keyNumero && key === keyNumero) setNumero(value);
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div className="page-hero" variants={item}>
        <div>
          <div className="page-kicker">Atualizacao</div>
          <h1 className="page-title inline-flex items-center gap-2">
            <FilePenLine size={22} />
            Edicao
          </h1>
          <p className="page-desc">Pesquise pelo Numero e edite as informacoes do registro em campos individuais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge">Aba: {sheet}</span>
          <span className="badge">{currentRow ? "Registro carregado" : "Aguardando busca"}</span>
        </div>
      </motion.div>

      {!keyNumero && (
        <motion.div className="panel-soft text-sm" variants={item}>
          <p className="font-semibold text-amber-700">Atencao</p>
          <p className="text-zinc-600">Nao encontrei a coluna <b>Numero</b>. Importe a planilha novamente pelo Dashboard.</p>
        </motion.div>
      )}

      <motion.div className="panel-soft space-y-4" variants={item}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Numero (GP)</label>
            <input className="input w-64" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 2949" />
          </div>

          <div className="flex gap-2">
            <button className="btn" disabled={!canSearch || loading} onClick={onBuscar}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button className="btn" disabled={loading} onClick={clearForm}>
              Limpar
            </button>
            <button className="btn btn-primary" disabled={loading || !currentRow} onClick={onSalvar}>
              {loading ? "Salvando..." : "Salvar alteracoes"}
            </button>
          </div>
        </div>

        {!currentRow ? (
          <EmptyState
            title="Nenhum registro carregado"
            text="Informe o Numero (GP) e clique em Buscar para editar os dados."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {columns.map((c) => {
                const multiline = isLongTextField(c.label);
                const value = editableValue(formData[c.key]);

                return (
                  <div key={c.key} className={multiline ? "space-y-1 md:col-span-2 xl:col-span-3" : "space-y-1"}>
                    <label className="text-sm text-zinc-600">{c.label}</label>
                    {multiline ? (
                      <textarea
                        className="input min-h-28 resize-y"
                        value={value}
                        onChange={(e) => updateField(c.key, e.target.value)}
                        placeholder={getPlaceholder(c.label)}
                      />
                    ) : (
                      <input
                        className="input"
                        value={value}
                        onChange={(e) => updateField(c.key, e.target.value)}
                        placeholder={getPlaceholder(c.label)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn btn-primary" disabled={loading} onClick={onSalvar}>
                {loading ? "Salvando..." : "Salvar alteracoes"}
              </button>
              <button className="btn" disabled={loading} onClick={clearForm}>
                Limpar
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
