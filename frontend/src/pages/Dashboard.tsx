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
  type LucideIcon,
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

type Editing = { rowId: string; key: string; initial: string };

function DashboardOverviewCard({
  tone,
  icon: Icon,
  label,
  value,
  meta,
}: {
  tone: "cyan" | "amber" | "indigo" | "emerald";
  icon: LucideIcon;
  label: string;
  value: string | number;
  meta: string;
}) {
  return (
    <div className="dash-overview-card" data-tone={tone}>
      <div className="dash-overview-head">
        <div className="dash-overview-label">{label}</div>
        <span className="dash-overview-icon">
          <Icon size={17} />
        </span>
      </div>
      <div className="dash-overview-value">{value}</div>
      <div className="dash-overview-meta">{meta}</div>
    </div>
  );
}

function DashboardMiniCard({
  icon: Icon,
  label,
  value,
  text,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  text: string;
}) {
  return (
    <div className="dash-mini-card">
      <div className="dash-mini-head">
        <div className="dash-mini-label">{label}</div>
        <Icon size={18} className="dash-mini-icon" />
      </div>
      <div className="dash-mini-value">{value}</div>
      <div className="dash-mini-text">{text}</div>
    </div>
  );
}

function DashboardFeedItem({
  stamp,
  text,
  tone,
}: {
  stamp: string;
  text: string;
  tone: "accent" | "warning" | "muted";
}) {
  return (
    <div className="dash-feed-item" data-tone={tone}>
      <div className="dash-feed-marker" />
      <div className="dash-feed-copy">
        <div className="dash-feed-stamp">{stamp}</div>
        <div className="dash-feed-text">{text}</div>
      </div>
    </div>
  );
}

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

  const [sheet, setSheet] = useState("CONTRATOS");
  const [sortByDate, setSortByDate] = useState(true);
  const [dateKey, setDateKey] = useState<string | null>(null);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const [quickSearch, setQuickSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  async function reload() {
    setLoading(true);
    try {
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

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sheet, sortByDate]);

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

  const clienteKey = useMemo(() => findKeyByAlias(columns, ["cliente", "clientes"]), [columns]);
  const statusKey = useMemo(() => findKeyByAlias(columns, ["status", "situacao"]), [columns]);
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

  const activeFilterCount =
    (quickSearch.trim() ? 1 : 0) +
    (clienteFilter !== "__all__" ? 1 : 0) +
    (statusFilter !== "__all__" ? 1 : 0) +
    (periodFrom.trim() ? 1 : 0) +
    (periodTo.trim() ? 1 : 0);

  const visibleRowsCount = filteredRows.length;
  const pageWindowStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageWindowEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const sheetLabel = sheet.trim() || "Sem nome";
  const filterSummary = hasQuickFiltersActive
    ? `${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} ativo${activeFilterCount > 1 ? "s" : ""}`
    : "Sem filtros locais";
  const rangeSummary = total === 0 ? "Sem registros carregados" : `Janela ${pageWindowStart}-${pageWindowEnd} de ${total}`;
  const visibleSummary = hasQuickFiltersActive
    ? `${visibleRowsCount} linhas apos os filtros`
    : `${rows.length} linhas disponiveis nesta pagina`;
  const importSummary = file ? file.name : "Nenhum arquivo selecionado";
  const sortSummary =
    sortByDate && dateKey ? `Ordenado por ${dateLabel || dateKey}` : "Sem ordenacao automatica";

  const overviewCards = [
    {
      tone: "cyan" as const,
      icon: FileSpreadsheet,
      label: "Aba ativa",
      value: sheetLabel,
      meta: "Planilha principal em operacao",
    },
    {
      tone: "amber" as const,
      icon: Columns3,
      label: "Colunas visiveis",
      value: columns.length,
      meta: "Estrutura atual em tela",
    },
    {
      tone: "indigo" as const,
      icon: Rows3,
      label: "Registros",
      value: total,
      meta: rangeSummary,
    },
    {
      tone: "emerald" as const,
      icon: CalendarClock,
      label: "Ordenacao",
      value: sortByDate ? "Ativa" : "Manual",
      meta: sortSummary,
    },
  ];

  const dashboardFeedItems: Array<{ stamp: string; text: string; tone: "accent" | "warning" | "muted" }> = [
    {
      stamp: `Janela ${page}/${totalPages}`,
      text: `${visibleRowsCount} de ${rows.length} linhas estao visiveis nesta pagina da grade.`,
      tone: "accent",
    },
    {
      stamp: file ? "Importacao pronta" : "Importacao",
      text: file
        ? `${file.name} aguarda envio em modo merge para a aba ${sheetLabel}.`
        : `Nenhum arquivo foi selecionado para sincronizar a aba ${sheetLabel}.`,
      tone: file ? "warning" : "muted",
    },
    {
      stamp: hasQuickFiltersActive ? "Filtros locais" : "Sem filtros",
      text: hasQuickFiltersActive
        ? `${filterSummary} influenciando a leitura da janela atual.`
        : "A leitura local esta livre para inspecao completa da pagina carregada.",
      tone: hasQuickFiltersActive ? "accent" : "muted",
    },
    {
      stamp: sortByDate && dateKey ? "Ordenacao automatica" : "Leitura manual",
      text: sortByDate && dateKey
        ? `Contratos priorizados pelo campo ${dateLabel || dateKey}.`
        : "A grade segue a ordem padrao retornada pela API.",
      tone: sortByDate && dateKey ? "accent" : "muted",
    },
  ];

  const spotlightTitle = file ? "Importacao pronta para sincronizacao" : "Estrutura pronta para manutencao";
  const spotlightText = file
    ? `O arquivo ${file.name} ja esta preparado para merge. Revise a aba alvo e siga com a sincronizacao quando quiser.`
    : `Use as acoes rapidas para criar colunas, incluir linhas ou atualizar a leitura da aba ${sheetLabel} sem sair do dashboard.`;

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

  const tableSection = (
    <div className="table-shell table-shell-dashboard dash-blueprint-table">
      <div className="dash-table-meta dash-table-meta-blueprint">
        <div>
          <div className="dash-table-kicker">Grade operacional</div>
          <div className="dash-table-title">Grade operacional da aba {sheetLabel}</div>
        </div>
        <div className="dash-table-meta-copy">
          <span>
            Mostrando <strong>{visibleRowsCount}</strong> de <strong>{rows.length}</strong> linhas nesta pagina
          </span>
          <span>
            {hasQuickFiltersActive ? `${filterSummary}. ` : ""}
            Duplo clique para editar, Enter salva, Esc cancela.
          </span>
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
        <table className="min-w-[1450px] w-full text-sm">
          <thead className="sticky top-0 z-10 border-b backdrop-blur">
            <tr>
              <th className="table-shell-sticky sticky left-0 z-20 w-[96px] whitespace-nowrap px-3 py-3 text-left">Acoes</th>
              <th className="w-[84px] whitespace-nowrap px-3 py-3 text-left">Linha</th>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-3 text-left">
                  <div className="flex items-center gap-2">
                    <span title={c.key} className="font-semibold">
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
                        : `Nao ha registros para a aba ${sheetLabel}.`
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id} className="data-table-row">
                  <td className="table-shell-sticky sticky left-0 z-10 px-3 py-2">
                    <button className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => onDeleteRow(r.id)}>
                      Excluir
                    </button>
                  </td>

                  <td className="data-table-cell-muted px-3 py-2 text-xs font-medium">{r.rowNumber ?? "-"}</td>

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
                          <span className={displayValue === "-" ? "data-table-cell-empty" : "data-table-cell-value"}>
                            {displayValue}
                          </span>
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
    </div>
  );

  const spotlightSection = (
    <div className="dash-spotlight">
      <div className="dash-spotlight-copy">
        <div className="dash-spotlight-kicker">Destaque operacional</div>
        <div className="dash-spotlight-title">{spotlightTitle}</div>
        <div className="dash-spotlight-text">{spotlightText}</div>
      </div>
      <div className="dash-spotlight-actions">
        <button className="btn btn-primary" onClick={file ? onImportGrid : onCreateColumn}>
          {file ? "Importar arquivo" : "+ Coluna"}
        </button>
        <button className="btn" onClick={file ? reload : onCreateRow}>
          {file ? "Atualizar grade" : "+ Linha"}
        </button>
      </div>
    </div>
  );

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.section className="page-hero dash-hero dash-blueprint-hero" variants={item}>
        <div className="dash-hero-grid">
          <div className="space-y-5">
            <div className="dash-hero-copy">
              <div className="page-kicker">Visao operacional</div>
              <h1 className="page-title dash-hero-title">
                <LayoutGrid size={18} className="dash-hero-title-icon" />
                <span>Dashboard</span>
              </h1>
              <p className="page-desc dash-hero-desc">
                Controle a aba ativa, importe planilhas e acompanhe a grade operacional em uma leitura mais tecnica e orientada a contexto.
              </p>
            </div>

            <div className="dash-chip-grid">
              <span className="dash-chip">
                <FileSpreadsheet size={14} />
                Aba: {sheetLabel}
              </span>
              <span className="dash-chip">
                <Rows3 size={14} />
                {rangeSummary}
              </span>
              <span className="dash-chip">
                <Filter size={14} />
                {filterSummary}
              </span>
            </div>

            <div className="dash-hero-action-row">
              <button className="btn btn-primary" onClick={onCreateColumn}>
                + Coluna
              </button>
              <button className="btn" onClick={onCreateRow}>
                + Linha
              </button>
              <button className="btn" onClick={reload}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Recarregar
              </button>
            </div>
          </div>

          <div className="dash-hero-side">
            <DashboardMiniCard
              icon={Rows3}
              label="Leitura da pagina"
              value={`${visibleRowsCount}/${rows.length || 0}`}
              text={visibleSummary}
            />
            <DashboardMiniCard
              icon={Hash}
              label="Paginacao"
              value={`Pag. ${page}/${totalPages}`}
              text={rangeSummary}
            />
            <DashboardMiniCard
              icon={UploadCloud}
              label="Importacao"
              value={file ? "Arquivo pronto" : "Aguardando .xlsx"}
              text={importSummary}
            />
          </div>
        </div>
      </motion.section>

      <motion.div className="dash-kpi-grid" variants={item}>
        {overviewCards.map((card) => (
          <DashboardOverviewCard
            key={card.label}
            tone={card.tone}
            icon={card.icon}
            label={card.label}
            value={card.value}
            meta={card.meta}
          />
        ))}
      </motion.div>

      <motion.section className="dash-section-grid" variants={item}>
        <div className="dash-primary-column">
          <div className="dash-control-grid">
            <div className="dash-block">
              <div className="dash-block-header">
                <div>
                  <div className="dash-block-title">Contexto da aba</div>
                  <div className="dash-block-desc">Troque a planilha ativa e defina a leitura inicial do grid.</div>
                </div>
                <span className="badge">{sortSummary}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,220px)_auto]">
                <label className="space-y-1">
                  <span className="text-sm text-zinc-600">Aba</span>
                  <input
                    className="input"
                    value={sheet}
                    onChange={(e) => setSheet(e.target.value)}
                    placeholder="CONTRATOS"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="dash-toggle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-500"
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
            </div>

          <div className="dash-block dash-block-span-2">
            <div className="dash-block-header">
              <div>
                <div className="dash-block-title inline-flex items-center gap-2">
                  <Filter size={13} />
                  Filtros rapidos
                </div>
                <div className="dash-block-desc">
                  Refine apenas os dados da pagina atual sem alterar a consulta global.
                </div>
              </div>
              <span className="badge">{filterSummary}</span>
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
                {visibleRowsCount} de {rows.length} linhas na pagina
              </span>
              {hasQuickFiltersActive && <span className="dash-filter-active">Filtros ativos</span>}
              <button className="btn" onClick={clearQuickFilters} disabled={!hasQuickFiltersActive}>
                <RotateCcw size={14} />
                Limpar filtros
              </button>
            </div>
          </div>
          <div className="dash-block">
            <div className="dash-block-header">
              <div>
                <div className="dash-block-title">Importacao e sincronizacao</div>
                <div className="dash-block-desc">Selecione um arquivo e envie diretamente para a aba em uso.</div>
              </div>
              <span className="badge">{file ? "Pronto para subir" : "Nenhum arquivo"}</span>
            </div>

            <label className="dash-upload-label">
              <UploadCloud size={15} />
              <span className="max-w-[220px] truncate">{file ? file.name : "Escolher arquivo (.xlsx)"}</span>
              <input
                className="hidden"
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" onClick={onImportGrid}>
                Importar
              </button>
              <button className="btn" onClick={reload}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Atualizar grade
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge">Aba alvo: {sheetLabel}</span>
              <span className="badge">{file ? "Modo: merge" : "Aguardando arquivo"}</span>
            </div>
          </div>

          <div className="dash-block dash-block-span-2">
            <div className="dash-block-header">
              <div>
                <div className="dash-block-title">Navegacao</div>
                <div className="dash-block-desc">Salte entre paginas sem perder o contexto dos filtros da tela.</div>
              </div>
              <span className="badge">
                <Hash size={12} className="mr-1.5" />
                Pagina {page} / {totalPages}
              </span>
            </div>

            <div className="dash-paginator">
              <button className="btn disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} />
                Anterior
              </button>
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

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DashboardMiniCard
                icon={Rows3}
                label="Leitura local"
                value={`${visibleRowsCount}/${rows.length || 0}`}
                text={visibleSummary}
              />
              <DashboardMiniCard
                icon={Filter}
                label="Status dos filtros"
                value={hasQuickFiltersActive ? "Ligado" : "Livre"}
                text={filterSummary}
              />
            </div>
            </div>
          </div>

          {tableSection}
          {spotlightSection}
        </div>

        <div className="dash-secondary-column">
          <div className="dash-feed-card">
            <div className="dash-block-header">
              <div>
                <div className="dash-block-title">Leituras recentes</div>
                <div className="dash-block-desc">Leituras operacionais geradas a partir do estado atual do dashboard.</div>
              </div>
              <span className="badge">{dashboardFeedItems.length} itens</span>
            </div>

            <div className="dash-feed-list">
              {dashboardFeedItems.map((entry) => (
                <DashboardFeedItem key={entry.stamp} stamp={entry.stamp} text={entry.text} tone={entry.tone} />
              ))}
            </div>

            <button className="btn mt-4 w-full" onClick={reload}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Atualizar leitura
            </button>
          </div>

          <div className="dash-support-card">
            <div className="dash-support-title">Suporte operacional</div>
            <div className="dash-support-text">
              Use o dashboard para revisar a aba ativa, aplicar filtros locais e preparar importacoes antes de avancar para consultas ou edicao.
            </div>
            <div className="dash-support-actions">
              <span className="badge">Aba: {sheetLabel}</span>
              <span className="badge">{hasQuickFiltersActive ? "Filtros ligados" : "Filtro livre"}</span>
            </div>
          </div>
        </div>
      </motion.section>

    </motion.div>
  );
}
