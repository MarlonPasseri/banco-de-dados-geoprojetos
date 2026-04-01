import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FilePenLine, RotateCcw, Search, SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchGrid, type GridColumn, type GridRow } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { EmptyState, TableSkeletonRows } from "../components/UiStates";
import { safeUUID } from "../utils/uuid";

function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function hasVisibleValue(v: any) {
  if (v === null || v === undefined) return false;
  const text = String(v).trim();
  return text !== "" && text !== "-";
}

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

function isGpLikeQuery(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (/^[a-z0-9]{4}-\d{2}$/i.test(trimmed)) return true;
  return /^\d{4,}$/.test(trimmed);
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

export default function Consultas() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const navigate = useNavigate();

  const [sheet, setSheet] = useState("CONTRATOS");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [items, setItems] = useState<GridRow[]>([]);
  const [total, setTotal] = useState(0);
  const [matchMode, setMatchMode] = useState<"broad" | "exactNumero">("broad");

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => q.trim(), [q]);
  const canSearch = query.length >= 2;
  const isGpSearch = useMemo(() => isGpLikeQuery(query), [query]);
  const searchMode = useMemo<"broad" | "smart">(() => (isGpSearch ? "smart" : "broad"), [isGpSearch]);
  const numeroKey = useMemo(() => findNumeroKey(columns), [columns]);
  const resultColumns = useMemo(
    () => columns.filter((column) => items.some((row) => hasVisibleValue(row.data?.[column.key]))),
    [columns, items]
  );
  const searchExamples = ["1234-25", "cliente", "pendente"];
  const searchStrategy = useMemo(
    () =>
      !canSearch
        ? {
            title: "Comece pelo que voce sabe",
            text: "Digite uma GP, nome de cliente, servico ou status. A leitura da tabela vai se ajustar so com base no que fizer sentido para a busca.",
          }
        : isGpSearch
        ? {
            title: "Busca orientada para GP",
            text: "Como o termo parece uma GP, o sistema tenta primeiro o numero exato e so depois abre os resultados aproximados.",
          }
        : {
            title: "Busca ampla em toda a base",
            text: "O termo atual sera procurado nas colunas visiveis da aba selecionada para reduzir o tempo de procura manual.",
          },
    [canSearch, isGpSearch]
  );
  const resultsLabel = canSearch ? `${total} resultado(s)` : "Aguardando busca";

  useEffect(() => setPage(1), [query, sheet]);

  useEffect(() => {
    let alive = true;

    if (!canSearch) {
      setItems([]);
      setColumns([]);
      setTotal(0);
      setMatchMode("broad");
      setLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchGrid(query, sheet, page, pageSize, searchMode);
        if (!alive) return;

        setColumns(r.columns || []);
        setItems(r.items || []);
        setTotal(r.total || 0);
        setMatchMode(r.matchMode || "broad");
      } catch (e: any) {
        if (!alive) return;
        setToast({
          id: safeUUID(),
          type: "error",
          title: "Erro na consulta",
          text: e?.message || "Falha ao buscar",
        });
        setItems([]);
        setColumns([]);
        setTotal(0);
        setMatchMode("broad");
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [canSearch, page, query, searchMode, sheet]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goToEdicao(row: GridRow) {
    const numero = numeroKey ? String(row.data?.[numeroKey] ?? "").trim() : "";
    navigate("/edicao", { state: { row, sheet, numero } });
  }

  function applyExample(value: string) {
    setQ(value);
    setPage(1);
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div className="page-hero consultas-hero" variants={item}>
        <div className="consultas-hero-grid">
          <div className="space-y-4">
            <div>
              <div className="page-kicker">Busca guiada</div>
              <h1 className="page-title inline-flex items-center gap-2">
                <Search size={22} />
                Consultas
              </h1>
              <p className="page-desc">
                Encontre registros sem precisar adivinhar onde procurar. Quando o termo parecer uma GP, a busca tenta primeiro o numero exato.
              </p>
            </div>

            <div className="consultas-hero-chips">
              <span className="badge">Aba atual: {sheet}</span>
              <span className="badge">{resultsLabel}</span>
              <span className="badge">{loading ? "Buscando em tempo real" : "Leitura atualizada"}</span>
              {canSearch && isGpSearch && !loading ? (
                <span className="badge">
                  {matchMode === "exactNumero" ? "GP encontrada com exatidao" : "Sem GP exata, mostrando aproximados"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="consultas-hero-tip">
            <div className="consultas-hero-tip-label">Como a busca vai agir</div>
            <div className="consultas-hero-tip-title">{searchStrategy.title}</div>
            <div className="consultas-hero-tip-text">{searchStrategy.text}</div>
          </div>
        </div>
      </motion.div>

      <motion.div className="panel-soft space-y-4" variants={item}>
        <div className="consultas-panel-head">
          <div>
            <div className="activity-section-title">Refine sua busca</div>
            <div className="activity-section-desc">
              Escolha a aba, digite o termo e use os exemplos abaixo se quiser testar um caminho rapido.
            </div>
          </div>

          <div className="consultas-example-row">
            {searchExamples.map((example) => (
              <button key={example} className="consultas-example-chip" onClick={() => applyExample(example)} type="button">
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600" htmlFor="consultas-sheet">
              Aba
            </label>
            <input
              id="consultas-sheet"
              className="input"
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              placeholder="Ex.: CONTRATOS"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-zinc-600" htmlFor="consultas-query">
              Pesquisar
            </label>
            <div className="consultas-search-shell">
              <Search size={16} className="consultas-search-icon" />
              <input
                id="consultas-query"
                className="consultas-search-input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Digite GP, cliente, servico ou status"
                autoComplete="off"
                aria-describedby="consultas-help"
              />
              {query ? (
                <button className="consultas-clear-btn" onClick={() => applyExample("")} type="button" aria-label="Limpar busca">
                  <RotateCcw size={14} />
                </button>
              ) : null}
            </div>
            <p id="consultas-help" className="consultas-field-help">
              Para GP, a busca tenta primeiro o numero exato. Para outros termos, pesquisa em todas as colunas.
            </p>
          </div>
        </div>

        <div className="consultas-summary-row" aria-live="polite">
          <div className="consultas-summary-card">
            <div className="consultas-summary-label">Leitura atual</div>
            <div className="consultas-summary-value">{loading ? "Buscando..." : resultsLabel}</div>
            <div className="consultas-summary-text">
              {!canSearch
                ? "Digite ao menos dois caracteres para ativar a consulta."
                : total === 0
                ? "Nenhum registro encontrado ainda para o termo atual."
                : `Mostrando ${items.length} item(ns) nesta pagina para acelerar a leitura.`}
            </div>
          </div>

          <div className="consultas-summary-card">
            <div className="consultas-summary-label">Modo aplicado</div>
            <div className="consultas-summary-value">{isGpSearch ? "Prioridade para GP" : "Busca ampla"}</div>
            <div className="consultas-summary-text">{searchStrategy.text}</div>
          </div>

          <div className="consultas-summary-card">
            <div className="consultas-summary-label">Acoes disponiveis</div>
            <div className="consultas-summary-value">{!loading && items.length > 0 ? `${resultColumns.length} colunas uteis` : "Prontas para editar"}</div>
            <div className="consultas-summary-text">Quando encontrar o registro certo, use o botao Editar para seguir direto para a manutencao.</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            {!canSearch ? (
              <span className="badge">Digite algo para comecar</span>
            ) : loading ? (
              <span className="badge">Buscando...</span>
            ) : (
              <span className="badge">Resultados: {total}</span>
            )}
            {!loading && items.length > 0 ? <span className="badge">Colunas com dados: {resultColumns.length}</span> : null}
            {query ? (
              <button className="btn" onClick={() => applyExample("")} type="button">
                <RotateCcw size={14} />
                Limpar busca
              </button>
            ) : null}
          </div>

          {canSearch && total > 0 ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <button className="btn flex-1 sm:flex-none" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} type="button">
                Anterior
              </button>
              <span className="text-sm text-zinc-600">
                Pagina {page} / {totalPages}
              </span>
              <button className="btn flex-1 sm:flex-none" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} type="button">
                Proxima
              </button>
            </div>
          ) : null}
        </div>
      </motion.div>

      {!canSearch ? (
        <div className="panel-soft">
          <EmptyState title="Digite para iniciar a busca" text="Use pelo menos dois caracteres para consultar em todas as colunas.">
            {searchExamples.map((example) => (
              <button key={`empty-example-${example}`} className="consultas-example-chip" onClick={() => applyExample(example)} type="button">
                Testar: {example}
              </button>
            ))}
          </EmptyState>
        </div>
      ) : loading ? (
        <div className="table-shell">
          <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
            <table className="min-w-[1200px] w-full text-sm">
              <tbody>
                <TableSkeletonRows cols={Math.max(resultColumns.length + 1, 5)} rows={7} />
              </tbody>
            </table>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="panel-soft">
          <EmptyState Icon={SearchX} title="Nenhum resultado" text="Tente outro termo, aba ou pagina de busca.">
            <button className="btn" onClick={() => applyExample("")} type="button">
              <RotateCcw size={14} />
              Limpar e tentar de novo
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="table-shell">
          <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-white">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left">Acao</th>
                  {resultColumns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b transition-colors">
                    <td className="whitespace-nowrap px-3 py-2">
                      <button className="btn" onClick={() => goToEdicao(r)} type="button">
                        <FilePenLine size={16} />
                        Editar
                      </button>
                    </td>
                    {resultColumns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2">
                        {fmt(r.data?.[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="consultas-table-foot border-t p-3 text-xs text-zinc-500">
            Mostrando {items.length} registro(s) nesta pagina, de um total de {total}. Se encontrou o item certo, siga pelo botao Editar para continuar o fluxo.
          </div>
        </div>
      )}
    </motion.div>
  );
}
