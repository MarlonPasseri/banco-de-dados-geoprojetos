import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  Filter,
  Hash,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
  Rows3,
  Search,
  SlidersHorizontal,
  UploadCloud,
} from "lucide-react";
import { EmptyState, TableSkeletonRows } from "../components/UiStates";
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

function findKeyByAlias(columns: GridColumn[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((alias) => normLabel(alias)));

  for (const col of columns) {
    if (aliasSet.has(normLabel(col.label))) return col.key;
  }
  for (const col of columns) {
    if (aliasSet.has(normLabel(col.key))) return col.key;
  }

  return null;
}

function rawValueText(v: unknown) {
  const text = String(v ?? "").trim();
  if (!text || text === "-") return "";
  return text;
}

function extractYear(v: unknown) {
  if (v === null || v === undefined || v === "" || v === "-") return null;

  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    if (n >= 1900 && n <= 2200) return n;
    if (n > 20000 && n < 80000) {
      const dt = new Date((n - 25569) * 86400 * 1000);
      return Number.isNaN(dt.getTime()) ? null : dt.getUTCFullYear();
    }
    return null;
  }

  const text = String(v).trim();
  if (!text) return null;

  if (/^\d{4}$/.test(text)) {
    const y = Number(text);
    return y >= 1900 && y <= 2200 ? y : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Number(text.slice(0, 4));
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return Number(text.slice(6, 10));

  const normalized = text.replace(/[^\d,.\-]/g, "").replace(",", ".");
  const n = Number(normalized);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const dt = new Date((Math.trunc(n) - 25569) * 86400 * 1000);
    return Number.isNaN(dt.getTime()) ? null : dt.getUTCFullYear();
  }

  const dt = new Date(text);
  return Number.isNaN(dt.getTime()) ? null : dt.getUTCFullYear();
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

  // filtros rapidos (locais da pagina atual)
  const [quickSearch, setQuickSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

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
    setQuickSearch("");
    setClienteFilter("__all__");
    setStatusFilter("__all__");
    setPeriodFrom("");
    setPeriodTo("");
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

  const clienteKey = useMemo(
    () => findKeyByAlias(columns, ["cliente", "clientes"]),
    [columns]
  );
  const statusKey = useMemo(
    () => findKeyByAlias(columns, ["status", "situacao"]),
    [columns]
  );
  const periodKey = useMemo(() => {
    if (dateKey) return dateKey;
    return columns.find((c) => isDateLabel(c.label))?.key || null;
  }, [columns, dateKey]);

  const clienteOptions = useMemo(() => {
    if (!clienteKey) return [];
    const values = new Set<string>();
    for (const row of rows) {
      const data = (row.data || {}) as Record<string, unknown>;
      const value = rawValueText(data[clienteKey]);
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows, clienteKey]);

  const statusOptions = useMemo(() => {
    if (!statusKey) return [];
    const values = new Set<string>();
    for (const row of rows) {
      const data = (row.data || {}) as Record<string, unknown>;
      const value = rawValueText(data[statusKey]);
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows, statusKey]);

  const quickSearchNorm = normLabel(quickSearch);
  const fromYear = Number(periodFrom);
  const toYear = Number(periodTo);
  const fromYearValid = periodFrom.trim() !== "" && Number.isInteger(fromYear) ? fromYear : null;
  const toYearValid = periodTo.trim() !== "" && Number.isInteger(toYear) ? toYear : null;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const data = (row.data || {}) as Record<string, unknown>;

      if (quickSearchNorm) {
        const rowText = columns.map((col) => rawValueText(data[col.key])).join(" ");
        if (!normLabel(rowText).includes(quickSearchNorm)) return false;
      }

      if (clienteFilter !== "__all__" && clienteKey) {
        const clienteValue = rawValueText(data[clienteKey]);
        if (normLabel(clienteValue) !== normLabel(clienteFilter)) return false;
      }

      if (statusFilter !== "__all__" && statusKey) {
        const statusValue = rawValueText(data[statusKey]);
        if (normLabel(statusValue) !== normLabel(statusFilter)) return false;
      }

      if ((fromYearValid !== null || toYearValid !== null) && periodKey) {
        const year = extractYear(data[periodKey]);
        if (fromYearValid !== null && (year === null || year < fromYearValid)) return false;
        if (toYearValid !== null && (year === null || year > toYearValid)) return false;
      }

      return true;
    });
  }, [
    rows,
    columns,
    quickSearchNorm,
    clienteFilter,
    statusFilter,
    periodKey,
    clienteKey,
    statusKey,
    fromYearValid,
    toYearValid,
  ]);

  const hasQuickFiltersActive =
    !!quickSearch.trim() ||
    clienteFilter !== "__all__" ||
    statusFilter !== "__all__" ||
    !!periodFrom.trim() ||
    !!periodTo.trim();

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (sortByDate && sheet.toUpperCase() === "CONTRATOS" && dateKey) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortByDate, dateKey, sheet]);

  useEffect(() => {
    if (clienteFilter !== "__all__" && !clienteOptions.includes(clienteFilter)) {
      setClienteFilter("__all__");
    }
  }, [clienteFilter, clienteOptions]);

  useEffect(() => {
    if (statusFilter !== "__all__" && !statusOptions.includes(statusFilter)) {
      setStatusFilter("__all__");
    }
  }, [statusFilter, statusOptions]);

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

  function clearQuickFilters() {
    setQuickSearch("");
    setClienteFilter("__all__");
    setStatusFilter("__all__");
    setPeriodFrom("");
    setPeriodTo("");
  }
  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div className="page-hero relative overflow-hidden ring-1 ring-sky-100/70" variants={item}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />

        <div className="relative">
          <div className="page-kicker">Painel</div>
          <h1 className="page-title inline-flex items-center gap-2">
            <LayoutGrid size={22} />
            Dashboard
          </h1>
          <p className="page-desc">Gerencie colunas, linhas e importacoes em uma visao unica e rapida.</p>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <span className="badge">
            <FileSpreadsheet size={13} className="mr-1.5" />
            Aba: {sheet}
          </span>
          <span className="badge">
            <Rows3 size={13} className="mr-1.5" />
            Linhas: {total}
          </span>
          <button className="btn" onClick={onCreateColumn}>
            + Coluna
          </button>
          <button className="btn" onClick={onCreateRow}>
            + Linha
          </button>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={item}>
        <div className="dash-stat dash-stat-cyan">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Aba atual</div>
          <div className="mt-2 inline-flex items-center gap-2 text-xl font-semibold heading text-zinc-900">
            <span className="dash-icon-pill">
              <FileSpreadsheet size={16} />
            </span>
            {sheet}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Nome da planilha ativa</div>
        </div>

        <div className="dash-stat dash-stat-amber">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Colunas visiveis</div>
          <div className="mt-2 inline-flex items-center gap-2 text-xl font-semibold heading text-zinc-900">
            <span className="dash-icon-pill">
              <Columns3 size={16} />
            </span>
            {columns.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Estrutura em tela</div>
        </div>

        <div className="dash-stat dash-stat-indigo">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Registros</div>
          <div className="mt-2 inline-flex items-center gap-2 text-xl font-semibold heading text-zinc-900">
            <span className="dash-icon-pill">
              <Rows3 size={16} />
            </span>
            {total}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Total carregado no banco</div>
        </div>

        <div className="dash-stat dash-stat-emerald">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Ordenacao</div>
          <div className="mt-2 inline-flex items-center gap-2 text-xl font-semibold heading text-zinc-900">
            <span className="dash-icon-pill">
              <CalendarClock size={16} />
            </span>
            {sortByDate ? "Ativa" : "Manual"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {sortByDate && dateKey ? `Campo: ${dateLabel || dateKey}` : "Sem campo de data aplicado"}
          </div>
        </div>
      </motion.div>

      <header className="flex flex-col gap-3">
        <motion.div className="panel-soft space-y-4" variants={item}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
            <div className="dash-block">
              <div className="dash-block-title">Contexto da aba</div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600">Aba:</span>
                  <input
                    className="input w-52"
                    value={sheet}
                    onChange={(e) => setSheet(e.target.value)}
                    placeholder="CONTRATOS"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-zinc-900"
                    checked={sortByDate}
                    onChange={(e) => setSortByDate(e.target.checked)}
                  />
                  Mais recentes por ano
                </label>

                {sortByDate && sheet.toUpperCase() === "CONTRATOS" && (
                  <span className="badge">
                    <SlidersHorizontal size={13} className="mr-1.5" />
                    {dateKey ? `Campo: ${dateLabel || dateKey}` : "Nenhuma coluna de data encontrada"}
                  </span>
                )}
              </div>
            </div>

            <div className="dash-block">
              <div className="dash-block-title">Importacao e sincronizacao</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  <UploadCloud size={15} />
                  <span className="max-w-[220px] truncate">{file ? file.name : "Escolher arquivo (.xlsx)"}</span>
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
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Recarregar
                </button>
              </div>
            </div>
          </div>

          <div className="dash-block">
            <div className="dash-block-title inline-flex items-center gap-2">
              <Filter size={13} />
              Filtros rapidos (pagina atual)
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Busca geral</span>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    className="input pl-8"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="Buscar em todas as colunas"
                  />
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Cliente</span>
                <select
                  className="input"
                  value={clienteFilter}
                  onChange={(e) => setClienteFilter(e.target.value)}
                  disabled={!clienteKey}
                >
                  <option value="__all__">Todos</option>
                  {clienteOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Status</span>
                <select
                  className="input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  disabled={!statusKey}
                >
                  <option value="__all__">Todos</option>
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Ano de</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2200}
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  placeholder="Ex.: 2022"
                  disabled={!periodKey}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Ano ate</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2200}
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  placeholder="Ex.: 2026"
                  disabled={!periodKey}
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="badge">
                {filteredRows.length} de {rows.length} linhas na pagina
              </span>
              {hasQuickFiltersActive && <span className="dash-filter-active">Filtros ativos</span>}
              <button className="btn" onClick={clearQuickFilters} disabled={!hasQuickFiltersActive}>
                <RotateCcw size={14} />
                Limpar filtros
              </button>
            </div>
          </div>

          <div className="dash-block flex flex-wrap items-center gap-2">
            <button className="btn disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={15} />
              Anterior
            </button>
            <span className="badge">
              <Hash size={12} className="mr-1.5" />
              Pagina {page} / {totalPages}
            </span>
            <input
              className="input w-20 py-1"
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
            <button className="btn disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Proxima
              <ChevronRight size={15} />
            </button>
          </div>
        </motion.div>
      </header>

      <motion.section className="table-shell table-shell-dashboard" variants={item}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 text-xs text-zinc-500">
          <span>
            Mostrando <strong className="text-zinc-700">{filteredRows.length}</strong> de{" "}
            <strong className="text-zinc-700">{rows.length}</strong> linhas nesta pagina
          </span>
          <span>
            {hasQuickFiltersActive ? "Filtros ativos na pagina. " : ""}
            Duplo clique para editar, Enter salva, Esc cancela.
          </span>
        </div>

        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="min-w-[1450px] w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
              <tr>
                <th className="table-shell-sticky sticky left-0 z-20 w-[96px] whitespace-nowrap px-3 py-2 text-left">Acoes</th>
                <th className="w-[84px] whitespace-nowrap px-3 py-2 text-left">Linha</th>
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <span title={c.key} className="font-semibold text-zinc-800">
                        {c.label}
                      </span>
                      <button className="btn !px-2 !py-1 text-xs" onClick={() => onDeleteColumn(c.key)} title="Excluir coluna">
                        Excluir
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <TableSkeletonRows cols={Math.max(columns.length + 1, 6)} rows={6} withActions />
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6" colSpan={columns.length + 2}>
                    <EmptyState
                      compact
                      title="Nenhuma linha encontrada"
                      text={
                        hasQuickFiltersActive
                          ? "Ajuste os filtros rapidos para visualizar resultados."
                          : `Nao ha registros para a aba ${sheet}.`
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-200/70 odd:bg-white even:bg-zinc-50/60 hover:bg-sky-50/40">
                    <td className="table-shell-sticky sticky left-0 z-10 px-3 py-2">
                      <button className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => onDeleteRow(r.id)}>
                        Excluir
                      </button>
                    </td>

                    <td className="px-3 py-2 text-xs font-medium text-zinc-500">{r.rowNumber ?? "-"}</td>

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
                          className="cursor-cell whitespace-nowrap px-3 py-2"
                          onDoubleClick={() => startEdit(r.id, c.key, cellValue)}
                          title="Duplo clique para editar"
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              className="input w-full min-w-[150px] py-1.5"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onBlur={commitEdit}
                            />
                          ) : (
                            <span className={displayValue === "-" ? "text-zinc-400" : "text-zinc-800"}>{displayValue}</span>
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
      </motion.section>
    </motion.div>
  );
}
