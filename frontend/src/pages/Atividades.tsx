import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ClipboardList,
  FolderOpen,
  MessageSquareMore,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteFollowUp, listFollowUps, type FollowUp } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { EmptyState } from "../components/UiStates";
import { safeUUID } from "../utils/uuid";

type ActivityTypeKey = "all" | "convite" | "entrega" | "ultimoContato";

type ActivityView = {
  row: FollowUp;
  labels: string[];
  types: ActivityTypeKey[];
  primaryType: Exclude<ActivityTypeKey, "all">;
  clientName: string;
  statusText: string;
};

function toDateInput(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function todayDateInput() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fmtDate(value: unknown) {
  if (!value) return "-";
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function fmtCurrency(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getActivityMeta(row: FollowUp, date: string) {
  const labels: string[] = [];
  const types: ActivityTypeKey[] = [];

  if (toDateInput(row.convite) === date) {
    labels.push("Convite");
    types.push("convite");
  }
  if (toDateInput(row.entrega) === date) {
    labels.push("Entrega");
    types.push("entrega");
  }
  if (toDateInput(row.ultimoContato) === date) {
    labels.push("Ultimo contato");
    types.push("ultimoContato");
  }

  const primaryType: Exclude<ActivityTypeKey, "all"> =
    types.includes("entrega") ? "entrega" : types.includes("convite") ? "convite" : "ultimoContato";

  return { labels, types, primaryType };
}

function buildStatusLabel(status: string | null) {
  const text = String(status || "").trim();
  return text || "Sem status";
}

function ActivityStatCard({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value: string | number;
  text: string;
  tone: "slate" | "convite" | "entrega" | "contato";
}) {
  return (
    <div className="activity-stat-card" data-tone={tone}>
      <div className="activity-stat-label">{label}</div>
      <div className="activity-stat-value">{value}</div>
      <div className="activity-stat-text">{text}</div>
    </div>
  );
}

export default function Atividades() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => todayDateInput());
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ActivityTypeKey>("all");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [search, setSearch] = useState("");

  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  function notify(type: ToastMsg["type"], title: string, text: string) {
    setToast({ id: safeUUID(), type, title, text });
  }

  async function loadActivities() {
    if (!selectedDate) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const data = await listFollowUps({ date: selectedDate });
      setItems(data || []);
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao carregar atividades");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, [selectedDate]);

  const activityViews = useMemo<ActivityView[]>(() => {
    return (items || [])
      .map((row) => {
        const activity = getActivityMeta(row, selectedDate);
        return {
          row,
          labels: activity.labels,
          types: activity.types,
          primaryType: activity.primaryType,
          clientName: row.gp?.cliente?.nome || "Sem cliente",
          statusText: buildStatusLabel(row.status),
        };
      })
      .filter((entry) => entry.labels.length > 0)
      .sort((a, b) => {
        if (a.types.length !== b.types.length) return b.types.length - a.types.length;
        return String(a.row.gp?.chave || "").localeCompare(String(b.row.gp?.chave || ""), "pt-BR");
      });
  }, [items, selectedDate]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const entry of activityViews) values.add(entry.statusText);
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activityViews]);

  const searchNorm = normalizeText(search);

  const visibleActivities = useMemo(() => {
    return activityViews.filter((entry) => {
      if (typeFilter !== "all" && !entry.types.includes(typeFilter)) return false;
      if (statusFilter !== "__all__" && entry.statusText !== statusFilter) return false;

      if (searchNorm) {
        const haystack = normalizeText(
          [entry.row.gp?.chave, entry.clientName, entry.statusText, entry.row.gp?.grupo, entry.row.gp?.descricao]
            .filter(Boolean)
            .join(" ")
        );
        if (!haystack.includes(searchNorm)) return false;
      }

      return true;
    });
  }, [activityViews, searchNorm, statusFilter, typeFilter]);

  const totalValor = useMemo(() => {
    return visibleActivities.reduce((sum, entry) => {
      const value = Number(entry.row.valor);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }, [visibleActivities]);

  const activityCounters = useMemo(() => {
    return visibleActivities.reduce(
      (acc, entry) => {
        if (entry.types.includes("convite")) acc.convite += 1;
        if (entry.types.includes("entrega")) acc.entrega += 1;
        if (entry.types.includes("ultimoContato")) acc.ultimoContato += 1;
        return acc;
      },
      { convite: 0, entrega: 0, ultimoContato: 0 }
    );
  }, [visibleActivities]);

  const statusSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of visibleActivities) {
      map.set(entry.statusText, (map.get(entry.statusText) || 0) + 1);
    }
    const total = visibleActivities.length || 1;
    return Array.from(map.entries())
      .map(([label, count]) => ({
        label,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [visibleActivities]);

  async function handleDelete(row: FollowUp) {
    const ok = confirm(`Excluir follow-up #${row.id}?`);
    if (!ok) return;

    try {
      await deleteFollowUp(row.id);
      notify("success", "Follow-up excluido", "Registro removido da agenda do dia.");
      await loadActivities();
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao excluir follow-up.");
    }
  }

  const activityFilterOptions: Array<{ id: ActivityTypeKey; label: string }> = [
    { id: "all", label: "Tudo" },
    { id: "convite", label: "Convites" },
    { id: "entrega", label: "Entregas" },
    { id: "ultimoContato", label: "Contatos" },
  ];

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.section className="page-hero activities-hero" variants={item}>
        <div className="activities-hero-grid">
          <div className="space-y-4">
            <div>
              <div className="page-kicker">Agenda operacional</div>
              <h1 className="page-title inline-flex items-center gap-2">
                <CalendarClock size={22} />
                Atividades do dia
              </h1>
              <p className="page-desc">
                Painel proprio para acompanhar o que precisa de acao hoje sem misturar com a tela de cadastro de follow-up.
              </p>
            </div>

            <div className="activities-hero-chips">
              <span className="activities-hero-chip">
                <ClipboardList size={14} />
                {visibleActivities.length} atividades visiveis
              </span>
              <span className="activities-hero-chip">
                <FolderOpen size={14} />
                {fmtDate(selectedDate)}
              </span>
              <span className="activities-hero-chip">
                <MessageSquareMore size={14} />
                {statusSummary.length} status no radar
              </span>
            </div>
          </div>

          <div className="activities-hero-panel">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-white/70">Data de referencia</span>
              <input
                className="input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button className="btn btn-primary" onClick={loadActivities} type="button">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Atualizar agenda
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSelectedDate(todayDateInput());
                  setTypeFilter("all");
                  setStatusFilter("__all__");
                  setSearch("");
                }}
                type="button"
              >
                Hoje
              </button>
            </div>

            <div className="text-sm text-white/80">
              A agenda considera qualquer follow-up com <strong>convite</strong>, <strong>entrega</strong> ou
              <strong> ultimo contato</strong> marcado para a data escolhida.
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={item}>
        <ActivityStatCard
          label="Agenda visivel"
          value={visibleActivities.length}
          text="Registros retornados para a data e filtros locais"
          tone="slate"
        />
        <ActivityStatCard
          label="Convites"
          value={activityCounters.convite}
          text="Follow-ups com convite na data selecionada"
          tone="convite"
        />
        <ActivityStatCard
          label="Entregas"
          value={activityCounters.entrega}
          text="Itens com entrega prevista para o dia"
          tone="entrega"
        />
        <ActivityStatCard
          label="Ultimos contatos"
          value={activityCounters.ultimoContato}
          text={`Valor acumulado: ${fmtCurrency(totalValor)}`}
          tone="contato"
        />
      </motion.div>

      <motion.section className="activities-layout" variants={item}>
        <div className="space-y-4">
          <div className="panel-soft space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="activity-section-title">Leitura da agenda</div>
                <div className="activity-section-desc">
                  Use os filtros abaixo para enxergar so o tipo de acao que interessa agora.
                </div>
              </div>
              <span className="badge">Data ativa: {fmtDate(selectedDate)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Buscar por GP, cliente ou status</span>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    className="input pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ex.: GP, cliente ou status"
                  />
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-zinc-600">Status</span>
                <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="__all__">Todos os status</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="activities-filter-row">
              {activityFilterOptions.map((option) => (
                <button
                  key={option.id}
                  className={`activity-pill ${typeFilter === option.id ? "activity-pill-active" : ""}`}
                  onClick={() => setTypeFilter(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="activity-feed">
            {loading ? (
              Array.from({ length: 3 }, (_, index) => (
                <div key={`activity-skeleton-${index}`} className="activity-card">
                  <div className="space-y-3">
                    <div className="skeleton h-5 w-40" />
                    <div className="skeleton h-4 w-64" />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="skeleton h-20 w-full" />
                      <div className="skeleton h-20 w-full" />
                      <div className="skeleton h-20 w-full" />
                    </div>
                  </div>
                </div>
              ))
            ) : visibleActivities.length === 0 ? (
              <div className="panel-soft">
                <EmptyState
                  title="Nenhuma atividade encontrada"
                  text="Nao ha follow-ups para esta data com os filtros atuais. Troque a data ou alivie os filtros locais."
                  compact
                />
              </div>
            ) : (
              visibleActivities.map((entry) => (
                <article key={entry.row.id} className="activity-card" data-tone={entry.primaryType}>
                  <div className="activity-card-head">
                    <div>
                      <div className="activity-card-kicker">{entry.clientName}</div>
                      <div className="activity-card-title">{entry.row.gp?.chave || entry.row.gpId}</div>
                      <div className="activity-card-meta">
                        {entry.row.gp?.grupo || "Sem grupo"}
                        {entry.row.gp?.ano ? ` • ${entry.row.gp?.ano}` : ""}
                      </div>
                    </div>

                    <div className="activity-label-row">
                      {entry.labels.map((label) => (
                        <span key={`${entry.row.id}-${label}`} className="activity-label">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="activity-card-grid">
                    <div className="activity-metric">
                      <div className="activity-metric-label">Convite</div>
                      <div className="activity-metric-value">{fmtDate(entry.row.convite)}</div>
                    </div>
                    <div className="activity-metric">
                      <div className="activity-metric-label">Entrega</div>
                      <div className="activity-metric-value">{fmtDate(entry.row.entrega)}</div>
                    </div>
                    <div className="activity-metric">
                      <div className="activity-metric-label">Ultimo contato</div>
                      <div className="activity-metric-value">{fmtDate(entry.row.ultimoContato)}</div>
                    </div>
                  </div>

                  <div className="activity-card-footer">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge">Status: {entry.statusText}</span>
                      <span className="badge">Valor: {fmtCurrency(entry.row.valor)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="btn"
                        onClick={() => navigate(`/modelagem?tab=followups&gpId=${entry.row.gpId}`)}
                        type="button"
                      >
                        <Send size={14} />
                        Abrir follow-up
                      </button>
                      <button className="btn" onClick={() => handleDelete(entry.row)} type="button">
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel-soft space-y-3">
            <div className="activity-section-title">Radar por status</div>
            <div className="activity-section-desc">
              Distribuicao da agenda filtrada para ajudar a priorizar o dia.
            </div>

            {statusSummary.length === 0 ? (
              <EmptyState compact title="Sem status para exibir" text="Assim que houver atividades, o radar aparece aqui." />
            ) : (
              <div className="space-y-3">
                {statusSummary.map((status) => (
                  <div key={status.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-zinc-800">{status.label}</span>
                      <span className="text-zinc-500">
                        {status.count} item(ns) • {status.percent}%
                      </span>
                    </div>
                    <div className="activity-status-track">
                      <div className="activity-status-fill" style={{ width: `${status.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-soft space-y-3">
            <div className="activity-section-title">Leitura rapida</div>
            <div className="activity-section-desc">
              Um resumo compacto do que esta acontecendo no dia selecionado.
            </div>

            <div className="activity-note">
              <strong>{fmtDate(selectedDate)}</strong>
              <span>
                {visibleActivities.length === 0
                  ? " sem atividades pendentes na agenda."
                  : ` com ${visibleActivities.length} atividade(s) distribuida(s) em ${statusSummary.length || 1} status.`}
              </span>
            </div>

            <div className="space-y-2 text-sm text-zinc-600">
              <div className="flex items-center justify-between gap-3">
                <span>GPs unicos</span>
                <strong className="text-zinc-900">{new Set(visibleActivities.map((entry) => entry.row.gpId)).size}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Clientes envolvidos</span>
                <strong className="text-zinc-900">
                  {new Set(visibleActivities.map((entry) => entry.clientName)).size}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Valor total filtrado</span>
                <strong className="text-zinc-900">{fmtCurrency(totalValor)}</strong>
              </div>
            </div>
          </div>

          <div className="panel-soft space-y-3">
            <div className="activity-section-title">Fluxo sugerido</div>
            <div className="activity-section-desc">
              Use esta tela para enxergar o dia. Quando precisar ajustar cadastro, abra o follow-up do item.
            </div>

            <div className="space-y-2 text-sm text-zinc-600">
              <div>1. Selecione a data.</div>
              <div>2. Filtre por convite, entrega ou contato.</div>
              <div>3. Abra o follow-up apenas para tratar o registro escolhido.</div>
            </div>
          </div>
        </aside>
      </motion.section>
    </motion.div>
  );
}
