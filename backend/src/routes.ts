// backend/src/routes.ts
import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { signToken, authMiddleware } from "./auth.js";
import { parseContratosSheet, parseSheetToGrid } from "./importExcel.js";
import { env } from "./config.js";
import { createRateLimiter } from "./rateLimit.js";
import {
  isStrongEnoughPassword,
  isValidEmail,
  normalizeEmail,
} from "./userAuth.js";

function wrapMaybeAsync(handler: any) {
  if (typeof handler !== "function" || handler.length >= 4) return handler;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const maybePromise = handler(req, res, next);
      if (maybePromise && typeof maybePromise.then === "function") {
        void Promise.resolve(maybePromise).catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}

function createSafeRouter() {
  const safeRouter = Router();
  const methods = ["get", "post", "put", "patch", "delete", "head", "options", "all"] as const;

  for (const method of methods) {
    const original = (safeRouter as any)[method].bind(safeRouter);
    (safeRouter as any)[method] = (path: string, ...handlers: any[]) =>
      original(path, ...handlers.map(wrapMaybeAsync));
  }

  return safeRouter;
}

export const router = createSafeRouter();

/**
 * Segurança básica pro upload (principalmente por causa do xlsx):
 * - limita tamanho
 * - aceita apenas .xlsx
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB (ajuste se quiser)
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx");
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx sao permitidos."));
    }
  },
});

const loginLimiter = createRateLimiter({
  keyPrefix: "login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
  keyGenerator: (req) => {
    const identifier = String(req.body?.identifier ?? req.body?.username ?? req.body?.email ?? "").trim().toLowerCase();
    return `${req.ip || "unknown"}:${identifier}`;
  },
});

const registerLimiter = createRateLimiter({
  keyPrefix: "register",
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Muitas tentativas de cadastro. Aguarde alguns minutos.",
  keyGenerator: (req) => `${req.ip || "unknown"}:${normalizeEmail(req.body?.email)}`,
});

const setupLimiter = createRateLimiter({
  keyPrefix: "setup",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Muitas tentativas de setup. Aguarde e tente novamente.",
});

const importLimiter = createRateLimiter({
  keyPrefix: "import",
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: "Muitas importacoes em pouco tempo. Aguarde antes de tentar novamente.",
  keyGenerator: (req) => `${req.ip || "unknown"}:${(req as any).user?.sub ?? "anon"}`,
});

router.get("/health", (_req, res) => res.json({ ok: true }));

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "API online",
    endpoints: [
      "/api/health",
      "/api/setup",
      "/api/auth/register",
      "/api/auth/login",
      "/api/auth/me",
      "/api/auth/change-password",
      "/api/clientes",
      "/api/gps",
      "/api/followups",
      "/api/contratos",
      "/api/import/contratos",
      "/api/grid",
      "/api/grid/summary",
      "/api/grid/search",
      "/api/import/grid",
    ],
  });
});

// -----------------------------
// HELPERS
// -----------------------------
function buildSearchText(data: Record<string, any>) {
  return Object.values(data ?? {})
    .map((v) => (v == null ? "" : String(v)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGpChave(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function isGpChaveValid(chave: string) {
  if (!chave) return false;
  return /^[A-Z0-9]{4}-\d{2}$/.test(chave) || /^\d+$/.test(chave);
}

function toBool(v: any, fallback = false) {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "sim" || s === "yes";
}

function toDateOrNull(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isIsoDateOnly(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toIntOrNull(v: any) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toNumberOrNull(v: any) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBigIntOrNull(v: any) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return BigInt(Math.trunc(v));
  const s = String(v).trim();
  return /^\d+$/.test(s) ? BigInt(s) : null;
}

function normalizeClienteNome(v: unknown) {
  const nome = String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!nome || nome === "-") return "";
  return nome;
}

function normalizeLoose(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeLoginIdentifier(value: unknown) {
  return String(value ?? "").trim();
}

async function findUserByLoginIdentifier(identifier: string) {
  const normalized = normalizeLoginIdentifier(identifier);
  const email = normalizeEmail(normalized);
  const usernames = Array.from(new Set([normalized, normalized.toLowerCase()])).filter((value) => value.length > 0);

  return prisma.user.findFirst({
    where: {
      OR: [
        ...(usernames.length > 0 ? usernames.map((username) => ({ username })) : []),
        ...(email ? [{ email }] : []),
      ],
    },
  });
}

function getAuthUserId(req: Request) {
  const raw = (req as any).user?.sub;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toAuthUserResponse(user: {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sanitizeGridValue(v: unknown) {
  const text = String(v ?? "").trim();
  if (!text || text === "-") return "";
  return text;
}

function pickGridValue(data: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const value = sanitizeGridValue(data[key]);
    if (value) return value;
  }

  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(data)) {
    normalized.set(normalizeLoose(key), value);
  }

  for (const key of candidates) {
    const value = sanitizeGridValue(normalized.get(normalizeLoose(key)));
    if (value) return value;
  }

  return "";
}

function pickNumeroColumnKey(columns: Array<{ key: string; label: string }>) {
  const aliases = new Set(["n", "numero"]);

  for (const col of columns) {
    if (aliases.has(normalizeLoose(col.label))) return col.key;
  }
  for (const col of columns) {
    if (aliases.has(normalizeLoose(col.key))) return col.key;
  }

  return null;
}

function buildBroadGridSearchWhere(sheet: string, query: string): Prisma.GridRowWhereInput {
  return {
    sheet,
    searchText: { contains: query, mode: "insensitive" },
  };
}

function buildExactNumeroGridSearchWhere(sheet: string, numeroKey: string, query: string): Prisma.GridRowWhereInput {
  const trimmed = String(query ?? "").trim();
  const stringCandidates = new Set(
    [trimmed, normalizeGpChave(trimmed), trimmed.toLowerCase()].filter((value) => value.length > 0)
  );

  const filters: Prisma.GridRowWhereInput[] = Array.from(stringCandidates).map((value) => ({
    data: {
      path: [numeroKey],
      equals: value,
    },
  }));

  if (/^\d+$/.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      filters.push({
        data: {
          path: [numeroKey],
          equals: numericValue,
        },
      });
    }
  }

  return {
    sheet,
    OR: filters,
  };
}

function shouldTryExactNumeroSearch(query: string, mode: string) {
  if (mode === "exactNumero") return true;
  if (mode !== "smart") return false;

  const normalized = normalizeGpChave(query);
  if (!isGpChaveValid(normalized)) return false;
  if (/^\d+$/.test(normalized) && normalized.length < 4) return false;

  return true;
}

function toIntFromGrid(v: unknown) {
  const text = sanitizeGridValue(v);
  if (!text) return null;
  const normalized = text.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function safeTokenEquals(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

const GP_SYNC_INTERVAL_MS = 60_000;
let lastGpSyncAt = 0;
let gpSyncInFlight: Promise<void> | null = null;

async function syncClientesFromGrid() {
  const rows = await prisma.$queryRaw<Array<{ nome: string | null }>>(Prisma.sql`
    SELECT DISTINCT TRIM(COALESCE("data"->>'clientes', "data"->>'cliente', '')) AS nome
    FROM "GridRow"
    WHERE TRIM(COALESCE("data"->>'clientes', "data"->>'cliente', '')) <> ''
      AND TRIM(COALESCE("data"->>'clientes', "data"->>'cliente', '')) <> '-'
  `);

  if (!rows.length) return;

  const nomesFromGrid = new Map<string, string>();
  for (const row of rows) {
    const nome = normalizeClienteNome(row?.nome);
    if (!nome) continue;
    const key = nome.toLowerCase();
    if (!nomesFromGrid.has(key)) nomesFromGrid.set(key, nome);
  }
  if (!nomesFromGrid.size) return;

  const existentes = await prisma.cliente.findMany({ select: { nome: true } });
  const existentesSet = new Set(
    existentes
      .map((c) => normalizeClienteNome(c.nome).toLowerCase())
      .filter((nome) => nome.length > 0)
  );

  const toCreate = Array.from(nomesFromGrid.entries())
    .filter(([key]) => !existentesSet.has(key))
    .map(([, nome]) => ({ nome }));

  if (!toCreate.length) return;
  await prisma.cliente.createMany({ data: toCreate, skipDuplicates: true });
}

async function syncGpsFromGrid() {
  const columns = await prisma.gridColumn.findMany({
    select: { key: true, label: true },
  });
  if (!columns.length) return;

  const numeroKey = pickNumeroColumnKey(columns);
  if (!numeroKey) return;

  const [rows, gpsExistentes, clientes] = await Promise.all([
    prisma.gridRow.findMany({
      where: { sheet: "CONTRATOS" },
      select: { data: true },
    }),
    prisma.gp.findMany({ select: { chave: true } }),
    prisma.cliente.findMany({ select: { id: true, nome: true } }),
  ]);

  if (!rows.length) return;

  const existing = new Set(gpsExistentes.map((gp) => normalizeGpChave(gp.chave)));
  const seen = new Set<string>();
  const clientesMap = new Map(
    clientes.map((c) => [normalizeClienteNome(c.nome).toLowerCase(), c.id] as const)
  );

  const toCreate: Prisma.GpCreateManyInput[] = [];

  for (const row of rows) {
    const data = ((row.data as any) || {}) as Record<string, unknown>;
    const rawNumero = pickGridValue(data, [numeroKey, "n", "numero"]);
    const chave = normalizeGpChave(rawNumero);
    if (!isGpChaveValid(chave)) continue;
    if (existing.has(chave) || seen.has(chave)) continue;

    const clienteNome = normalizeClienteNome(pickGridValue(data, ["cliente", "clientes"]));
    const clienteId = clienteNome ? clientesMap.get(clienteNome.toLowerCase()) ?? null : null;

    toCreate.push({
      chave,
      grupo: pickGridValue(data, ["grupo"]) || null,
      ano: toIntFromGrid(pickGridValue(data, ["ano"])),
      tipoServico: pickGridValue(data, ["tipo_de_servico", "tipo_servico"]) || null,
      descricao:
        pickGridValue(data, ["nome_do_projeto_e_local", "nome_do_projeto_local", "descricao"]) || null,
      clienteId,
    });

    seen.add(chave);
  }

  if (!toCreate.length) return;
  await prisma.gp.createMany({ data: toCreate, skipDuplicates: true });
}

async function ensureGpsAndClientesSynced() {
  const now = Date.now();
  if (now - lastGpSyncAt < GP_SYNC_INTERVAL_MS) return;
  if (gpSyncInFlight) return gpSyncInFlight;

  gpSyncInFlight = (async () => {
    await syncClientesFromGrid();
    await syncGpsFromGrid();
    lastGpSyncAt = Date.now();
  })().finally(() => {
    gpSyncInFlight = null;
  });

  return gpSyncInFlight;
}

// -----------------------------
// AUTH
// -----------------------------
router.post("/setup", setupLimiter, async (req, res) => {
  if (env.nodeEnv !== "development") {
    return res.status(403).json({ error: "setup bloqueado fora de development" });
  }

  if (env.setupToken) {
    const provided = String(req.headers["x-setup-token"] ?? req.query.token ?? "").trim();
    if (!safeTokenEquals(env.setupToken, provided)) {
      return res.status(403).json({ error: "setup bloqueado" });
    }
  }

  const username = env.adminUser;
  const pass = env.adminPass;
  const email = env.adminEmail;

  const exists = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  });
  if (!exists) {
    const hash = await bcrypt.hash(pass, 10);
    await prisma.user.create({
      data: {
        username,
        email,
        name: "Administrador",
        password: hash,
        emailVerifiedAt: email ? new Date() : null,
      },
    });
  }

  res.json({ ok: true });
});

router.post("/auth/register", registerLimiter, async (req, res) => {
  const name = String(req.body?.name ?? "").replace(/\s+/g, " ").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Informe um e-mail valido." });
  }

  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres e incluir letra e numero." });
  }

  if (name.length > 120) {
    return res.status(400).json({ error: "Nome invalido." });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }],
    },
  });

  if (existing) {
    return res.status(409).json({ error: "E-mail ja cadastrado. Use o reenvio de verificacao ou tente entrar." });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: hash,
      emailVerifiedAt: new Date(),
    },
  });

  res.status(201).json({
    ok: true,
    email,
    message: "Conta criada com sucesso. Agora voce ja pode entrar.",
  });
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const identifier = normalizeLoginIdentifier(req.body?.identifier ?? req.body?.username ?? req.body?.email);
  const password = String(req.body?.password ?? "");

  if (!identifier || !password) {
    return res.status(400).json({ error: "Credenciais invalidas" });
  }

  if (identifier.length > 160 || password.length > 256) {
    return res.status(400).json({ error: "Credenciais invalidas" });
  }

  const u = await findUserByLoginIdentifier(identifier);
  if (!u) return res.status(401).json({ error: "Usuario/senha invalidos" });
  if (u.disabledAt) return res.status(403).json({ error: "Usuario desativado." });

  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.status(401).json({ error: "Usuario/senha invalidos" });

  const token = signToken({
    sub: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
  });
  res.json({
    token,
    user: toAuthUserResponse(u),
  });
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Token invalido" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
  res.json(toAuthUserResponse(user));
});

router.patch("/auth/me", authMiddleware, async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Token invalido" });

  const name = req.body?.name === undefined ? undefined : String(req.body?.name ?? "").replace(/\s+/g, " ").trim();
  const email = req.body?.email === undefined ? undefined : normalizeEmail(req.body?.email);
  const avatarUrl =
    req.body?.avatarUrl === undefined ? undefined : String(req.body?.avatarUrl ?? "").trim();

  if (name !== undefined && name.length > 120) {
    return res.status(400).json({ error: "Nome invalido." });
  }

  if (email !== undefined && email && !isValidEmail(email)) {
    return res.status(400).json({ error: "Informe um e-mail valido." });
  }

  if (avatarUrl !== undefined) {
    const normalizedAvatar = avatarUrl.trim();
    if (normalizedAvatar && !normalizedAvatar.startsWith("data:image/")) {
      return res.status(400).json({ error: "Formato de foto invalido." });
    }
    if (normalizedAvatar.length > 900_000) {
      return res.status(400).json({ error: "A foto esta muito grande. Use uma imagem menor." });
    }
  }

  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) return res.status(404).json({ error: "Usuario nao encontrado." });

  if (email && email !== current.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId },
      },
    });
    if (existing) return res.status(409).json({ error: "Este e-mail ja esta em uso." });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name: name || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const token = signToken({
    sub: updated.id,
    username: updated.username,
    email: updated.email,
    name: updated.name,
  });

  res.json({
    user: toAuthUserResponse(updated),
    token,
  });
});

router.post("/auth/change-password", authMiddleware, async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Token invalido" });

  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({ error: "A nova senha deve ter ao menos 8 caracteres e incluir letra e numero." });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return res.status(401).json({ error: "Senha atual incorreta." });

  const samePassword = await bcrypt.compare(newPassword, user.password);
  if (samePassword) {
    return res.status(400).json({ error: "A nova senha deve ser diferente da senha atual." });
  }

  const password = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password },
  });

  res.json({ ok: true, message: "Senha alterada com sucesso." });
});


// -----------------------------
// IMPORT CONTRATOS (schema fixo)
// -----------------------------
router.post("/import/contratos", authMiddleware, importLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Envie um arquivo .xlsx" });

  const contratos = parseContratosSheet(req.file.buffer);

  let upserted = 0;
  let parcelasUpserted = 0;

  const BATCH = 50;

  for (let i = 0; i < contratos.length; i += BATCH) {
    const chunk = contratos.slice(i, i + BATCH);

    await prisma.$transaction(async (tx) => {
      for (const c of chunk as any[]) {
        const { _parcelas, ...main } = c;

        await tx.contrato.upsert({
          where: { numero: main.numero },
          create: main,
          update: main,
        });
        upserted++;

        for (const p of _parcelas) {
          await tx.parcela.upsert({
            where: {
              contratoNumero_parcela: { contratoNumero: main.numero, parcela: p.parcela },
            },
            create: { contratoNumero: main.numero, parcela: p.parcela, valor: p.valor },
            update: { valor: p.valor },
          });
          parcelasUpserted++;
        }
      }
    });
  }

  res.json({ ok: true, contratos: upserted, parcelas: parcelasUpserted });
});

router.get("/contratos", authMiddleware, async (req, res) => {
  const { search = "", status, cliente, ano, page = "1", pageSize = "20" } = req.query as any;

  const take = Math.min(Number(pageSize) || 20, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where: any = {
    ...(status ? { status: { contains: String(status), mode: "insensitive" } } : {}),
    ...(cliente ? { cliente: { contains: String(cliente), mode: "insensitive" } } : {}),
    ...(ano ? { ano: Number(ano) } : {}),
    ...(search
      ? {
          OR: [
            { nomeProjetoLocal: { contains: String(search), mode: "insensitive" } },
            { cliente: { contains: String(search), mode: "insensitive" } },
            { tipoServico: { contains: String(search), mode: "insensitive" } },
            { status: { contains: String(search), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.contrato.count({ where }),
    prisma.contrato.findMany({
      where,
      orderBy: { numero: "desc" },
      skip,
      take,
    }),
  ]);

  res.json({ total, page: Number(page), pageSize: take, items });
});

// -----------------------------
// GRID (schema dinâmico: colunas/linhas editáveis)
// Requer models GridColumn e GridRow no schema.prisma
// GridRow precisa ter: sheet, rowNumber, searchText
// -----------------------------

router.get("/grid", authMiddleware, async (req, res) => {
  const cols = await prisma.gridColumn.findMany({ orderBy: { order: "asc" } });

  const sheet = String(req.query.sheet || "CONTRATOS");

  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Number(req.query.pageSize || 50), 200);
  const skip = (page - 1) * pageSize;

  const sortKeyRaw = String(req.query.sortKey || "").trim();
  const sortDirRaw = String(req.query.sortDir || "desc").toLowerCase();
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const allowedKeys = new Set(cols.map((c) => c.key));
  const isSafeKey = /^[a-z0-9_]+$/.test(sortKeyRaw);
  const sortKey = allowedKeys.has(sortKeyRaw) && isSafeKey ? sortKeyRaw : "";

  const total = await prisma.gridRow.count({ where: { sheet } });

  let rows: any[] = [];
  if (sortKey) {
    const dataField = Prisma.raw(`"data"->>'${sortKey}'`);
    const sortDirSql = Prisma.raw(sortDir);

    if (sortKey === "ano") {
      rows = await prisma.$queryRaw(
        Prisma.sql`
          SELECT * FROM "GridRow"
          WHERE "sheet" = ${sheet}
          ORDER BY
            CASE
              WHEN ${dataField} ~ '^\\d{4}$' THEN (${dataField})::int
              WHEN ${dataField} ~ '^\\d+$' THEN (${dataField})::int
              ELSE NULL
            END ${sortDirSql} NULLS LAST,
            "id" DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `
      );
    } else {
      rows = await prisma.$queryRaw(
        Prisma.sql`
          SELECT * FROM "GridRow"
          WHERE "sheet" = ${sheet}
          ORDER BY
            CASE
              WHEN ${dataField} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(${dataField}, 'YYYY-MM-DD')
              WHEN ${dataField} ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(${dataField}, 'DD/MM/YYYY')
              WHEN ${dataField} ~ '^\\d+(\\.\\d+)?$' THEN (date '1899-12-30' + (${dataField}::numeric)::int)
              ELSE NULL
            END ${sortDirSql} NULLS LAST,
            "id" DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `
      );
    }
  } else {
    rows = await prisma.gridRow.findMany({ where: { sheet }, orderBy: { id: "desc" }, skip, take: pageSize });
  }

  // evita crash de BigInt se você ainda não aplicou toJSON no server.ts
  const safeCols = cols.map((c: any) => ({ ...c, id: c.id?.toString?.() ?? c.id }));
  const safeRows = rows.map((r: any) => ({ ...r, id: r.id?.toString?.() ?? r.id }));

  res.json({ columns: safeCols, rows: safeRows, total, page, pageSize, sheet });
});

// resumo (pra UI saber se já tem dados salvos)
router.get("/grid/summary", authMiddleware, async (req, res) => {
  const sheet = String(req.query.sheet || "CONTRATOS");
  const [cols, rows] = await Promise.all([
    prisma.gridColumn.count({ where: { hidden: false } }),
    prisma.gridRow.count({ where: { sheet } }),
  ]);

  res.json({ sheet, columns: cols, rows });
});

// buscar no banco (não carrega tabela inteira no front)
router.get("/grid/search", authMiddleware, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const sheet = String(req.query.sheet || "CONTRATOS");
  const mode = String(req.query.mode || "broad");

  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 50), 1), 200);
  const skip = (page - 1) * pageSize;

  if (!q || q.length < 2) {
    return res.json({ total: 0, page, pageSize, columns: [], items: [], matchMode: "broad" });
  }

  const allColumns = await prisma.gridColumn.findMany({ orderBy: { order: "asc" } });
  const visibleColumns = allColumns.filter((column) => !column.hidden);
  const numeroKey = pickNumeroColumnKey(allColumns);

  let where: Prisma.GridRowWhereInput = buildBroadGridSearchWhere(sheet, q);
  let total: number | null = null;
  let matchMode: "broad" | "exactNumero" = "broad";

  if (numeroKey && shouldTryExactNumeroSearch(q, mode)) {
    const exactWhere = buildExactNumeroGridSearchWhere(sheet, numeroKey, q);
    const exactTotal = await prisma.gridRow.count({ where: exactWhere });

    if (exactTotal > 0 || mode === "exactNumero") {
      where = exactWhere;
      total = exactTotal;
      matchMode = "exactNumero";
    }
  }

  const [resolvedTotal, items] = await Promise.all([
    total === null ? prisma.gridRow.count({ where }) : Promise.resolve(total),
    prisma.gridRow.findMany({ where, orderBy: { id: "desc" }, skip, take: pageSize }),
  ]);

  // evita crash de BigInt em JSON
  const safeColumns = visibleColumns.map((c: any) => ({ ...c, id: c.id?.toString?.() ?? c.id }));
  const safeItems = items.map((r: any) => ({ ...r, id: r.id?.toString?.() ?? r.id }));

  res.json({
    total: resolvedTotal,
    page,
    pageSize,
    columns: safeColumns,
    items: safeItems,
    matchMode,
  });
});

// editar 1 célula (mantém "-" e atualiza searchText)
router.patch("/grid/rows/:id", authMiddleware, async (req, res) => {
  const id = toBigIntOrNull(req.params.id);
  if (id === null) return res.status(400).json({ error: "id invalido" });
  const { key, value } = req.body ?? {};
  if (!key) return res.status(400).json({ error: "key obrigatória" });

  const row = await prisma.gridRow.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: "linha não encontrada" });

  const data = ((row.data as any) || {}) as Record<string, any>;
  data[key] = value === null || value === undefined || value === "" ? "-" : value;

  const updated = await prisma.gridRow.update({
    where: { id },
    data: { data, searchText: buildSearchText(data) as any },
  });

  // evita BigInt crash
  res.json({ ...(updated as any), id: (updated as any).id?.toString?.() ?? (updated as any).id });
});

// criar linha (gera rowNumber automaticamente e searchText)
router.post("/grid/rows", authMiddleware, async (req, res) => {
  const sheet = String(req.body?.sheet || "CONTRATOS");
  const data = (req.body?.data || {}) as Record<string, any>;

  const max = await prisma.gridRow.aggregate({
    where: { sheet },
    _max: { rowNumber: true },
  });

  const rowNumber = (max._max.rowNumber ?? 0) + 1;
  const created = await prisma.gridRow.create({
    data: {
      sheet,
      rowNumber,
      data,
      searchText: buildSearchText(data),
    },
  });

  res.json({ ...(created as any), id: (created as any).id?.toString?.() ?? (created as any).id });
});

// excluir linha
router.delete("/grid/rows/:id", authMiddleware, async (req, res) => {
  const id = toBigIntOrNull(req.params.id);
  if (id === null) return res.status(400).json({ error: "id invalido" });
  await prisma.gridRow.delete({ where: { id } });
  res.json({ ok: true });
});

// criar coluna
router.post("/grid/columns", authMiddleware, async (req, res) => {
  const { label, type = "text" } = req.body ?? {};
  if (!label) return res.status(400).json({ error: "label obrigatória" });

  const key =
    String(label)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase() || `col_${Date.now()}`;

  const maxOrder = await prisma.gridColumn.aggregate({ _max: { order: true } });

  const created = await prisma.gridColumn.create({
    data: { key, label, type, order: (maxOrder._max.order ?? 0) + 1 },
  });

  res.json({ ...(created as any), id: (created as any).id?.toString?.() ?? (created as any).id });
});

// excluir coluna (remove a key de todas as linhas e atualiza searchText)
router.delete("/grid/columns/:key", authMiddleware, async (req, res) => {
  const key = req.params.key;

  await prisma.$transaction(async (tx) => {
    await tx.gridColumn.delete({ where: { key } });

    const rows = await tx.gridRow.findMany({ select: { id: true, data: true } });
    for (const r of rows) {
      const data = ((r.data as any) || {}) as Record<string, any>;
      delete data[key];

      await tx.gridRow.update({
        where: { id: r.id as any },
        data: { data, searchText: buildSearchText(data) },
      });
    }
  });

  res.json({ ok: true });
});

// import excel para GRID (cria colunas e linhas)
// body: sheet=CONTRATOS (ou qualquer aba), mode=merge|replace
router.post("/import/grid", authMiddleware, importLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo .xlsx" });

    const sheet = String(req.body?.sheet || "CONTRATOS");
    const mode = String(req.body?.mode || "merge"); // merge | replace
    const { columns, rows } = parseSheetToGrid(req.file.buffer, sheet);

    // limites basicos (anti travar)
    if (rows.length > 20000) {
      return res.status(400).json({ error: "Planilha muito grande (limite 20.000 linhas)." });
    }
    if (columns.length > 300) {
      return res.status(400).json({ error: "Muitas colunas (limite 300)." });
    }

    // cria colunas que faltam
    const existing = await prisma.gridColumn.findMany();
    const existingKeys = new Set(existing.map((c) => c.key));

    const maxOrder = await prisma.gridColumn.aggregate({ _max: { order: true } });
    let order = (maxOrder._max.order ?? 0) + 1;

    const toCreate = columns
      .filter((c) => !existingKeys.has(c.key))
      .map((c) => ({ key: c.key, label: c.label, type: "text", order: order++ }));

    if (toCreate.length) {
      await prisma.gridColumn.createMany({ data: toCreate, skipDuplicates: true });
    }

    // se for replace, apaga apenas aquela aba
    if (mode === "replace") {
      await prisma.gridRow.deleteMany({ where: { sheet } });
    }

    // evita timeout de transacao interativa com lotes grandes
    const BATCH = 200;
    const UPSERT_CONCURRENCY = 25;

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);

      for (let j = 0; j < chunk.length; j += UPSERT_CONCURRENCY) {
        const upserts = chunk.slice(j, j + UPSERT_CONCURRENCY).map((r) => {
          const searchText = buildSearchText(r.data);

          return prisma.gridRow.upsert({
            where: { sheet_rowNumber: { sheet, rowNumber: r.rowNumber } },
            create: { sheet, rowNumber: r.rowNumber, data: r.data, searchText },
            update: { data: r.data, searchText },
          });
        });

        await Promise.all(upserts);
      }
    }

    res.json({ ok: true, sheet, mode, colunas: columns.length, linhas: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar planilha.";
    return res.status(500).json({ error: message });
  }
});

// -----------------------------
// MODELAGEM NOVA (Cliente, GP, FollowUp)
// -----------------------------

router.get("/clientes", authMiddleware, async (_req, res) => {
  try {
    await syncClientesFromGrid();
  } catch (error) {
    console.error("Falha ao sincronizar clientes da planilha:", error);
  }

  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { gps: true } } },
  });
  res.json(clientes);
});

router.post("/clientes", authMiddleware, async (req, res) => {
  const nome = String(req.body?.nome ?? "").trim();
  if (!nome) return res.status(400).json({ error: "nome obrigatorio" });

  const created = await prisma.cliente.create({ data: { nome } });
  res.json(created);
});

router.get("/gps", authMiddleware, async (req, res) => {
  try {
    await ensureGpsAndClientesSynced();
  } catch (error) {
    console.error("Falha ao sincronizar GPs da planilha:", error);
  }

  const chave = String(req.query.chave ?? "").trim().toUpperCase();
  const clienteId = toIntOrNull(req.query.clienteId);
  const clienteNome = String(req.query.clienteNome ?? "").trim();
  const grupo = String(req.query.grupo ?? "").trim();
  const ano = toIntOrNull(req.query.ano);

  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 200);
  const skip = (page - 1) * pageSize;

  const where: any = {
    ...(chave ? { chave: { contains: chave, mode: "insensitive" } } : {}),
    ...(clienteId ? { clienteId } : {}),
    ...(clienteNome ? { cliente: { nome: { contains: clienteNome, mode: "insensitive" } } } : {}),
    ...(grupo ? { grupo: { contains: grupo, mode: "insensitive" } } : {}),
    ...(ano ? { ano } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.gp.count({ where }),
    prisma.gp.findMany({
      where,
      orderBy: [{ ano: "desc" }, { chave: "asc" }],
      skip,
      take: pageSize,
      include: {
        cliente: true,
        _count: { select: { followUps: true } },
      },
    }),
  ]);

  res.json({ total, page, pageSize, items });
});

router.get("/gps/:id", authMiddleware, async (req, res) => {
  const id = toIntOrNull(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });

  const gp = await prisma.gp.findUnique({
    where: { id },
    include: {
      cliente: true,
      followUps: { orderBy: [{ ultimoContato: "desc" }, { id: "desc" }] },
    },
  });

  if (!gp) return res.status(404).json({ error: "gp nao encontrado" });
  res.json(gp);
});

router.post("/gps", authMiddleware, async (req, res) => {
  const chave = normalizeGpChave(req.body?.chave);
  if (!isGpChaveValid(chave)) {
    return res.status(400).json({ error: "chave deve seguir o formato XXXX-NN ou um numero da planilha" });
  }

  const created = await prisma.gp.create({
    data: {
      chave,
      grupo: req.body?.grupo ? String(req.body.grupo).trim() : null,
      ano: toIntOrNull(req.body?.ano),
      os: toBool(req.body?.os, false),
      aditivo: toBool(req.body?.aditivo, false),
      tipoServico: req.body?.tipoServico ? String(req.body.tipoServico).trim() : null,
      descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
      clienteId: toIntOrNull(req.body?.clienteId),
    },
  });

  res.json(created);
});

router.patch("/gps/:id", authMiddleware, async (req, res) => {
  const id = toIntOrNull(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });

  const data: Record<string, any> = {};

  if (req.body?.chave !== undefined) {
    const chave = normalizeGpChave(req.body.chave);
    if (!isGpChaveValid(chave)) {
      return res.status(400).json({ error: "chave deve seguir o formato XXXX-NN ou um numero da planilha" });
    }
    data.chave = chave;
  }
  if (req.body?.grupo !== undefined) data.grupo = req.body.grupo ? String(req.body.grupo).trim() : null;
  if (req.body?.ano !== undefined) data.ano = toIntOrNull(req.body.ano);
  if (req.body?.os !== undefined) data.os = toBool(req.body.os);
  if (req.body?.aditivo !== undefined) data.aditivo = toBool(req.body.aditivo);
  if (req.body?.tipoServico !== undefined) data.tipoServico = req.body.tipoServico ? String(req.body.tipoServico).trim() : null;
  if (req.body?.descricao !== undefined) data.descricao = req.body.descricao ? String(req.body.descricao).trim() : null;
  if (req.body?.clienteId !== undefined) data.clienteId = toIntOrNull(req.body.clienteId);

  const updated = await prisma.gp.update({ where: { id }, data });
  res.json(updated);
});

router.delete("/gps/:id", authMiddleware, async (req, res) => {
  const id = toIntOrNull(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });
  await prisma.gp.delete({ where: { id } });
  res.json({ ok: true });
});

router.get("/followups", authMiddleware, async (req, res) => {
  const gpId = toIntOrNull(req.query.gpId);
  const gpChave = String(req.query.gpChave ?? "").trim().toUpperCase();
  const status = String(req.query.status ?? "").trim();
  const date = String(req.query.date ?? "").trim();

  if (date && !isIsoDateOnly(date)) {
    return res.status(400).json({ error: "data invalida" });
  }

  const dayStart = date ? new Date(`${date}T00:00:00.000Z`) : null;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) : null;

  const where: any = {
    ...(gpId ? { gpId } : {}),
    ...(gpChave ? { gp: { chave: { equals: gpChave, mode: "insensitive" } } } : {}),
    ...(status ? { status: { contains: status, mode: "insensitive" } } : {}),
    ...(dayStart && dayEnd
      ? {
          OR: [
            { convite: { gte: dayStart, lt: dayEnd } },
            { entrega: { gte: dayStart, lt: dayEnd } },
            { ultimoContato: { gte: dayStart, lt: dayEnd } },
          ],
        }
      : {}),
  };

  const items = await prisma.followUp.findMany({
    where,
    orderBy: [{ ultimoContato: "desc" }, { id: "desc" }],
    include: {
      gp: { include: { cliente: true } },
    },
  });

  res.json(items);
});

router.post("/followups", authMiddleware, async (req, res) => {
  const gpId = toIntOrNull(req.body?.gpId);
  const gpChave = normalizeGpChave(req.body?.gpChave);

  let resolvedGpId = gpId;
  if (!resolvedGpId && gpChave) {
    const gp = await prisma.gp.findUnique({ where: { chave: gpChave } });
    resolvedGpId = gp?.id ?? null;
  }
  if (!resolvedGpId) return res.status(400).json({ error: "informe gpId ou gpChave valido" });

  const created = await prisma.followUp.create({
    data: {
      gpId: resolvedGpId,
      convite: toDateOrNull(req.body?.convite),
      entrega: toDateOrNull(req.body?.entrega),
      ultimoContato: toDateOrNull(req.body?.ultimoContato),
      status: req.body?.status ? String(req.body.status).trim() : null,
      valor: toNumberOrNull(req.body?.valor),
    },
  });

  res.json(created);
});

router.patch("/followups/:id", authMiddleware, async (req, res) => {
  const id = toIntOrNull(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });

  const data: Record<string, any> = {};
  if (req.body?.convite !== undefined) data.convite = toDateOrNull(req.body.convite);
  if (req.body?.entrega !== undefined) data.entrega = toDateOrNull(req.body.entrega);
  if (req.body?.ultimoContato !== undefined) data.ultimoContato = toDateOrNull(req.body.ultimoContato);
  if (req.body?.status !== undefined) data.status = req.body.status ? String(req.body.status).trim() : null;
  if (req.body?.valor !== undefined) data.valor = toNumberOrNull(req.body.valor);

  const updated = await prisma.followUp.update({ where: { id }, data });
  res.json(updated);
});

router.delete("/followups/:id", authMiddleware, async (req, res) => {
  const id = toIntOrNull(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });
  await prisma.followUp.delete({ where: { id } });
  res.json({ ok: true });
});

