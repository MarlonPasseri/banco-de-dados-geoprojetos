const fallbackApiBase =
  typeof window !== "undefined"
    ? `http://${window.location.hostname || "localhost"}:3001/api`
    : "http://localhost:3001/api";

const API_BASE = import.meta.env.VITE_API_URL || fallbackApiBase;
const AUTH_USER_KEY = "auth_user";
const AUTH_USER_EVENT = "auth-user-change";

function dispatchAuthUserChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_USER_EVENT));
}

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem(AUTH_USER_KEY);
  dispatchAuthUserChange();
}

async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

// ---------- Auth ----------
export type AuthUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;

  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }

  dispatchAuthUserChange();
}

export function subscribeAuthUserChange(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const onChange = () => listener();
  window.addEventListener(AUTH_USER_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(AUTH_USER_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export async function login(identifier: string, password: string) {
  const r = await http<{ token: string; user: AuthUser }>(`/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  // ✅ já salva token aqui pra evitar esquecer no front
  setToken(r.token);
  setStoredUser(r.user);
  return r;
}

export async function setupAdmin() {
  return http<{ ok: boolean }>(`/setup`, { method: "POST" });
}

export async function registerUser(payload: { name: string; email: string; password: string }) {
  return http<{ ok: boolean; email: string; message: string }>(`/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchCurrentUser() {
  const user = await http<AuthUser>(`/auth/me`);
  setStoredUser(user);
  return user;
}

export async function updateCurrentUser(payload: { name?: string; email?: string; avatarUrl?: string }) {
  const r = await http<{ user: AuthUser; token: string }>(`/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  setToken(r.token);
  setStoredUser(r.user);
  return r;
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return http<{ ok: boolean; message: string }>(`/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------- Grid types ----------
export type GridColumn = {
  id: string; // BigInt vem como string no backend
  key: string;
  label: string;
  type: string;
  width?: number | null;
  order: number;
  hidden: boolean;
};

export type GridRow = {
  id: string;
  sheet?: string;
  rowNumber?: number;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type Contrato = {
  numero: number;
  ordemDataEntrega: number | null;
  followUp: string | null;
  grupo: string | null;
  convite: string | null;
  ano: number | null;
  entrega: string | null;
  ultimoContato: string | null;
  nomeProjetoLocal: string | null;
  cliente: string | null;
  tipoServico: string | null;
  resp: string | null;
  status: string | null;
  contatos: string | null;
  valor: number | string | null;
  prazoMes: number | null;
  go: string | null;
  observacoes: string | null;
  certidao: string | null;
  mediaMensal: number | string | null;
  total: number | string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContratoListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Contrato[];
};

export type ListContratosParams = {
  search?: string;
  status?: string;
  cliente?: string;
  ano?: number;
  page?: number;
  pageSize?: number;
};

export async function fetchGrid(
  params: { sheet?: string; page?: number; pageSize?: number; sortKey?: string; sortDir?: "asc" | "desc" } = {}
) {
  const qs = new URLSearchParams();
  if (params.sheet) qs.set("sheet", params.sheet);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.sortKey) qs.set("sortKey", params.sortKey);
  if (params.sortDir) qs.set("sortDir", params.sortDir);

  const q = qs.toString();
  return http<{ columns: GridColumn[]; rows: GridRow[]; total: number; page: number; pageSize: number; sheet: string }>(
    `/grid${q ? `?${q}` : ""}`
  );
}

export async function updateCell(rowId: string, key: string, value: any) {
  return http<GridRow>(`/grid/rows/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export async function createRow(sheet: string, data: Record<string, any> = {}) {
  return http<GridRow>(`/grid/rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet, data }),
  });
}

export async function deleteRow(rowId: string) {
  return http<{ ok: boolean }>(`/grid/rows/${rowId}`, { method: "DELETE" });
}

export async function createColumn(label: string, type = "text") {
  return http<GridColumn>(`/grid/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, type }),
  });
}

export async function deleteColumn(key: string) {
  return http<{ ok: boolean }>(`/grid/columns/${encodeURIComponent(key)}`, { method: "DELETE" });
}

export async function importGrid(file: File, sheet: string, mode: "merge" | "replace" = "merge") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("sheet", sheet);
  fd.append("mode", mode);

  const token = getToken();

  const res = await fetch(`${API_BASE}/import/grid`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as { ok: boolean; sheet: string; mode: string; colunas: number; linhas: number };
}

export async function gridSummary(sheet: string) {
  const qs = new URLSearchParams();
  qs.set("sheet", sheet);
  return http<{ sheet: string; columns: number; rows: number }>(`/grid/summary?${qs.toString()}`);
}

// ✅ AQUI está a função que estava faltando
export async function searchGrid(
  q: string,
  sheet: string,
  page = 1,
  pageSize = 50
) {
  const qs = new URLSearchParams();
  qs.set("q", q);
  qs.set("sheet", sheet);
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));

  return http<{
    total: number;
    page: number;
    pageSize: number;
    columns: GridColumn[];
    items: GridRow[];
  }>(`/grid/search?${qs.toString()}`);
}

export async function listContratos(params: ListContratosParams = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.cliente) qs.set("cliente", params.cliente);
  if (typeof params.ano === "number") qs.set("ano", String(params.ano));
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.pageSize === "number") qs.set("pageSize", String(params.pageSize));
  const q = qs.toString();
  return http<ContratoListResponse>(`/contratos${q ? `?${q}` : ""}`);
}

// ---------- Modelagem ----------
export type Cliente = {
  id: number;
  nome: string;
  createdAt: string;
  updatedAt: string;
  _count?: { gps: number };
};

export type Gp = {
  id: number;
  chave: string;
  grupo: string | null;
  ano: number | null;
  os: boolean;
  aditivo: boolean;
  tipoServico: string | null;
  descricao: string | null;
  clienteId: number | null;
  createdAt: string;
  updatedAt: string;
  cliente?: Cliente | null;
  _count?: { followUps: number };
};

export type GpListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Gp[];
};

export type FollowUp = {
  id: number;
  gpId: number;
  convite: string | null;
  entrega: string | null;
  ultimoContato: string | null;
  status: string | null;
  valor: number | string | null;
  createdAt: string;
  updatedAt: string;
  gp?: Gp;
};

export type ListGpsParams = {
  chave?: string;
  clienteId?: number;
  clienteNome?: string;
  grupo?: string;
  ano?: number;
  page?: number;
  pageSize?: number;
};

export type SaveGpPayload = {
  chave?: string;
  grupo?: string | null;
  ano?: number | null;
  os?: boolean;
  aditivo?: boolean;
  tipoServico?: string | null;
  descricao?: string | null;
  clienteId?: number | null;
};

export type ListFollowUpsParams = {
  gpId?: number;
  gpChave?: string;
  status?: string;
  date?: string;
};

export type SaveFollowUpPayload = {
  gpId?: number;
  gpChave?: string;
  convite?: string | null;
  entrega?: string | null;
  ultimoContato?: string | null;
  status?: string | null;
  valor?: number | null;
};

export async function listClientes() {
  return http<Cliente[]>(`/clientes`);
}

export async function createCliente(nome: string) {
  return http<Cliente>(`/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
}

export async function listGps(params: ListGpsParams = {}) {
  const qs = new URLSearchParams();
  if (params.chave) qs.set("chave", params.chave);
  if (typeof params.clienteId === "number") qs.set("clienteId", String(params.clienteId));
  if (params.clienteNome) qs.set("clienteNome", params.clienteNome);
  if (params.grupo) qs.set("grupo", params.grupo);
  if (typeof params.ano === "number") qs.set("ano", String(params.ano));
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.pageSize === "number") qs.set("pageSize", String(params.pageSize));
  const q = qs.toString();
  return http<GpListResponse>(`/gps${q ? `?${q}` : ""}`);
}

export async function getGp(id: number) {
  return http<Gp>(`/gps/${id}`);
}

export async function createGp(payload: SaveGpPayload) {
  return http<Gp>(`/gps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateGp(id: number, payload: SaveGpPayload) {
  return http<Gp>(`/gps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteGp(id: number) {
  return http<{ ok: boolean }>(`/gps/${id}`, { method: "DELETE" });
}

export async function listFollowUps(params: ListFollowUpsParams = {}) {
  const qs = new URLSearchParams();
  if (typeof params.gpId === "number") qs.set("gpId", String(params.gpId));
  if (params.gpChave) qs.set("gpChave", params.gpChave);
  if (params.status) qs.set("status", params.status);
  if (params.date) qs.set("date", params.date);
  const q = qs.toString();
  return http<FollowUp[]>(`/followups${q ? `?${q}` : ""}`);
}

export async function createFollowUp(payload: SaveFollowUpPayload) {
  return http<FollowUp>(`/followups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateFollowUp(id: number, payload: SaveFollowUpPayload) {
  return http<FollowUp>(`/followups/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteFollowUp(id: number) {
  return http<{ ok: boolean }>(`/followups/${id}`, { method: "DELETE" });
}
