import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  createColumn,
  createRow,
  deleteColumn,
  deleteRow,
  fetchGrid,
  importGrid,
  updateCell,
  type GridColumn,
  type GridRow,
} from "../api";

function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function normLabel(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findDateKey(cols: GridColumn[]) {
  const byLabel = new Map<string, string>();
  for (const c of cols) byLabel.set(normLabel(c.label), c.key);

  const key = byLabel.get("ano");
  return key || null;
}

function isDateLabel(label: string) {
  const s = normLabel(label);
  return s.includes("data") || s.includes("entrega") || s.includes("convite") || s.includes("contato");
}

function isMoneyLabel(label: string) {
  const s = normLabel(label);
  return s.includes("valor") || s.includes("total") || s.includes("media mensal");
}

function formatDateValue(v: any) {
  if (v == null || v === "" || v === "-") return "-";

  // ISO yyyy-mm-dd
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  // dd/mm/yyyy already
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;

  // Excel serial date (e.g. 45123)
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

type Editing = { rowId: string; key: string; initial: string };

export default function Dashboard() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [pageInput, setPageInput] = useState("1");

  // ✅ o grid é por aba (sheet)
  const [sheet, setSheet] = useState("CONTRATOS");
  const [sortByDate, setSortByDate] = useState(true);
  const [dateKey, setDateKey] = useState<string | null>(null);

  // edição inline
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // importar
  const [file, setFile] = useState<File | null>(null);

  async function reload() {
    setLoading(true);
    try {
      // ✅ BUSCA SEMPRE NO SHEET SELECIONADO
      const useDateSort = sortByDate && sheet.toUpperCase() === "CONTRATOS" && !!dateKey;
      const data = await fetchGrid({
        sheet,
        page,
        pageSize,
        sortKey: useDateSort ? dateKey || undefined : undefined,
        sortDir: useDateSort ? "desc" : undefined,
      });

      const nextDateKey = findDateKey(data.columns || []);
      if (nextDateKey !== dateKey) setDateKey(nextDateKey);

      setColumns(data.columns.filter((c) => !c.hidden).sort((a, b) => a.order - b.order));
      setRows(data.rows);
      setTotal(data.total);
    } catch (e: any) {
      alert(`Erro ao carregar: ${e?.message || e}`);
      setColumns([]);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // ✅ recarrega quando page OU sheet mudar
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sheet, sortByDate]);

  // ✅ quando trocar o sheet, volta pra página 1
  useEffect(() => {
    setPage(1);
    setDateKey(null);
  }, [sheet]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const colKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const dateLabel = useMemo(
    () => (dateKey ? columns.find((c) => c.key === dateKey)?.label : "") || "",
    [columns, dateKey]
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (sortByDate && sheet.toUpperCase() === "CONTRATOS" && dateKey) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortByDate, dateKey, sheet]);

  function startEdit(rowId: string, key: string, current: any) {
    setEditing({ rowId, key, initial: fmt(current) });
    setEditValue(fmt(current));
  }

  function cancelEdit() {
    setEditing(null);
    setEditValue("");
  }

  async function commitEdit() {
    if (!editing) return;
    const { rowId, key } = editing;

    const newValue = editValue.trim() === "" ? "-" : editValue;

    // otimista
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, data: { ...r.data, [key]: newValue } } : r))
    );
    setEditing(null);

    try {
      await updateCell(rowId, key, newValue);
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`);
      reload();
    }
  }

  async function onCreateColumn() {
    const label = prompt("Nome da coluna:");
    if (!label) return;

    try {
      await createColumn(label, "text");
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function onDeleteColumn(key: string) {
    const ok = confirm(`Excluir coluna "${key}"? Isso remove a coluna de TODAS as linhas.`);
    if (!ok) return;

    try {
      await deleteColumn(key);
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function onCreateRow() {
    const data: Record<string, any> = {};
    for (const k of colKeys) data[k] = "-";

    try {
      // ✅ CRIA LINHA NO SHEET ATUAL
      await createRow(sheet, data);
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function onDeleteRow(id: string) {
    const ok = confirm("Excluir esta linha?");
    if (!ok) return;

    try {
      await deleteRow(id);
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function onImportGrid() {
    if (!file) return alert("Selecione um arquivo .xlsx");
    try {
      // ✅ importa pro sheet atual
      await importGrid(file, sheet, "merge");
      setPage(1);
      await reload();
      alert("Importado com sucesso!");
    } catch (e: any) {
      alert(e.message);
    }
  }

  function applyPageInput() {
    const raw = Number(pageInput);
    if (!Number.isFinite(raw)) {
      setPageInput(String(page));
      return;
    }
    const n = Math.max(1, Math.min(Math.floor(raw), totalPages));
    setPage(n);
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div
        className="card p-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        variants={item}
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Painel</div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Controle suas planilhas e visualize tudo com rapidez.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge">Aba: {sheet}</span>
          <span className="badge">Linhas: {total}</span>
          <button className="btn" onClick={onCreateColumn}>
            + Coluna
          </button>
          <button className="btn" onClick={onCreateRow}>
            + Linha
          </button>
        </div>
      </motion.div>

      <header className="flex flex-col gap-3">
        <motion.div className="border rounded-2xl p-3 bg-white/80" variants={item}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Aba:</span>
              <input
                className="border rounded-lg px-3 py-2 w-48"
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
                placeholder="CONTRATOS"
              />
            </div>

            <label className="text-sm text-gray-700 flex items-center gap-2 border rounded-lg px-3 py-2 bg-white shadow-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900"
                checked={sortByDate}
                onChange={(e) => setSortByDate(e.target.checked)}
              />
              Mais recentes por ano
            </label>
            {sortByDate && sheet.toUpperCase() === "CONTRATOS" && (
              <span className="text-xs text-gray-500">
                {dateKey ? `Campo: ${dateLabel || dateKey}` : "Nenhuma coluna de data encontrada"}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-600">Importar:</span>
              <label className="text-sm text-gray-700 flex items-center gap-2 border rounded-lg px-3 py-2 bg-white shadow-sm cursor-pointer">
                <span>{file ? file.name : "Escolher arquivo (.xlsx)"}</span>
                <input
                  className="hidden"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button className="btn btn-primary" onClick={onImportGrid}>
                Importar
              </button>
              <button className="btn" onClick={reload}>
                Recarregar
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="btn disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {page} / {totalPages}
            </span>
            <input
              className="border rounded-lg px-2 py-1 w-20"
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPageInput();
              }}
            />
            <button className="btn" onClick={applyPageInput}>
              Ir
            </button>
            <button
              className="btn disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </motion.div>
      </header>

      <motion.section className="border rounded-2xl overflow-hidden" variants={item}>
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="sticky top-0 bg-white z-10 border-b">
              <tr>
                <th className="text-left py-2 px-3 w-[90px] whitespace-nowrap">Ações</th>
                {columns.map((c) => (
                  <th key={c.key} className="text-left py-2 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span title={c.key} className="font-semibold">
                        {c.label}
                      </span>
                      <button
                        className="text-xs border rounded px-2 py-1"
                        onClick={() => onDeleteColumn(c.key)}
                        title="Excluir coluna"
                      >
                        Excluir
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="py-6 px-3" colSpan={columns.length + 1}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="py-6 px-3" colSpan={columns.length + 1}>
                    Nenhuma linha para o sheet <b>{sheet}</b>.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <button className="text-xs border rounded px-2 py-1" onClick={() => onDeleteRow(r.id)}>
                        Excluir
                      </button>
                    </td>

                    {columns.map((c) => {
                      const isEditing = editing?.rowId === r.id && editing?.key === c.key;
                      const cellValue = (r.data || {})[c.key];
                      const displayValue = isDateLabel(c.label)
                        ? formatDateValue(cellValue)
                        : isMoneyLabel(c.label)
                        ? formatMoneyValue(cellValue)
                        : fmt(cellValue);

                      return (
                        <td
                          key={c.key}
                          className="py-2 px-3 whitespace-nowrap"
                          onDoubleClick={() => startEdit(r.id, c.key, cellValue)}
                          title="Duplo clique para editar"
                          style={{ cursor: "cell" }}
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              className="border rounded px-2 py-1 w-full min-w-[140px]"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onBlur={commitEdit}
                            />
                          ) : (
                            <span>{displayValue}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 text-xs text-gray-500 border-t">
          Dica: Duplo clique em qualquer célula para editar. Enter salva, Esc cancela.
        </div>
      </motion.section>
    </motion.div>
  );
}
