import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, SearchX } from "lucide-react";
import { searchGrid, type GridColumn, type GridRow } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { EmptyState, TableSkeletonRows } from "../components/UiStates";
import { safeUUID } from "../utils/uuid";

function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
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

  const [sheet, setSheet] = useState("CONTRATOS");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [items, setItems] = useState<GridRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => q.trim(), [q]);
  const canSearch = query.length >= 2;

  useEffect(() => setPage(1), [query, sheet]);

  useEffect(() => {
    let alive = true;

    if (!canSearch) {
      setItems([]);
      setColumns([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchGrid(query, sheet, page, pageSize);
        if (!alive) return;

        setColumns(r.columns || []);
        setItems(r.items || []);
        setTotal(r.total || 0);
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
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [canSearch, query, sheet, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div className="page-hero" variants={item}>
        <div>
          <div className="page-kicker">Busca</div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Search size={22} />
            Consultas
          </h1>
          <p className="page-desc">Pesquise no banco inteiro. Aqui aparecem apenas resultados da busca.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge">Aba: {sheet}</span>
          <span className="badge">Resultados: {total}</span>
        </div>
      </motion.div>

      <motion.div className="panel-soft space-y-3" variants={item}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Aba</label>
            <input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-zinc-600">Pesquisar</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Digite (min. 2 caracteres)..."
            />
            <p className="text-xs text-zinc-500">A busca procura em todas as colunas.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {!canSearch ? (
              <span className="badge">Digite algo para comecar</span>
            ) : loading ? (
              <span className="badge">Buscando...</span>
            ) : (
              <span className="badge">Resultados: {total}</span>
            )}
          </div>

          {canSearch && total > 0 && (
            <div className="flex items-center gap-2">
              <button className="btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <span className="text-sm text-zinc-600">
                Pagina {page} / {totalPages}
              </span>
              <button className="btn" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Proxima
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {!canSearch ? (
        <div className="panel-soft">
          <EmptyState
            title="Digite para iniciar a busca"
            text="Use pelo menos dois caracteres para consultar em todas as colunas."
          />
        </div>
      ) : loading ? (
        <div className="table-shell">
          <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
            <table className="min-w-[1200px] w-full text-sm">
              <tbody>
                <TableSkeletonRows cols={Math.max(columns.length, 5)} rows={7} />
              </tbody>
            </table>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="panel-soft">
          <EmptyState Icon={SearchX} title="Nenhum resultado" text="Tente outro termo, aba ou pagina de busca." />
        </div>
      ) : (
        <div className="table-shell">
          <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-white">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b transition-colors">
                    {columns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2">
                        {fmt(r.data?.[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t p-3 text-xs text-zinc-500">Mostrando {items.length} nesta pagina (de {total} no total).</div>
        </div>
      )}
    </motion.div>
  );
}
