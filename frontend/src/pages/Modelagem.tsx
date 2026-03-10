import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database } from "lucide-react";
import {
  createCliente,
  createFollowUp,
  createGp,
  deleteFollowUp,
  deleteGp,
  listClientes,
  listFollowUps,
  listGps,
  type Cliente,
  type FollowUp,
  type Gp,
  updateFollowUp,
  updateGp,
} from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { EmptyState, TableSkeletonRows } from "../components/UiStates";
import { safeUUID } from "../utils/uuid";

type TabId = "clientes" | "gps" | "followups";

type GpForm = {
  chave: string;
  grupo: string;
  ano: string;
  clienteId: string;
  os: boolean;
  aditivo: boolean;
  tipoServico: string;
  descricao: string;
};

type FollowUpForm = {
  gpId: string;
  convite: string;
  entrega: string;
  ultimoContato: string;
  status: string;
  valor: string;
};

const emptyGpForm: GpForm = {
  chave: "",
  grupo: "",
  ano: "",
  clienteId: "",
  os: false,
  aditivo: false,
  tipoServico: "",
  descricao: "",
};

const emptyFollowUpForm: FollowUpForm = {
  gpId: "",
  convite: "",
  entrega: "",
  ultimoContato: "",
  status: "",
  valor: "",
};

function toDateInput(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function toNumberOrNull(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
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

function normalizeChave(value: string) {
  return String(value || "").trim().toUpperCase();
}

function isValidChave(value: string) {
  return /^[A-Z0-9]{4}-\d{2}$/.test(value) || /^\d+$/.test(value);
}

function TabButton({
  id,
  label,
  activeTab,
  onClick,
}: {
  id: TabId;
  label: string;
  activeTab: TabId;
  onClick: (id: TabId) => void;
}) {
  const active = id === activeTab;
  return (
    <button className={`btn ${active ? "btn-primary" : ""}`} onClick={() => onClick(id)} type="button">
      {label}
    </button>
  );
}

export default function Modelagem() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const [tab, setTab] = useState<TabId>("clientes");
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [gps, setGps] = useState<Gp[]>([]);
  const [gpsTotal, setGpsTotal] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [loadingBusca, setLoadingBusca] = useState(false);

  const [searchTipo, setSearchTipo] = useState<"chave" | "cliente">("chave");
  const [novoCliente, setNovoCliente] = useState("");
  const [searchChave, setSearchChave] = useState("");
  const [searchClienteNome, setSearchClienteNome] = useState("");
  const [foundGpByChave, setFoundGpByChave] = useState<Gp | null>(null);
  const [foundFollowUps, setFoundFollowUps] = useState<FollowUp[]>([]);
  const [foundClienteNome, setFoundClienteNome] = useState("");
  const [foundClienteGps, setFoundClienteGps] = useState<Gp[]>([]);
  const [foundClienteFollowUps, setFoundClienteFollowUps] = useState<FollowUp[]>([]);

  const [gpEditId, setGpEditId] = useState<number | null>(null);
  const [gpForm, setGpForm] = useState<GpForm>(emptyGpForm);
  const [gpFilterChave, setGpFilterChave] = useState("");
  const [gpFilterGrupo, setGpFilterGrupo] = useState("");
  const [gpFilterAno, setGpFilterAno] = useState("");
  const [gpFilterClienteId, setGpFilterClienteId] = useState("");
  const [gpPage, setGpPage] = useState(1);
  const gpPageSize = 20;

  const [selectedGpId, setSelectedGpId] = useState<number | null>(null);
  const [followFilterStatus, setFollowFilterStatus] = useState("");
  const [followUpEditId, setFollowUpEditId] = useState<number | null>(null);
  const [followUpForm, setFollowUpForm] = useState<FollowUpForm>(emptyFollowUpForm);

  const gpTotalPages = Math.max(1, Math.ceil(gpsTotal / gpPageSize));
  const gpOptions = useMemo(() => {
    const map = new Map<number, Gp>();
    for (const g of gps) map.set(g.id, g);
    if (foundGpByChave) map.set(foundGpByChave.id, foundGpByChave);
    for (const g of foundClienteGps) map.set(g.id, g);
    return Array.from(map.values());
  }, [gps, foundGpByChave, foundClienteGps]);

  const selectedGp = useMemo(() => gpOptions.find((g) => g.id === selectedGpId) || null, [gpOptions, selectedGpId]);

  function notify(type: ToastMsg["type"], title: string, text: string) {
    setToast({ id: safeUUID(), type, title, text });
  }

  async function loadClientes() {
    setLoadingClientes(true);
    try {
      const data = await listClientes();
      setClientes(data);
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao carregar clientes");
    } finally {
      setLoadingClientes(false);
    }
  }

  async function loadGps() {
    setLoadingGps(true);
    try {
      const anoNum = gpFilterAno.trim() ? Number(gpFilterAno) : undefined;
      const clienteNum = gpFilterClienteId.trim() ? Number(gpFilterClienteId) : undefined;
      const data = await listGps({
        chave: gpFilterChave.trim() || undefined,
        grupo: gpFilterGrupo.trim() || undefined,
        ano: Number.isFinite(anoNum as number) ? anoNum : undefined,
        clienteId: Number.isFinite(clienteNum as number) ? clienteNum : undefined,
        page: gpPage,
        pageSize: gpPageSize,
      });
      setGps(data.items || []);
      setGpsTotal(data.total || 0);
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao carregar GPs");
    } finally {
      setLoadingGps(false);
    }
  }

  async function loadFollowUps() {
    setLoadingFollowUps(true);
    try {
      const data = await listFollowUps({
        gpId: selectedGpId ?? undefined,
        status: followFilterStatus.trim() || undefined,
      });
      setFollowUps(data || []);
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao carregar follow-ups");
    } finally {
      setLoadingFollowUps(false);
    }
  }

  async function loadFollowUpsForBusca(gpId: number) {
    const data = await listFollowUps({ gpId });
    setFoundFollowUps(data || []);
  }

  async function loadFollowUpsForCliente(gpsItems: Gp[]) {
    if (!gpsItems.length) {
      setFoundClienteFollowUps([]);
      return;
    }

    const groups = await Promise.all(gpsItems.map((g) => listFollowUps({ gpId: g.id })));
    const merged = groups.flat();
    const dedup = new Map<number, FollowUp>();
    for (const row of merged) dedup.set(row.id, row);

    const ordered = Array.from(dedup.values()).sort((a, b) => {
      const aTime = a.ultimoContato ? new Date(String(a.ultimoContato)).getTime() : 0;
      const bTime = b.ultimoContato ? new Date(String(b.ultimoContato)).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return b.id - a.id;
    });

    setFoundClienteFollowUps(ordered);
  }

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    loadGps();
  }, [gpPage, gpFilterChave, gpFilterGrupo, gpFilterAno, gpFilterClienteId]);

  useEffect(() => {
    loadFollowUps();
  }, [selectedGpId, followFilterStatus]);

  async function handleSearchByChave() {
    const chave = normalizeChave(searchChave);
    if (!isValidChave(chave)) {
      notify("error", "Validacao", "Informe a chave no formato XXXX-NN ou o N.Ã‚Âº da planilha.");
      return;
    }

    setLoadingBusca(true);
    try {
      const data = await listGps({ chave, page: 1, pageSize: 50 });
      const exact = (data.items || []).find((g) => normalizeChave(g.chave) === chave) || null;

      if (!exact) {
        setFoundGpByChave(null);
        setFoundFollowUps([]);
        setFoundClienteNome("");
        setFoundClienteGps([]);
        setFoundClienteFollowUps([]);
        notify("info", "Busca", `Nenhum GP encontrado para a chave ${chave}.`);
        return;
      }

      setFoundGpByChave(exact);
      setFoundClienteNome("");
      setFoundClienteGps([]);
      setFoundClienteFollowUps([]);
      setSelectedGpId(exact.id);
      setFollowUpForm((prev) => ({ ...prev, gpId: String(exact.id) }));
      await loadFollowUpsForBusca(exact.id);
      notify("success", "Busca", `GP ${exact.chave} encontrado.`);
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao buscar chave.");
    } finally {
      setLoadingBusca(false);
    }
  }

  async function handleSearchByCliente() {
    const nome = String(searchClienteNome || "").trim();
    if (nome.length < 2) {
      notify("error", "Validacao", "Informe ao menos 2 caracteres do nome do cliente.");
      return;
    }

    setLoadingBusca(true);
    try {
      const data = await listGps({ clienteNome: nome, page: 1, pageSize: 200 });
      const items = data.items || [];

      if (!items.length) {
        setFoundClienteNome("");
        setFoundClienteGps([]);
        setFoundClienteFollowUps([]);
        setFoundGpByChave(null);
        setFoundFollowUps([]);
        notify("info", "Busca", `Nenhum GP encontrado para cliente contendo "${nome}".`);
        return;
      }

      const clienteNome = items[0]?.cliente?.nome || nome;
      setFoundClienteNome(clienteNome);
      setFoundClienteGps(items);
      setFoundGpByChave(null);
      setFoundFollowUps([]);
      await loadFollowUpsForCliente(items);
      notify("success", "Busca", `${items.length} GP(s) encontrados para ${clienteNome}.`);
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao buscar cliente.");
    } finally {
      setLoadingBusca(false);
    }
  }

  function clearSearchByChave() {
    setSearchChave("");
    setSearchClienteNome("");
    setFoundGpByChave(null);
    setFoundFollowUps([]);
    setFoundClienteNome("");
    setFoundClienteGps([]);
    setFoundClienteFollowUps([]);
  }

  async function handleCreateCliente() {
    const nome = novoCliente.trim();
    if (!nome) {
      notify("error", "Validacao", "Informe o nome do cliente.");
      return;
    }
    try {
      await createCliente(nome);
      setNovoCliente("");
      await loadClientes();
      notify("success", "Cliente criado", "Cliente cadastrado com sucesso.");
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao criar cliente.");
    }
  }

  function resetGpForm() {
    setGpEditId(null);
    setGpForm(emptyGpForm);
  }

  async function handleSaveGp() {
    const chave = gpForm.chave.trim().toUpperCase();
    if (!chave) {
      notify("error", "Validacao", "Informe a chave do GP (XXXX-NN ou N.Ã‚Âº da planilha).");
      return;
    }

    const ano = gpForm.ano.trim() ? Number(gpForm.ano) : null;
    if (gpForm.ano.trim() && !Number.isInteger(ano)) {
      notify("error", "Validacao", "Ano invalido.");
      return;
    }

    const clienteId = gpForm.clienteId.trim() ? Number(gpForm.clienteId) : null;
    if (gpForm.clienteId.trim() && !Number.isInteger(clienteId)) {
      notify("error", "Validacao", "Cliente invalido.");
      return;
    }

    const payload = {
      chave,
      grupo: gpForm.grupo.trim() || null,
      ano,
      os: gpForm.os,
      aditivo: gpForm.aditivo,
      tipoServico: gpForm.tipoServico.trim() || null,
      descricao: gpForm.descricao.trim() || null,
      clienteId,
    };

    try {
      if (gpEditId) {
        await updateGp(gpEditId, payload);
        notify("success", "GP atualizado", "Registro de GP atualizado.");
      } else {
        await createGp(payload);
        notify("success", "GP criado", "Novo GP cadastrado.");
      }
      resetGpForm();
      await Promise.all([loadGps(), loadClientes()]);
      if (foundGpByChave) {
        const after = await listGps({ chave: foundGpByChave.chave, page: 1, pageSize: 20 });
        const exact = (after.items || []).find(
          (g) => normalizeChave(g.chave) === normalizeChave(foundGpByChave.chave)
        );
        if (exact) {
          setFoundGpByChave(exact);
          await loadFollowUpsForBusca(exact.id);
        } else {
          setFoundGpByChave(null);
          setFoundFollowUps([]);
        }
      }
      if (searchTipo === "cliente" && searchClienteNome.trim().length >= 2) {
        const clienteAfter = await listGps({ clienteNome: searchClienteNome.trim(), page: 1, pageSize: 200 });
        const items = clienteAfter.items || [];
        setFoundClienteGps(items);
        setFoundClienteNome(items[0]?.cliente?.nome || searchClienteNome.trim());
        await loadFollowUpsForCliente(items);
      }
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao salvar GP.");
    }
  }

  function handleEditGp(gp: Gp) {
    setGpEditId(gp.id);
    setGpForm({
      chave: gp.chave || "",
      grupo: gp.grupo || "",
      ano: gp.ano == null ? "" : String(gp.ano),
      clienteId: gp.clienteId == null ? "" : String(gp.clienteId),
      os: !!gp.os,
      aditivo: !!gp.aditivo,
      tipoServico: gp.tipoServico || "",
      descricao: gp.descricao || "",
    });
    setTab("gps");
  }

  async function handleDeleteGp(gp: Gp) {
    const ok = confirm(`Excluir GP ${gp.chave}?`);
    if (!ok) return;
    try {
      await deleteGp(gp.id);
      if (selectedGpId === gp.id) setSelectedGpId(null);
      if (foundGpByChave?.id === gp.id) {
        setFoundGpByChave(null);
        setFoundFollowUps([]);
      }
      if (foundClienteGps.some((g) => g.id === gp.id)) {
        const nextGps = foundClienteGps.filter((g) => g.id !== gp.id);
        setFoundClienteGps(nextGps);
        setFoundClienteFollowUps((prev) => prev.filter((f) => f.gpId !== gp.id));
        if (!nextGps.length) setFoundClienteNome("");
      }
      await Promise.all([loadGps(), loadFollowUps(), loadClientes()]);
      notify("success", "GP excluido", "GP removido com sucesso.");
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao excluir GP.");
    }
  }

  function resetFollowUpForm(keepGp = true) {
    setFollowUpEditId(null);
    setFollowUpForm({
      ...emptyFollowUpForm,
      gpId: keepGp && selectedGpId ? String(selectedGpId) : "",
    });
  }

  async function handleSaveFollowUp() {
    const gpId = Number(followUpForm.gpId);
    if (!Number.isInteger(gpId) || gpId <= 0) {
      notify("error", "Validacao", "Selecione um GP valido.");
      return;
    }

    const payload = {
      gpId,
      convite: followUpForm.convite || null,
      entrega: followUpForm.entrega || null,
      ultimoContato: followUpForm.ultimoContato || null,
      status: followUpForm.status.trim() || null,
      valor: toNumberOrNull(followUpForm.valor),
    };

    try {
      if (followUpEditId) {
        await updateFollowUp(followUpEditId, payload);
        notify("success", "Follow-up atualizado", "Registro atualizado com sucesso.");
      } else {
        await createFollowUp(payload);
        notify("success", "Follow-up criado", "Novo follow-up cadastrado.");
      }
      resetFollowUpForm(true);
      await Promise.all([loadFollowUps(), loadGps()]);
      if (foundGpByChave?.id === gpId) {
        await loadFollowUpsForBusca(gpId);
      }
      if (foundClienteGps.some((g) => g.id === gpId)) {
        await loadFollowUpsForCliente(foundClienteGps);
      }
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao salvar follow-up.");
    }
  }

  function handleEditFollowUp(row: FollowUp) {
    setFollowUpEditId(row.id);
    setFollowUpForm({
      gpId: String(row.gpId),
      convite: toDateInput(row.convite),
      entrega: toDateInput(row.entrega),
      ultimoContato: toDateInput(row.ultimoContato),
      status: row.status || "",
      valor: row.valor == null ? "" : String(row.valor),
    });
    setSelectedGpId(row.gpId);
    setTab("followups");
  }

  async function handleDeleteFollowUp(row: FollowUp) {
    const ok = confirm(`Excluir follow-up #${row.id}?`);
    if (!ok) return;
    try {
      await deleteFollowUp(row.id);
      await Promise.all([loadFollowUps(), loadGps()]);
      if (foundGpByChave?.id === row.gpId) {
        await loadFollowUpsForBusca(row.gpId);
      }
      if (foundClienteGps.some((g) => g.id === row.gpId)) {
        await loadFollowUpsForCliente(foundClienteGps);
      }
      notify("success", "Follow-up excluido", "Registro removido.");
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao excluir follow-up.");
    }
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div className="page-hero" variants={item}>
        <div>
          <div className="page-kicker">Estrutura</div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Database size={22} />
            Follow up
          </h1>
          <p className="page-desc">Cadastro e manutencao de Cliente, GP e FollowUp.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge">Clientes: {clientes.length}</span>
          <span className="badge">GPs: {gpsTotal}</span>
          <span className="badge">FollowUps: {followUps.length}</span>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4" variants={item}>
        <div className="panel-soft space-y-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Filtro de busca</div>
          <div className="text-sm text-zinc-600">Escolha o tipo de busca</div>
          <select
            className="input"
            value={searchTipo}
            onChange={(e) => {
              setSearchTipo(e.target.value as "chave" | "cliente");
              setFoundGpByChave(null);
              setFoundFollowUps([]);
              setFoundClienteNome("");
              setFoundClienteGps([]);
              setFoundClienteFollowUps([]);
            }}
          >
            <option value="chave">Chave GP (XXXX-NN ou N.º)</option>
            <option value="cliente">Nome do cliente</option>
          </select>
          {searchTipo === "chave" ? (
            <input
              className="input"
              value={searchChave}
              onChange={(e) => setSearchChave(normalizeChave(e.target.value))}
              placeholder="Ex: ABCD-12 ou 2949"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchByChave();
              }}
            />
          ) : (
            <input
              className="input"
              value={searchClienteNome}
              onChange={(e) => setSearchClienteNome(e.target.value)}
              placeholder="Ex: Prefeitura de Sao Paulo"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchByCliente();
              }}
            />
          )}
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={searchTipo === "chave" ? handleSearchByChave : handleSearchByCliente}
              type="button"
              disabled={loadingBusca}
            >
              {loadingBusca ? "Buscando..." : searchTipo === "chave" ? "Buscar chave" : "Buscar cliente"}
            </button>
            <button className="btn" onClick={clearSearchByChave} type="button" disabled={loadingBusca}>
              Limpar
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            A busca personalizada localiza o GP, o Cliente e os Follow-UPs vinculados.
          </p>
        </div>

        <div className="panel-soft space-y-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Tela de busca personalizada</div>
          {!foundGpByChave && foundClienteGps.length === 0 ? (
            <EmptyState
              compact
              title="Busque por chave GP ou nome do cliente"
              text="Ao encontrar resultado, o sistema exibe todos os dados relacionados."
            />
          ) : foundGpByChave ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="border rounded-xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">GP</div>
                  <div className="font-semibold">{foundGpByChave.chave}</div>
                  <div className="text-zinc-600">Grupo: {foundGpByChave.grupo || "-"}</div>
                  <div className="text-zinc-600">Ano: {foundGpByChave.ano ?? "-"}</div>
                </div>
                <div className="border rounded-xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Cliente</div>
                  <div className="font-semibold">{foundGpByChave.cliente?.nome || "Sem cliente"}</div>
                  <div className="text-zinc-600">OS: {foundGpByChave.os ? "Sim" : "Nao"}</div>
                  <div className="text-zinc-600">Aditivo: {foundGpByChave.aditivo ? "Sim" : "Nao"}</div>
                </div>
                <div className="border rounded-xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Servico</div>
                  <div className="font-semibold">{foundGpByChave.tipoServico || "-"}</div>
                  <div className="text-zinc-600 line-clamp-2">Descricao: {foundGpByChave.descricao || "-"}</div>
                  <div className="text-zinc-600">Follow-UPs: {foundFollowUps.length}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    handleEditGp(foundGpByChave);
                    setTab("gps");
                  }}
                  type="button"
                >
                  Editar GP
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setTab("followups");
                    setSelectedGpId(foundGpByChave.id);
                    setFollowUpForm((p) => ({ ...p, gpId: String(foundGpByChave.id) }));
                  }}
                  type="button"
                >
                  Gerenciar Follow-UP
                </button>
              </div>

              <div className="table-shell">
                <div className="overflow-auto" style={{ maxHeight: "240px" }}>
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10 border-b">
                      <tr>
                        <th className="text-left py-2 px-3">Convite</th>
                        <th className="text-left py-2 px-3">Entrega</th>
                        <th className="text-left py-2 px-3">Ultimo contato</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundFollowUps.length === 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-zinc-500" colSpan={5}>
                            <EmptyState compact title="Nenhum follow-up" text="Este GP ainda nao possui follow-up cadastrado." />
                          </td>
                        </tr>
                      ) : (
                        foundFollowUps.map((f) => (
                          <tr key={f.id} className="border-b hover:bg-zinc-50">
                            <td className="py-2 px-3">{fmtDate(f.convite)}</td>
                            <td className="py-2 px-3">{fmtDate(f.entrega)}</td>
                            <td className="py-2 px-3">{fmtDate(f.ultimoContato)}</td>
                            <td className="py-2 px-3">{f.status || "-"}</td>
                            <td className="py-2 px-3">{fmtCurrency(f.valor)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="border rounded-xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Cliente</div>
                  <div className="font-semibold">{foundClienteNome || "-"}</div>
                  <div className="text-zinc-600">Busca: {searchClienteNome || "-"}</div>
                </div>
                <div className="border rounded-xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">GPs vinculados</div>
                  <div className="font-semibold">{foundClienteGps.length}</div>
                  <div className="text-zinc-600">Registros relacionados ao cliente</div>
                </div>
                <div className="border rounded-xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Follow-Ups</div>
                  <div className="font-semibold">{foundClienteFollowUps.length}</div>
                  <div className="text-zinc-600">Total consolidado dos GPs</div>
                </div>
              </div>

              <div className="table-shell">
                <div className="overflow-auto" style={{ maxHeight: "220px" }}>
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10 border-b">
                      <tr>
                        <th className="text-left py-2 px-3">GP</th>
                        <th className="text-left py-2 px-3">Grupo</th>
                        <th className="text-left py-2 px-3">Ano</th>
                        <th className="text-left py-2 px-3">Follow-Ups</th>
                        <th className="text-left py-2 px-3">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundClienteGps.map((g) => (
                        <tr key={g.id} className="border-b transition-colors">
                          <td className="py-2 px-3 font-medium">{g.chave}</td>
                          <td className="py-2 px-3">{g.grupo || "-"}</td>
                          <td className="py-2 px-3">{g.ano ?? "-"}</td>
                          <td className="py-2 px-3">{g._count?.followUps ?? 0}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button
                                className="btn"
                                onClick={() => {
                                  handleEditGp(g);
                                  setTab("gps");
                                }}
                                type="button"
                              >
                                Editar GP
                              </button>
                              <button
                                className="btn"
                                onClick={() => {
                                  setTab("followups");
                                  setSelectedGpId(g.id);
                                  setFollowUpForm((p) => ({ ...p, gpId: String(g.id) }));
                                }}
                                type="button"
                              >
                                Follow-Ups
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-shell">
                <div className="overflow-auto" style={{ maxHeight: "220px" }}>
                  <table className="min-w-[820px] w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10 border-b">
                      <tr>
                        <th className="text-left py-2 px-3">GP</th>
                        <th className="text-left py-2 px-3">Convite</th>
                        <th className="text-left py-2 px-3">Entrega</th>
                        <th className="text-left py-2 px-3">Ultimo contato</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundClienteFollowUps.length === 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-zinc-500" colSpan={6}>
                            <EmptyState compact title="Nenhum follow-up" text="Os GPs deste cliente ainda nao possuem follow-up." />
                          </td>
                        </tr>
                      ) : (
                        foundClienteFollowUps.map((f) => (
                          <tr key={f.id} className="border-b transition-colors">
                            <td className="py-2 px-3">{f.gp?.chave || f.gpId}</td>
                            <td className="py-2 px-3">{fmtDate(f.convite)}</td>
                            <td className="py-2 px-3">{fmtDate(f.entrega)}</td>
                            <td className="py-2 px-3">{fmtDate(f.ultimoContato)}</td>
                            <td className="py-2 px-3">{f.status || "-"}</td>
                            <td className="py-2 px-3">{fmtCurrency(f.valor)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <motion.div className="panel-soft flex items-center gap-2 flex-wrap" variants={item}>
        <TabButton id="clientes" label="Clientes" activeTab={tab} onClick={setTab} />
        <TabButton id="gps" label="GPs" activeTab={tab} onClick={setTab} />
        <TabButton id="followups" label="FollowUps" activeTab={tab} onClick={setTab} />
        <span className="badge ml-auto">
          GPs: {gpsTotal} | FollowUps: {followUps.length}
        </span>
      </motion.div>

      {tab === "clientes" && (
        <motion.div className="panel-soft space-y-4" variants={item}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <input
              className="input"
              value={novoCliente}
              onChange={(e) => setNovoCliente(e.target.value)}
              placeholder="Nome do cliente"
            />
            <button className="btn btn-primary" onClick={handleCreateCliente} type="button">
              Criar cliente
            </button>
          </div>

          <div className="table-shell">
            <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
              <table className="w-full text-sm min-w-[520px]">
                <thead className="sticky top-0 bg-white z-10 border-b">
                  <tr>
                    <th className="text-left py-2 px-3">ID</th>
                    <th className="text-left py-2 px-3">Nome</th>
                    <th className="text-left py-2 px-3">Qtd GPs</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingClientes ? (
                    <TableSkeletonRows cols={3} rows={5} />
                  ) : clientes.length === 0 ? (
                    <tr>
                      <td className="py-4 px-3" colSpan={3}>
                        <EmptyState compact title="Nenhum cliente cadastrado" text="Use o formulario acima para adicionar o primeiro cliente." />
                      </td>
                    </tr>
                  ) : (
                    clientes.map((c) => (
                      <tr key={c.id} className="border-b hover:bg-zinc-50">
                        <td className="py-2 px-3">{c.id}</td>
                        <td className="py-2 px-3">{c.nome}</td>
                        <td className="py-2 px-3">{c._count?.gps ?? 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {tab === "gps" && (
        <motion.div className="space-y-4" variants={item}>
          <div className="panel-soft space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="input"
                value={gpFilterChave}
                onChange={(e) => {
                  setGpPage(1);
                  setGpFilterChave(e.target.value);
                }}
                placeholder="Filtro chave"
              />
              <input
                className="input"
                value={gpFilterGrupo}
                onChange={(e) => {
                  setGpPage(1);
                  setGpFilterGrupo(e.target.value);
                }}
                placeholder="Filtro grupo"
              />
              <input
                className="input"
                value={gpFilterAno}
                onChange={(e) => {
                  setGpPage(1);
                  setGpFilterAno(e.target.value);
                }}
                placeholder="Filtro ano"
              />
              <select
                className="input"
                value={gpFilterClienteId}
                onChange={(e) => {
                  setGpPage(1);
                  setGpFilterClienteId(e.target.value);
                }}
              >
                <option value="">Todos os clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setGpPage((p) => Math.max(1, p - 1))} disabled={gpPage <= 1}>
                Anterior
              </button>
              <span className="text-sm text-zinc-600">
                Pagina {gpPage} / {gpTotalPages}
              </span>
              <button
                className="btn"
                onClick={() => setGpPage((p) => Math.min(gpTotalPages, p + 1))}
                disabled={gpPage >= gpTotalPages}
              >
                Proxima
              </button>
              <button className="btn ml-auto" onClick={loadGps} type="button">
                Recarregar
              </button>
            </div>
          </div>

          <div className="panel-soft space-y-3">
            <div className="text-sm font-semibold">{gpEditId ? "Editar GP" : "Novo GP"}</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="input"
                value={gpForm.chave}
                onChange={(e) => setGpForm((p) => ({ ...p, chave: e.target.value }))}
                placeholder="Chave (XXXX-NN ou N.Ã‚Âº)"
              />
              <input
                className="input"
                value={gpForm.grupo}
                onChange={(e) => setGpForm((p) => ({ ...p, grupo: e.target.value }))}
                placeholder="Grupo"
              />
              <input
                className="input"
                value={gpForm.ano}
                onChange={(e) => setGpForm((p) => ({ ...p, ano: e.target.value }))}
                placeholder="Ano"
              />
              <select
                className="input"
                value={gpForm.clienteId}
                onChange={(e) => setGpForm((p) => ({ ...p, clienteId: e.target.value }))}
              >
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={gpForm.tipoServico}
                onChange={(e) => setGpForm((p) => ({ ...p, tipoServico: e.target.value }))}
                placeholder="Tipo de servico"
              />
              <input
                className="input md:col-span-2"
                value={gpForm.descricao}
                onChange={(e) => setGpForm((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Descricao"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={gpForm.os}
                  onChange={(e) => setGpForm((p) => ({ ...p, os: e.target.checked }))}
                />
                OS
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={gpForm.aditivo}
                  onChange={(e) => setGpForm((p) => ({ ...p, aditivo: e.target.checked }))}
                />
                Aditivo
              </label>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={handleSaveGp} type="button">
                {gpEditId ? "Salvar edicao" : "Criar GP"}
              </button>
              <button className="btn" onClick={resetGpForm} type="button">
                Limpar
              </button>
            </div>
          </div>

          <div className="table-shell">
            <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b">
                  <tr>
                    <th className="text-left py-2 px-3">Chave</th>
                    <th className="text-left py-2 px-3">Grupo</th>
                    <th className="text-left py-2 px-3">Ano</th>
                    <th className="text-left py-2 px-3">Cliente</th>
                    <th className="text-left py-2 px-3">OS</th>
                    <th className="text-left py-2 px-3">Aditivo</th>
                    <th className="text-left py-2 px-3">FollowUps</th>
                    <th className="text-left py-2 px-3">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingGps ? (
                    <TableSkeletonRows cols={8} rows={6} />
                  ) : gps.length === 0 ? (
                    <tr>
                      <td className="py-4 px-3" colSpan={8}>
                        <EmptyState compact title="Nenhum GP encontrado" text="Ajuste os filtros ou crie um novo GP no formulario acima." />
                      </td>
                    </tr>
                  ) : (
                    gps.map((g) => (
                      <tr key={g.id} className="border-b transition-colors">
                        <td className="py-2 px-3 font-medium">{g.chave}</td>
                        <td className="py-2 px-3">{g.grupo || "-"}</td>
                        <td className="py-2 px-3">{g.ano ?? "-"}</td>
                        <td className="py-2 px-3">{g.cliente?.nome || "-"}</td>
                        <td className="py-2 px-3">{g.os ? "Sim" : "Nao"}</td>
                        <td className="py-2 px-3">{g.aditivo ? "Sim" : "Nao"}</td>
                        <td className="py-2 px-3">{g._count?.followUps ?? 0}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <button className="btn" onClick={() => handleEditGp(g)} type="button">
                              Editar
                            </button>
                            <button
                              className="btn"
                              onClick={() => {
                                setSelectedGpId(g.id);
                                setTab("followups");
                                setFollowUpForm((p) => ({ ...p, gpId: String(g.id) }));
                              }}
                              type="button"
                            >
                              FollowUps
                            </button>
                            <button className="btn" onClick={() => handleDeleteGp(g)} type="button">
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {tab === "followups" && (
        <motion.div className="space-y-4" variants={item}>
          <div className="panel-soft space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="input"
                value={selectedGpId ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  setSelectedGpId(v);
                  setFollowUpForm((p) => ({ ...p, gpId: v ? String(v) : "" }));
                }}
              >
                <option value="">Todos os GPs</option>
                {gpOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.chave} {g.grupo ? `- ${g.grupo}` : ""}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={followFilterStatus}
                onChange={(e) => setFollowFilterStatus(e.target.value)}
                placeholder="Filtro status"
              />
              <button className="btn" onClick={loadFollowUps} type="button">
                Recarregar
              </button>
            </div>
            <div className="text-sm text-zinc-600">
              {selectedGp ? `GP selecionado: ${selectedGp.chave}` : "Mostrando follow-ups de todos os GPs"}
            </div>
          </div>

          <div className="panel-soft space-y-3">
            <div className="text-sm font-semibold">{followUpEditId ? "Editar FollowUp" : "Novo FollowUp"}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="input"
                value={followUpForm.gpId}
                onChange={(e) => setFollowUpForm((p) => ({ ...p, gpId: e.target.value }))}
              >
                <option value="">Selecione GP</option>
                {gpOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.chave}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="date"
                value={followUpForm.convite}
                onChange={(e) => setFollowUpForm((p) => ({ ...p, convite: e.target.value }))}
              />
              <input
                className="input"
                type="date"
                value={followUpForm.entrega}
                onChange={(e) => setFollowUpForm((p) => ({ ...p, entrega: e.target.value }))}
              />
              <input
                className="input"
                type="date"
                value={followUpForm.ultimoContato}
                onChange={(e) => setFollowUpForm((p) => ({ ...p, ultimoContato: e.target.value }))}
              />
              <input
                className="input"
                value={followUpForm.status}
                onChange={(e) => setFollowUpForm((p) => ({ ...p, status: e.target.value }))}
                placeholder="Status"
              />
              <input
                className="input"
                value={followUpForm.valor}
                onChange={(e) => setFollowUpForm((p) => ({ ...p, valor: e.target.value }))}
                placeholder="Valor"
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={handleSaveFollowUp} type="button">
                {followUpEditId ? "Salvar edicao" : "Criar FollowUp"}
              </button>
              <button className="btn" onClick={() => resetFollowUpForm(true)} type="button">
                Limpar
              </button>
            </div>
          </div>

          <div className="table-shell">
            <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b">
                  <tr>
                    <th className="text-left py-2 px-3">ID</th>
                    <th className="text-left py-2 px-3">GP</th>
                    <th className="text-left py-2 px-3">Convite</th>
                    <th className="text-left py-2 px-3">Entrega</th>
                    <th className="text-left py-2 px-3">Ultimo contato</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Valor</th>
                    <th className="text-left py-2 px-3">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFollowUps ? (
                    <TableSkeletonRows cols={8} rows={6} />
                  ) : followUps.length === 0 ? (
                    <tr>
                      <td className="py-4 px-3" colSpan={8}>
                        <EmptyState compact title="Nenhum follow-up encontrado" text="Crie um novo follow-up para acompanhar este GP." />
                      </td>
                    </tr>
                  ) : (
                    followUps.map((f) => (
                      <tr key={f.id} className="border-b transition-colors">
                        <td className="py-2 px-3">{f.id}</td>
                        <td className="py-2 px-3">{f.gp?.chave || f.gpId}</td>
                        <td className="py-2 px-3">{fmtDate(f.convite)}</td>
                        <td className="py-2 px-3">{fmtDate(f.entrega)}</td>
                        <td className="py-2 px-3">{fmtDate(f.ultimoContato)}</td>
                        <td className="py-2 px-3">{f.status || "-"}</td>
                        <td className="py-2 px-3">{fmtCurrency(f.valor)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <button className="btn" onClick={() => handleEditFollowUp(f)} type="button">
                              Editar
                            </button>
                            <button className="btn" onClick={() => handleDeleteFollowUp(f)} type="button">
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
