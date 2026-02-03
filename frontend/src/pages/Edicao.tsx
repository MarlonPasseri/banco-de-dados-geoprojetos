import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fetchGrid, searchGrid, updateCell, type GridColumn, type GridRow } from "../api";
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

function isDateLabel(label: string) {
  const s = norm(label);
  return s.includes("data") || s.includes("entrega") || s.includes("convite") || s.includes("contato");
}

function isMoneyLabel(label: string) {
  const s = norm(label);
  return s.includes("valor") || s.includes("total") || s.includes("media mensal");
}

function formatDateValue(v: any) {
  if (v == null || v === "" || v === "-") return "-";

  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;

  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const ms = (n - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    }
  }

  return String(v);
}

function formatMoneyValue(v: any) {
  if (v == null || v === "" || v === "-") return "-";
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  }
  let s = String(v).trim();
  if (!s) return "-";

  const isNeg = /^\(.*\)$/.test(s);
  if (isNeg) s = s.slice(1, -1);

  s = s.replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return String(v);
  const value = isNeg ? -n : n;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Edicao() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };
  const sheet = "CONTRATOS";

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [keyNumero, setKeyNumero] = useState<string | null>(null);

  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentRow, setCurrentRow] = useState<GridRow | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const lastEditKeyRef = useRef<string | null>(null);
  const lastEditValueRef = useRef<string>("");

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

        const key =
          byLabel.get(norm("N.º")) ||
          byLabel.get(norm("Nº")) ||
          byLabel.get(norm("N°")) ||
          byLabel.get(norm("N")) ||
          null;

        setKeyNumero(key);
      } catch (e: any) {
        toastError("Erro", e?.message || "Falha ao carregar colunas");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearForm() {
    setNumero("");
    setCurrentRow(null);
    setFormData({});
    setEditingKey(null);
    setEditValue("");
    lastEditKeyRef.current = null;
    lastEditValueRef.current = "";
  }

  async function onBuscar() {
    if (!canSearch) return;
    if (!keyNumero) return toastError("Configuração", 'Não encontrei a coluna "N.º". Importe a planilha primeiro.');

    setLoading(true);
    try {
      const r = await searchGrid(String(numero).trim(), sheet, 1, 50);
      const exact = (r.items || []).find(
        (it) => String(it.data?.[keyNumero!]).trim() === String(numero).trim()
      );
      const row = exact || (r.items || [])[0];

      if (!row) {
        toastError("Não encontrado", `Nenhum registro com N.º = ${numero}`);
        setCurrentRow(null);
        setFormData({});
        return;
      }

      setCurrentRow(row);
      setFormData({ ...(row.data || {}) });
      setEditingKey(null);
      setEditValue("");
      lastEditKeyRef.current = null;
      lastEditValueRef.current = "";
      toastOk("Encontrado", "Registro carregado para edição.");
    } catch (e: any) {
      toastError("Erro", e?.message || "Falha ao buscar");
    } finally {
      setLoading(false);
    }
  }

  async function onSalvar() {
    if (!currentRow) return toastError("Edição", "Busque um registro primeiro.");

    setLoading(true);
    try {
      const mergedData = { ...formData };

      // garante que o último valor digitado entra no payload mesmo sem blur
      if (lastEditKeyRef.current) {
        mergedData[lastEditKeyRef.current] = lastEditValueRef.current;
      } else if (editingKey) {
        mergedData[editingKey] = editValue;
      }

      setEditingKey(null);
      setEditValue("");
      setFormData(mergedData);
      lastEditKeyRef.current = null;
      lastEditValueRef.current = "";

      for (const c of columns) {
        const value = toDash(mergedData[c.key]);
        await updateCell(currentRow.id, c.key, value);
      }
      // recarrega do banco para refletir exatamente o que foi salvo
      if (keyNumero && String(numero).trim()) {
        const r = await searchGrid(String(numero).trim(), sheet, 1, 50);
        const exact = (r.items || []).find(
          (it) => String(it.data?.[keyNumero!]).trim() === String(numero).trim()
        );
        const row = exact || (r.items || [])[0] || null;
        if (row) {
          setCurrentRow(row);
          setFormData({ ...(row.data || {}) });
        }
      }
      toastOk("Salvo", "Alterações salvas com sucesso.");
    } catch (e: any) {
      toastError("Erro ao salvar", e?.message || "Falha ao salvar");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(key: string, current: any) {
    setEditingKey(key);
    setEditValue(String(current ?? ""));
    lastEditKeyRef.current = key;
    lastEditValueRef.current = String(current ?? "");
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue("");
    lastEditKeyRef.current = null;
    lastEditValueRef.current = "";
  }

  function commitEdit() {
    if (!editingKey) return;
    const value = editValue;
    setFormData((prev) => ({ ...prev, [editingKey]: value }));
    setEditingKey(null);
    setEditValue("");
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div
        className="card p-5"
        variants={item}
      >
        <div className="text-xs uppercase tracking-wide text-zinc-500">Atualização</div>
        <h1 className="text-2xl font-semibold">Edição</h1>
        <p className="text-sm text-zinc-500">
          Pesquise pelo N.º e edite todas as informações do registro.
        </p>
      </motion.div>

      {!keyNumero && (
        <motion.div className="card p-4 text-sm" variants={item}>
          <p className="font-semibold text-amber-700">Atenção</p>
          <p className="text-zinc-600">
            Não encontrei a coluna <b>N.º</b>. Importe a planilha novamente pelo Dashboard.
          </p>
        </motion.div>
      )}

      <motion.div
        className="card p-4 space-y-4 bg-white/80"
        variants={item}
      >
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">N.º (GP)</label>
            <input
              className="input w-64"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 2949"
            />
          </div>

          <div className="flex gap-2">
            <button className="btn" disabled={!canSearch || loading} onClick={onBuscar}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button className="btn" disabled={loading} onClick={clearForm}>
              Limpar
            </button>
            <button className="btn btn-primary" disabled={loading || !currentRow} onClick={onSalvar}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>

        {!currentRow ? (
          <div className="text-sm text-zinc-500">Nenhum registro carregado.</div>
        ) : (
          <div className="border rounded-2xl overflow-hidden">
            <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
              <table className="min-w-[1400px] w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className="text-left py-2 px-3 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    {columns.map((c) => {
                      const isEditing = editingKey === c.key;
                      const cellValue = formData[c.key];
                      const displayValue = isDateLabel(c.label)
                        ? formatDateValue(cellValue)
                        : isMoneyLabel(c.label)
                        ? formatMoneyValue(cellValue)
                        : String(cellValue ?? "-");
                      return (
                        <td
                          key={c.key}
                          className="py-2 px-3 whitespace-nowrap"
                          onDoubleClick={() => startEdit(c.key, cellValue)}
                          title="Duplo clique para editar"
                          style={{ cursor: "cell" }}
                        >
                          {isEditing ? (
                            <input
                              className="border rounded px-2 py-1 w-full min-w-[140px]"
                              value={editValue}
                              onChange={(e) => {
                                setEditValue(e.target.value);
                                lastEditValueRef.current = e.target.value;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onBlur={commitEdit}
                              autoFocus
                            />
                          ) : (
                            <span>{displayValue}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
