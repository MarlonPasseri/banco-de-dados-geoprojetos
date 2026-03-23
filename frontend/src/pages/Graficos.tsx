import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  Crown,
  Filter,
  LineChart,
  PieChart,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { fetchGrid, listContratos, type Contrato, type GridColumn, type GridRow } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { EmptyState } from "../components/UiStates";
import { safeUUID } from "../utils/uuid";

type ClientRfm = {
  name: string;
  frequency: number;
  monetary: number;
  lastActivity: Date | null;
  recencyDays: number;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmCode: string;
  segment: string;
};

type HeatCell = {
  recencyScore: number;
  frequencyScore: number;
  count: number;
};

type DistributionItem = {
  label: string;
  value: number;
};

type RankingMode = "monetary" | "frequency" | "recency";
type SummaryCardTone = "slate" | "teal" | "amber" | "indigo";
type DataSource = "contratos" | "grid" | "none";

type LeaderboardItem = {
  label: string;
  rawValue: number;
  value: string;
  meta: string;
};

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function compactText(value: unknown) {
  const text = String(value || "").trim();
  return text || "-";
}

function normalizeLoose(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function safeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let raw = String(value).trim();
  if (!raw) return 0;

  const negative = /^\(.*\)$/.test(raw);
  if (negative) raw = raw.slice(1, -1);

  raw = raw.replace(/[^\d,.\-]/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }

  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  return negative ? -number : number;
}

function safeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function daysBetween(later: Date, earlier: Date | null) {
  if (!earlier) return 999;
  const diff = later.getTime() - earlier.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function quantile(sortedValues: number[], ratio: number) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * ratio)));
  return sortedValues[index];
}

function buildScoreAssigner(values: number[], direction: "asc" | "desc") {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.2);
  const q2 = quantile(sorted, 0.4);
  const q3 = quantile(sorted, 0.6);
  const q4 = quantile(sorted, 0.8);

  return (value: number) => {
    if (direction === "asc") {
      if (value <= q1) return 1;
      if (value <= q2) return 2;
      if (value <= q3) return 3;
      if (value <= q4) return 4;
      return 5;
    }

    if (value <= q1) return 5;
    if (value <= q2) return 4;
    if (value <= q3) return 3;
    if (value <= q4) return 2;
    return 1;
  };
}

function buildRfmSegment(client: Pick<ClientRfm, "recencyScore" | "frequencyScore" | "monetaryScore">) {
  const { recencyScore, frequencyScore, monetaryScore } = client;

  if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) return "Campeoes";
  if (recencyScore >= 4 && frequencyScore >= 3) return "Clientes fieis";
  if (recencyScore >= 4 && frequencyScore <= 2) return "Novos e recentes";
  if (recencyScore === 3 && frequencyScore >= 3) return "Promissores";
  if (recencyScore <= 2 && frequencyScore >= 4) return "Em risco";
  if (recencyScore <= 2 && frequencyScore <= 2) return "Hibernando";
  if (monetaryScore >= 4) return "Valiosos";
  return "Estaveis";
}

function deriveActivityDate(item: Contrato) {
  return safeDate(item.ultimoContato) || safeDate(item.entrega) || safeDate(item.convite) || safeDate(item.updatedAt);
}

function deriveMonetaryValue(item: Contrato) {
  const total = safeNumber(item.total);
  if (total > 0) return total;
  const valor = safeNumber(item.valor);
  if (valor > 0) return valor;
  const monthly = safeNumber(item.mediaMensal);
  if (monthly > 0) return monthly;
  return 0;
}

function findGridKey(columns: GridColumn[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((alias) => normalizeLoose(alias)));

  for (const column of columns) {
    if (aliasSet.has(normalizeLoose(column.label))) return column.key;
  }
  for (const column of columns) {
    if (aliasSet.has(normalizeLoose(column.key))) return column.key;
  }

  return null;
}

function pickGridDataValue(data: Record<string, any>, keys: Array<string | null>) {
  for (const key of keys) {
    if (!key) continue;
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== "" && String(value).trim() !== "-") {
      return value;
    }
  }

  const normalized = new Map<string, any>();
  for (const [key, value] of Object.entries(data || {})) {
    normalized.set(normalizeLoose(key), value);
  }

  for (const key of keys) {
    if (!key) continue;
    const value = normalized.get(normalizeLoose(key));
    if (value !== undefined && value !== null && String(value).trim() !== "" && String(value).trim() !== "-") {
      return value;
    }
  }

  return null;
}

function asOptionalText(value: unknown) {
  const text = compactText(value);
  return text === "-" ? null : text;
}

function asOptionalIsoDate(value: unknown) {
  if (!value) return null;
  const date = safeDate(value);
  if (date) return date.toISOString();
  const text = compactText(value);
  return text === "-" ? null : text;
}

function asOptionalNumber(value: unknown) {
  const number = safeNumber(value);
  return number === 0 ? null : number;
}

function mapGridRowToContrato(row: GridRow, columns: GridColumn[]): Contrato {
  const data = (row.data || {}) as Record<string, any>;

  const clienteKey = findGridKey(columns, ["cliente", "clientes"]);
  const statusKey = findGridKey(columns, ["status", "situacao"]);
  const tipoServicoKey = findGridKey(columns, ["tipo de servico", "tipo_servico", "tipo_de_servico"]);
  const totalKey = findGridKey(columns, ["total"]);
  const valorKey = findGridKey(columns, ["valor"]);
  const mediaMensalKey = findGridKey(columns, ["media mensal", "media_mensal"]);
  const anoKey = findGridKey(columns, ["ano"]);
  const ultimoContatoKey = findGridKey(columns, ["ultimo contato", "ultimo_contato"]);
  const entregaKey = findGridKey(columns, ["entrega"]);
  const conviteKey = findGridKey(columns, ["convite"]);
  const grupoKey = findGridKey(columns, ["grupo"]);
  const projetoKey = findGridKey(columns, ["nome do projeto e local", "nome_do_projeto_e_local", "descricao"]);
  const followUpKey = findGridKey(columns, ["follow up", "follow_up"]);
  const numeroKey = findGridKey(columns, ["n", "numero"]);
  const responsavelKey = findGridKey(columns, ["resp", "responsavel"]);
  const contatoKey = findGridKey(columns, ["contatos", "contato_empresa", "contato"]);
  const prazoMesKey = findGridKey(columns, ["prazo (mes)", "prazo_mes"]);
  const goKey = findGridKey(columns, ["go"]);
  const observacoesKey = findGridKey(columns, ["observacoes", "observacao"]);
  const certidaoKey = findGridKey(columns, ["certidao"]);

  const numeroValue = pickGridDataValue(data, [numeroKey, "n", "numero"]);
  const numero = Math.trunc(safeNumber(numeroValue)) || row.rowNumber || 0;
  const anoValue = Math.trunc(safeNumber(pickGridDataValue(data, [anoKey, "ano"])));
  const prazoMesValue = Math.trunc(safeNumber(pickGridDataValue(data, [prazoMesKey, "prazo_mes"])));

  return {
    numero,
    ordemDataEntrega: null,
    followUp: asOptionalText(pickGridDataValue(data, [followUpKey, "follow_up"])),
    grupo: asOptionalText(pickGridDataValue(data, [grupoKey, "grupo"])),
    convite: asOptionalIsoDate(pickGridDataValue(data, [conviteKey, "convite"])),
    ano: anoValue || null,
    entrega: asOptionalIsoDate(pickGridDataValue(data, [entregaKey, "entrega"])),
    ultimoContato: asOptionalIsoDate(pickGridDataValue(data, [ultimoContatoKey, "ultimo_contato"])),
    nomeProjetoLocal: asOptionalText(pickGridDataValue(data, [projetoKey, "nome_do_projeto_e_local", "descricao"])),
    cliente: asOptionalText(pickGridDataValue(data, [clienteKey, "cliente", "clientes"])),
    tipoServico: asOptionalText(pickGridDataValue(data, [tipoServicoKey, "tipo_de_servico", "tipo_servico"])),
    resp: asOptionalText(pickGridDataValue(data, [responsavelKey, "resp"])),
    status: asOptionalText(pickGridDataValue(data, [statusKey, "status"])),
    contatos: asOptionalText(pickGridDataValue(data, [contatoKey, "contatos"])),
    valor: asOptionalNumber(pickGridDataValue(data, [valorKey, "valor"])),
    prazoMes: prazoMesValue || null,
    go: asOptionalText(pickGridDataValue(data, [goKey, "go"])),
    observacoes: asOptionalText(pickGridDataValue(data, [observacoesKey, "observacoes", "observacao"])),
    certidao: asOptionalText(pickGridDataValue(data, [certidaoKey, "certidao"])),
    mediaMensal: asOptionalNumber(pickGridDataValue(data, [mediaMensalKey, "media_mensal"])),
    total: asOptionalNumber(pickGridDataValue(data, [totalKey, "total"])),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildDistribution<T>(
  items: T[],
  getLabel: (item: T) => string,
  options?: { limit?: number; skipDash?: boolean }
) {
  const limit = options?.limit ?? 8;
  const skipDash = options?.skipDash ?? false;
  const buckets = new Map<string, number>();

  for (const item of items) {
    const label = compactText(getLabel(item));
    if (skipDash && label === "-") continue;
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildClientRfm(contracts: Contrato[], referenceDate: Date) {
  const grouped = new Map<
    string,
    {
      name: string;
      frequency: number;
      monetary: number;
      lastActivity: Date | null;
    }
  >();

  for (const contract of contracts) {
    const rawClient = compactText(contract.cliente);
    if (rawClient === "-") continue;

    const current = grouped.get(rawClient) || {
      name: rawClient,
      frequency: 0,
      monetary: 0,
      lastActivity: null,
    };

    const activityDate = deriveActivityDate(contract);
    current.frequency += 1;
    current.monetary += deriveMonetaryValue(contract);
    if (activityDate && (!current.lastActivity || activityDate.getTime() > current.lastActivity.getTime())) {
      current.lastActivity = activityDate;
    }

    grouped.set(rawClient, current);
  }

  const clients = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    recencyDays: daysBetween(referenceDate, entry.lastActivity),
  }));

  if (!clients.length) return [];

  const recencyScore = buildScoreAssigner(clients.map((client) => client.recencyDays), "desc");
  const frequencyScore = buildScoreAssigner(clients.map((client) => client.frequency), "asc");
  const monetaryScore = buildScoreAssigner(clients.map((client) => client.monetary), "asc");

  return clients
    .map((client) => {
      const next: ClientRfm = {
        ...client,
        recencyScore: recencyScore(client.recencyDays),
        frequencyScore: frequencyScore(client.frequency),
        monetaryScore: monetaryScore(client.monetary),
        rfmCode: "",
        segment: "",
      };

      next.rfmCode = `${next.recencyScore}${next.frequencyScore}${next.monetaryScore}`;
      next.segment = buildRfmSegment(next);
      return next;
    })
    .sort((a, b) => b.monetary - a.monetary);
}

function SummaryCard({
  tone,
  icon: Icon,
  label,
  value,
  text,
}: {
  tone: SummaryCardTone;
  icon: LucideIcon;
  label: string;
  value: string | number;
  text: string;
}) {
  return (
    <div className="graphs-summary-card" data-tone={tone}>
      <div className="graphs-summary-label">{label}</div>
      <div className="graphs-summary-value">
        <span className="graphs-summary-icon">
          <Icon size={17} />
        </span>
        <span>{value}</span>
      </div>
      <div className="graphs-summary-text">{text}</div>
    </div>
  );
}

function HorizontalBars({
  title,
  description,
  items,
  valueFormatter,
  selectedLabel,
  onSelect,
  emptyTitle,
  emptyText,
}: {
  title: string;
  description: string;
  items: DistributionItem[];
  valueFormatter: (value: number) => string;
  selectedLabel?: string | null;
  onSelect?: (label: string | null) => void;
  emptyTitle: string;
  emptyText: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0) || 1;

  return (
    <div className="graphs-block">
      <div className="graphs-block-head">
        <div>
          <div className="graphs-block-title">{title}</div>
          <div className="graphs-block-desc">{description}</div>
        </div>
        {selectedLabel ? <span className="badge">Filtro: {selectedLabel}</span> : null}
      </div>

      {items.length === 0 ? (
        <EmptyState compact title={emptyTitle} text={emptyText} />
      ) : (
        <div className="graphs-bar-stack">
          {items.map((item) => {
            const active = selectedLabel === item.label;
            const className = `graphs-bar-row ${active ? "is-active" : ""} ${onSelect ? "is-clickable" : ""}`;
            const content = (
              <>
                <div className="graphs-bar-label">{item.label}</div>
                <div className="graphs-bar-track">
                  <div className="graphs-bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
                </div>
                <div className="graphs-bar-value">{valueFormatter(item.value)}</div>
              </>
            );

            if (!onSelect) {
              return (
                <div key={item.label} className={className}>
                  {content}
                </div>
              );
            }

            return (
              <button
                key={item.label}
                className={className}
                onClick={() => onSelect(active ? null : item.label)}
                type="button"
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Graficos() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Preparando leitura...");
  const [dataSource, setDataSource] = useState<DataSource>("none");
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedHeatCell, setSelectedHeatCell] = useState<HeatCell | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [rankingMode, setRankingMode] = useState<RankingMode>("monetary");

  function notify(type: ToastMsg["type"], title: string, text: string) {
    setToast({ id: safeUUID(), type, title, text });
  }

  async function loadAllContracts() {
    setLoading(true);
    setLoadingText("Carregando base de contratos...");

    try {
      const pageSize = 200;
      const firstContractsPage = await listContratos({ page: 1, pageSize });
      const contractItems = [...(firstContractsPage.items || [])];

      if ((firstContractsPage.total || 0) > 0) {
        setLoadingText(`Carregando contratos ${contractItems.length} de ${firstContractsPage.total}...`);

        let page = 2;
        while (contractItems.length < firstContractsPage.total) {
          const response = await listContratos({ page, pageSize });
          contractItems.push(...(response.items || []));
          setLoadingText(`Carregando contratos ${contractItems.length} de ${firstContractsPage.total}...`);

          if (!(response.items || []).length) break;
          page += 1;
        }

        setContracts(contractItems);
        setDataSource("contratos");
        return;
      }

      setLoadingText("Tabela de contratos vazia. Lendo o grid CONTRATOS...");
      const firstGridPage = await fetchGrid({ sheet: "CONTRATOS", page: 1, pageSize });
      const columns = firstGridPage.columns || [];
      const gridRows = [...(firstGridPage.rows || [])];
      const totalGridRows = firstGridPage.total || gridRows.length;

      let page = 2;
      while (gridRows.length < totalGridRows) {
        const response = await fetchGrid({ sheet: "CONTRATOS", page, pageSize });
        gridRows.push(...(response.rows || []));
        setLoadingText(`Carregando grid CONTRATOS ${gridRows.length} de ${totalGridRows}...`);

        if (!(response.rows || []).length) break;
        page += 1;
      }

      const mappedContracts = gridRows.map((row) => mapGridRowToContrato(row, columns));
      setContracts(mappedContracts);
      setDataSource(mappedContracts.length ? "grid" : "none");
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao carregar a base para os graficos.");
      setContracts([]);
      setDataSource("none");
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSelectedSegment(null);
    setSelectedHeatCell(null);
    setSelectedYear(null);
    setSelectedStatus(null);
    setSelectedService(null);
    setClientSearch("");
  }

  useEffect(() => {
    void loadAllContracts();
  }, []);

  const referenceDate = useMemo(() => new Date(), []);
  const searchTerm = clientSearch.trim();

  const availableYears = useMemo(
    () =>
      Array.from(new Set(contracts.map((contract) => contract.ano).filter((value): value is number => Number.isFinite(value))))
        .sort((a, b) => b - a)
        .map((year) => String(year)),
    [contracts]
  );

  const analysisContracts = useMemo(
    () =>
      contracts.filter((contract) => {
        if (selectedYear && String(contract.ano || "") !== selectedYear) return false;
        if (selectedStatus && compactText(contract.status) !== selectedStatus) return false;
        if (selectedService && compactText(contract.tipoServico) !== selectedService) return false;
        return true;
      }),
    [contracts, selectedService, selectedStatus, selectedYear]
  );

  const analysisClientRfm = useMemo(() => buildClientRfm(analysisContracts, referenceDate), [analysisContracts, referenceDate]);
  const rfmSegments = useMemo(() => buildDistribution(analysisClientRfm, (client) => client.segment, { limit: 8 }), [analysisClientRfm]);

  const rfmHeatmap = useMemo<HeatCell[]>(() => {
    const cells: HeatCell[] = [];

    for (let recencyScore = 5; recencyScore >= 1; recencyScore -= 1) {
      for (let frequencyScore = 1; frequencyScore <= 5; frequencyScore += 1) {
        const count = analysisClientRfm.filter(
          (client) => client.recencyScore === recencyScore && client.frequencyScore === frequencyScore
        ).length;
        cells.push({ recencyScore, frequencyScore, count });
      }
    }

    return cells;
  }, [analysisClientRfm]);

  const maxHeatCount = useMemo(() => Math.max(...rfmHeatmap.map((cell) => cell.count), 0) || 1, [rfmHeatmap]);
  const hasClientFocus = Boolean(searchTerm || selectedSegment || selectedHeatCell);

  const viewClients = useMemo(
    () =>
      analysisClientRfm.filter((client) => {
        if (searchTerm && !normalizeText(client.name).includes(normalizeText(searchTerm))) return false;
        if (selectedSegment && client.segment !== selectedSegment) return false;
        if (
          selectedHeatCell &&
          (client.recencyScore !== selectedHeatCell.recencyScore ||
            client.frequencyScore !== selectedHeatCell.frequencyScore)
        ) {
          return false;
        }
        return true;
      }),
    [analysisClientRfm, searchTerm, selectedSegment, selectedHeatCell]
  );

  const viewClientNames = useMemo(() => new Set(viewClients.map((client) => normalizeText(client.name))), [viewClients]);

  const viewContracts = useMemo(() => {
    if (!hasClientFocus) return analysisContracts;

    return analysisContracts.filter((contract) => {
      const clientName = compactText(contract.cliente);
      if (clientName === "-") return false;
      return viewClientNames.has(normalizeText(clientName));
    });
  }, [analysisContracts, hasClientFocus, viewClientNames]);

  const statusDistribution = useMemo(
    () => buildDistribution(viewContracts, (contract) => compactText(contract.status), { limit: 8 }),
    [viewContracts]
  );

  const serviceDistribution = useMemo(
    () => buildDistribution(viewContracts, (contract) => compactText(contract.tipoServico), { limit: 6, skipDash: true }),
    [viewContracts]
  );

  const revenueByYear = useMemo(() => {
    const buckets = new Map<number, number>();

    for (const contract of viewContracts) {
      if (!contract.ano) continue;
      buckets.set(contract.ano, (buckets.get(contract.ano) || 0) + deriveMonetaryValue(contract));
    }

    return Array.from(buckets.entries())
      .map(([year, value]) => ({ label: String(year), value }))
      .sort((a, b) => Number(a.label) - Number(b.label));
  }, [viewContracts]);

  const totalRevenue = useMemo(() => viewContracts.reduce((sum, contract) => sum + deriveMonetaryValue(contract), 0), [viewContracts]);
  const averageTicket = useMemo(() => (viewContracts.length ? totalRevenue / viewContracts.length : 0), [viewContracts.length, totalRevenue]);

  const latestActivity = useMemo(() => {
    const dates = viewContracts.map(deriveActivityDate).filter((value): value is Date => value instanceof Date);
    if (!dates.length) return null;
    return dates.sort((a, b) => b.getTime() - a.getTime())[0];
  }, [viewContracts]);

  const spotlightClient = useMemo(() => {
    if (!viewClients.length) return null;
    const clients = [...viewClients];

    if (rankingMode === "frequency") {
      clients.sort((a, b) => b.frequency - a.frequency || b.monetary - a.monetary);
      return clients[0];
    }

    if (rankingMode === "recency") {
      clients.sort((a, b) => b.recencyScore - a.recencyScore || a.recencyDays - b.recencyDays || b.monetary - a.monetary);
      return clients[0];
    }

    return clients[0];
  }, [rankingMode, viewClients]);

  const rankingItems = useMemo<LeaderboardItem[]>(() => {
    const clients = [...viewClients];

    if (rankingMode === "frequency") {
      clients.sort((a, b) => b.frequency - a.frequency || b.monetary - a.monetary);
    } else if (rankingMode === "recency") {
      clients.sort((a, b) => b.recencyScore - a.recencyScore || a.recencyDays - b.recencyDays || b.monetary - a.monetary);
    }

    return clients.slice(0, 6).map((client) => {
      if (rankingMode === "frequency") {
        return {
          label: client.name,
          rawValue: Math.max(client.frequency, 1),
          value: `${client.frequency} contrato(s)`,
          meta: `Ultima atividade ${formatDate(client.lastActivity)} | RFM ${client.rfmCode}`,
        };
      }

      if (rankingMode === "recency") {
        return {
          label: client.name,
          rawValue: Math.max(client.recencyScore, 1),
          value: `${client.recencyDays} dia(s)`,
          meta: `${client.segment} | Score R ${client.recencyScore}`,
        };
      }

      return {
        label: client.name,
        rawValue: Math.max(client.monetary, 1),
        value: formatCurrency(client.monetary),
        meta: `${client.segment} | RFM ${client.rfmCode}`,
      };
    });
  }, [rankingMode, viewClients]);

  const maxRankingValue = useMemo(() => Math.max(...rankingItems.map((entry) => entry.rawValue), 0) || 1, [rankingItems]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (selectedYear) labels.push(`Ano ${selectedYear}`);
    if (selectedStatus) labels.push(`Status ${selectedStatus}`);
    if (selectedService) labels.push(`Servico ${selectedService}`);
    if (selectedSegment) labels.push(`Segmento ${selectedSegment}`);
    if (selectedHeatCell) labels.push(`R${selectedHeatCell.recencyScore} x F${selectedHeatCell.frequencyScore}`);
    if (searchTerm) labels.push(`Busca ${searchTerm}`);
    return labels;
  }, [searchTerm, selectedHeatCell, selectedSegment, selectedService, selectedStatus, selectedYear]);

  const focusTitle = activeFilterLabels.length ? "Base refinada em tempo real" : "Panorama geral da carteira";
  const focusText = activeFilterLabels.length
    ? "Os graficos abaixo estao reagindo aos filtros e cliques que voce fez nesta tela."
    : "Clique em segmentos, barras, anos e servicos para refinar a leitura sem sair da aba.";
  const dominantStatus = statusDistribution[0]?.label || "-";
  const dominantService = serviceDistribution[0]?.label || "-";
  const championCount = rfmSegments.find((segment) => segment.label === "Campeoes")?.value || 0;
  const riskCount = rfmSegments.find((segment) => segment.label === "Em risco")?.value || 0;
  const hibernatingCount = rfmSegments.find((segment) => segment.label === "Hibernando")?.value || 0;

  const rankingTitle =
    rankingMode === "frequency"
      ? "Clientes mais frequentes"
      : rankingMode === "recency"
      ? "Clientes mais recentes"
      : "Top clientes por valor";

  const rankingDescription =
    rankingMode === "frequency"
      ? "Muda a leitura para quem aparece mais vezes na base atual."
      : rankingMode === "recency"
      ? "Mostra quem teve contato mais recente no recorte escolhido."
      : "Prioriza quem concentra mais valor financeiro neste momento.";

  const canResetFilters = activeFilterLabels.length > 0;

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <motion.section className="page-hero graphs-hero" variants={item}>
        <div className="graphs-hero-grid">
          <div className="space-y-4">
            <div>
              <div className="page-kicker">Analise visual interativa</div>
              <h1 className="page-title inline-flex items-center gap-2">
                <BarChart3 size={22} />
                Graficos
              </h1>
              <p className="page-desc">
                A carteira agora responde a cliques e filtros na propria tela, com destaque dinamico para RFM, receita,
                status e servicos.
              </p>
            </div>

            <div className="graphs-hero-chip-row">
              <span className="graphs-hero-chip">
                <BriefcaseBusiness size={14} />
                Contratos na tela: {formatCompactNumber(viewContracts.length)} / {formatCompactNumber(contracts.length)}
              </span>
              <span className="graphs-hero-chip">
                <Users size={14} />
                Clientes em foco: {formatCompactNumber(viewClients.length)} / {formatCompactNumber(analysisClientRfm.length)}
              </span>
              <span className="graphs-hero-chip">
                <Filter size={14} />
                Filtros ativos: {activeFilterLabels.length}
              </span>
              <span className="graphs-hero-chip">
                <CalendarRange size={14} />
                Ultima atividade: {formatDate(latestActivity)}
              </span>
              <span className="graphs-hero-chip">
                <PieChart size={14} />
                Origem: {dataSource === "contratos" ? "Tabela contratos" : dataSource === "grid" ? "Grid CONTRATOS" : "Sem base"}
              </span>
            </div>
          </div>

          <div className="graphs-hero-side">
            <div className="graphs-hero-side-card">
              <div className="graphs-side-label">Base carregada</div>
              <div className="graphs-side-value">{loading ? loadingText : `${contracts.length} registros processados`}</div>
              <div className="graphs-side-text">
                {dataSource === "contratos"
                  ? "A leitura esta usando a tabela principal de contratos."
                  : dataSource === "grid"
                  ? "A tabela de contratos esta vazia, entao a tela usa o grid CONTRATOS como base."
                  : "Aguardando uma base valida para montar os graficos."}
              </div>
            </div>

            <div className="graphs-hero-actions">
              <button className="btn btn-primary" onClick={() => void loadAllContracts()} type="button">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Atualizar graficos
              </button>
              {canResetFilters ? (
                <button className="graphs-ghost-button" onClick={clearFilters} type="button">
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={item}>
        <SummaryCard
          tone="slate"
          icon={BarChart3}
          label="Receita na visao"
          value={formatCurrency(totalRevenue)}
          text="Leitura calculada sobre o recorte atual, somando total, valor ou media mensal"
        />
        <SummaryCard
          tone="teal"
          icon={Users}
          label="Base RFM ativa"
          value={viewClients.length}
          text="Clientes que continuam visiveis apos os filtros e selecoes interativas"
        />
        <SummaryCard
          tone="amber"
          icon={TrendingUp}
          label="Ticket medio"
          value={formatCurrency(averageTicket)}
          text="Media financeira por contrato dentro da visao que esta em tela"
        />
        <SummaryCard
          tone="indigo"
          icon={Crown}
          label="Cliente lider"
          value={spotlightClient?.name || "-"}
          text={spotlightClient ? `RFM ${spotlightClient.rfmCode} | ${formatCurrency(spotlightClient.monetary)}` : "Sem lideranca calculada"}
        />
      </motion.div>

      {loading ? (
        <motion.div className="panel-soft" variants={item}>
          <EmptyState title="Gerando os graficos" text={loadingText} compact />
        </motion.div>
      ) : contracts.length === 0 ? (
        <motion.div className="panel-soft" variants={item}>
          <EmptyState
            title="Sem registros para analisar"
            text="Nem a tabela de contratos nem o grid CONTRATOS trouxeram dados suficientes para montar os graficos."
          />
        </motion.div>
      ) : analysisContracts.length === 0 ? (
        <motion.div className="panel-soft space-y-4" variants={item}>
          <EmptyState
            title="Nenhum registro neste recorte"
            text="Os filtros atuais zeraram a visao. Limpe os filtros para voltar ao panorama completo."
            compact
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={clearFilters} type="button">
              Limpar filtros
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.section className="graphs-explorer-grid" variants={item}>
            <div className="graphs-block graphs-explorer-panel">
              <div className="graphs-block-head">
                <div>
                  <div className="graphs-block-kicker">Exploracao guiada</div>
                  <div className="graphs-block-title-lg">Filtre sem sair da tela</div>
                  <div className="graphs-block-desc">
                    Use busca por cliente, anos e os proprios graficos para navegar pela carteira.
                  </div>
                </div>
              </div>

              <div className="graphs-search-shell">
                <Search size={16} />
                <input
                  className="graphs-search-input"
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Buscar cliente por nome..."
                  type="text"
                  value={clientSearch}
                />
              </div>

              <div className="graphs-filter-group">
                <div className="graphs-filter-label">Ano</div>
                <div className="graphs-filter-row">
                  <button
                    className={`graphs-filter-pill ${selectedYear === null ? "is-active" : ""}`}
                    onClick={() => setSelectedYear(null)}
                    type="button"
                  >
                    Todos
                  </button>
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      className={`graphs-filter-pill ${selectedYear === year ? "is-active" : ""}`}
                      onClick={() => setSelectedYear(selectedYear === year ? null : year)}
                      type="button"
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              <div className="graphs-filter-note">
                Clique tambem em qualquer barra, servico, segmento ou celula da matriz para continuar refinando a analise.
              </div>
            </div>

            <div className="graphs-block graphs-focus-panel">
              <div className="graphs-focus-kicker">Painel ativo</div>
              <div className="graphs-focus-title">{focusTitle}</div>
              <div className="graphs-focus-text">{focusText}</div>

              <div className="graphs-focus-metrics">
                <div className="graphs-focus-metric">
                  <span className="graphs-focus-metric-label">Contratos</span>
                  <strong>{formatCompactNumber(viewContracts.length)}</strong>
                  <span>{formatCompactNumber(analysisContracts.length)} no recorte base</span>
                </div>
                <div className="graphs-focus-metric">
                  <span className="graphs-focus-metric-label">Clientes</span>
                  <strong>{formatCompactNumber(viewClients.length)}</strong>
                  <span>{formatCompactNumber(analysisClientRfm.length)} avaliados no RFM</span>
                </div>
                <div className="graphs-focus-metric">
                  <span className="graphs-focus-metric-label">Receita</span>
                  <strong>{formatCurrency(totalRevenue)}</strong>
                  <span>Status lider: {dominantStatus}</span>
                </div>
              </div>

              <div className="graphs-active-tags">
                {activeFilterLabels.length ? (
                  activeFilterLabels.map((label) => (
                    <span key={label} className="graphs-active-tag">
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="graphs-empty-tag">Sem filtros manuais. A tela esta no modo panorama.</span>
                )}
              </div>
            </div>
          </motion.section>

          <motion.section className="graphs-layout graphs-layout-rfm" variants={item}>
            <div className="graphs-block graphs-block-hero">
              <div className="graphs-block-head">
                <div>
                  <div className="graphs-block-kicker">Matriz RFM</div>
                  <div className="graphs-block-title-lg">Recencia x Frequencia</div>
                  <div className="graphs-block-desc">
                    As celulas agora sao clicaveis. Selecione um quadrante para isolar clientes com a mesma combinacao de score.
                  </div>
                </div>
                <div className="graphs-head-actions">
                  {selectedHeatCell ? (
                    <span className="badge">Foco: R{selectedHeatCell.recencyScore} x F{selectedHeatCell.frequencyScore}</span>
                  ) : null}
                  <span className="badge">Maior celula: {maxHeatCount}</span>
                </div>
              </div>

              <div className="graphs-rfm-grid-wrap">
                <div className="graphs-rfm-axis graphs-rfm-axis-y">Recencia</div>
                <div className="graphs-rfm-matrix">
                  <div className="graphs-rfm-columns">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <span key={`f-head-${score}`}>{score}</span>
                    ))}
                  </div>

                  {[5, 4, 3, 2, 1].map((recencyScore) => (
                    <div key={`rfm-row-${recencyScore}`} className="graphs-rfm-row">
                      <span className="graphs-rfm-row-label">{recencyScore}</span>
                      {[1, 2, 3, 4, 5].map((frequencyScore) => {
                        const cell =
                          rfmHeatmap.find(
                            (entry) =>
                              entry.recencyScore === recencyScore && entry.frequencyScore === frequencyScore
                          ) || null;
                        const opacity = cell ? Math.max(0.12, cell.count / maxHeatCount) : 0.08;
                        const active =
                          selectedHeatCell?.recencyScore === recencyScore &&
                          selectedHeatCell?.frequencyScore === frequencyScore;

                        return (
                          <button
                            key={`rfm-${recencyScore}-${frequencyScore}`}
                            className={`graphs-rfm-cell ${active ? "is-active" : ""}`}
                            onClick={() =>
                              setSelectedHeatCell(
                                active ? null : { recencyScore, frequencyScore, count: cell?.count || 0 }
                              )
                            }
                            style={{ background: `rgba(15, 118, 110, ${opacity})` }}
                            title={`Recencia ${recencyScore} | Frequencia ${frequencyScore} | ${cell?.count || 0} cliente(s)`}
                            type="button"
                          >
                            <strong>{cell?.count || 0}</strong>
                            <span>
                              R{recencyScore} F{frequencyScore}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  <div className="graphs-rfm-axis-x">Frequencia</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="graphs-block">
                <div className="graphs-block-head">
                  <div>
                    <div className="graphs-block-title">Segmentos RFM</div>
                    <div className="graphs-block-desc">
                      Clique em um segmento para ver a carteira reagir em tempo real.
                    </div>
                  </div>
                  {selectedSegment ? <span className="badge">Foco: {selectedSegment}</span> : null}
                </div>

                <div className="graphs-segment-stack">
                  {rfmSegments.length === 0 ? (
                    <EmptyState compact title="Sem segmentacao" text="Ainda nao foi possivel montar os grupos RFM." />
                  ) : (
                    rfmSegments.map((segment) => {
                      const width = (segment.value / Math.max(...rfmSegments.map((entry) => entry.value), 1)) * 100;
                      const active = selectedSegment === segment.label;

                      return (
                        <button
                          key={segment.label}
                          className={`graphs-segment-row ${active ? "is-active" : ""}`}
                          onClick={() => setSelectedSegment(active ? null : segment.label)}
                          type="button"
                        >
                          <div className="graphs-segment-head">
                            <span>{segment.label}</span>
                            <strong>{segment.value}</strong>
                          </div>
                          <div className="graphs-segment-track">
                            <div className="graphs-segment-fill" style={{ width: `${width}%` }} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="graphs-block">
                <div className="graphs-block-head">
                  <div>
                    <div className="graphs-block-title inline-flex items-center gap-2">
                      <Target size={15} />
                      Radar do foco atual
                    </div>
                    <div className="graphs-block-desc">
                      Um resumo rapido do recorte que voce montou com cliques e filtros.
                    </div>
                  </div>
                </div>

                <div className="graphs-insight-list">
                  <div className="graphs-insight">
                    <span className="graphs-insight-label">Clientes campeoes</span>
                    <strong>{championCount}</strong>
                  </div>
                  <div className="graphs-insight">
                    <span className="graphs-insight-label">Clientes em risco</span>
                    <strong>{riskCount}</strong>
                  </div>
                  <div className="graphs-insight">
                    <span className="graphs-insight-label">Clientes hibernando</span>
                    <strong>{hibernatingCount}</strong>
                  </div>
                </div>

                <div className="graphs-spotlight-card">
                  <div className="graphs-spotlight-kicker">Cliente destaque</div>
                  <div className="graphs-spotlight-title">{spotlightClient?.name || "Sem destaque"}</div>
                  <div className="graphs-spotlight-meta">
                    {spotlightClient
                      ? `${spotlightClient.segment} | RFM ${spotlightClient.rfmCode} | Ultima atividade ${formatDate(spotlightClient.lastActivity)}`
                      : "Ajuste os filtros para encontrar um cliente em foco."}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section className="grid grid-cols-1 gap-4 xl:grid-cols-2" variants={item}>
            <div className="graphs-block">
              <div className="graphs-block-head">
                <div>
                  <div className="graphs-block-title">{rankingTitle}</div>
                  <div className="graphs-block-desc">{rankingDescription}</div>
                </div>
              </div>

              <div className="graphs-mode-switch">
                <button
                  className={`graphs-mode-pill ${rankingMode === "monetary" ? "is-active" : ""}`}
                  onClick={() => setRankingMode("monetary")}
                  type="button"
                >
                  Valor
                </button>
                <button
                  className={`graphs-mode-pill ${rankingMode === "frequency" ? "is-active" : ""}`}
                  onClick={() => setRankingMode("frequency")}
                  type="button"
                >
                  Frequencia
                </button>
                <button
                  className={`graphs-mode-pill ${rankingMode === "recency" ? "is-active" : ""}`}
                  onClick={() => setRankingMode("recency")}
                  type="button"
                >
                  Recencia
                </button>
              </div>

              {rankingItems.length === 0 ? (
                <EmptyState
                  compact
                  title="Sem clientes visiveis"
                  text="Os filtros atuais removeram todos os clientes do ranking."
                />
              ) : (
                <div className="graphs-leaderboard">
                  {rankingItems.map((entry) => (
                    <div key={entry.label} className="graphs-leader-row">
                      <div className="graphs-leader-head">
                        <div>
                          <div className="graphs-leader-name">{entry.label}</div>
                          <div className="graphs-leader-meta">{entry.meta}</div>
                        </div>
                        <strong className="graphs-leader-value">{entry.value}</strong>
                      </div>
                      <div className="graphs-leader-track">
                        <div className="graphs-leader-fill" style={{ width: `${(entry.rawValue / maxRankingValue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <HorizontalBars
              title="Status mais presentes"
              description="Clique em um status para filtrar toda a leitura atual."
              emptyText="A base atual ainda nao permite montar esta leitura."
              emptyTitle="Sem dados para este grafico"
              items={statusDistribution}
              onSelect={setSelectedStatus}
              selectedLabel={selectedStatus}
              valueFormatter={(value) => `${value} contrato(s)`}
            />
          </motion.section>

          <motion.section className="grid grid-cols-1 gap-4 xl:grid-cols-2" variants={item}>
            <div className="graphs-block">
              <div className="graphs-block-head">
                <div>
                  <div className="graphs-block-title inline-flex items-center gap-2">
                    <LineChart size={15} />
                    Receita por ano
                  </div>
                  <div className="graphs-block-desc">
                    As colunas tambem filtram a tela. Clique em um ano para isolar o recorte.
                  </div>
                </div>
                {selectedYear ? <span className="badge">Ano: {selectedYear}</span> : null}
              </div>

              {revenueByYear.length === 0 ? (
                <EmptyState compact title="Sem serie anual" text="Nao existem anos preenchidos o suficiente para este grafico." />
              ) : (
                <div className="graphs-year-bars">
                  {revenueByYear.map((entry) => {
                    const maxValue = Math.max(...revenueByYear.map((item) => item.value), 1);
                    const height = Math.max(18, (entry.value / maxValue) * 180);
                    const active = selectedYear === entry.label;
                    return (
                      <button
                        key={entry.label}
                        className={`graphs-year-bar-item ${active ? "is-active" : ""}`}
                        onClick={() => setSelectedYear(active ? null : entry.label)}
                        type="button"
                      >
                        <div className="graphs-year-bar-value">{formatCompactNumber(entry.value)}</div>
                        <div className="graphs-year-bar-track">
                          <div className="graphs-year-bar-fill" style={{ height }} />
                        </div>
                        <div className="graphs-year-bar-label">{entry.label}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="graphs-block">
              <div className="graphs-block-head">
                <div>
                  <div className="graphs-block-title inline-flex items-center gap-2">
                    <PieChart size={15} />
                    Tipos de servico
                  </div>
                  <div className="graphs-block-desc">
                    O ranking agora tambem funciona como filtro rapido para a carteira.
                  </div>
                </div>
                {selectedService ? <span className="badge">Servico: {selectedService}</span> : null}
              </div>

              {serviceDistribution.length === 0 ? (
                <EmptyState compact title="Sem tipos de servico" text="Os contratos atuais ainda nao trazem esse agrupamento." />
              ) : (
                <div className="graphs-service-list">
                  {serviceDistribution.map((entry, index) => {
                    const total = serviceDistribution.reduce((sum, item) => sum + item.value, 0) || 1;
                    const percent = Math.round((entry.value / total) * 100);
                    const active = selectedService === entry.label;

                    return (
                      <button
                        key={entry.label}
                        className={`graphs-service-item ${active ? "is-active" : ""}`}
                        onClick={() => setSelectedService(active ? null : entry.label)}
                        type="button"
                      >
                        <div className="graphs-service-rank">{String(index + 1).padStart(2, "0")}</div>
                        <div className="graphs-service-body">
                          <div className="graphs-service-head">
                            <span>{entry.label}</span>
                            <strong>{percent}%</strong>
                          </div>
                          <div className="graphs-service-track">
                            <div className="graphs-service-fill" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="graphs-service-caption">
                            {entry.value} contrato(s) | Servico dominante atual: {dominantService}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}
