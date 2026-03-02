// backend/src/routes.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { signToken, authMiddleware } from "./auth.js";
import { parseContratosSheet, parseSheetToGrid } from "./importExcel.js";

export const router = Router();

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

router.get("/health", (_req, res) => res.json({ ok: true }));

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "API online",
    endpoints: [
      "/api/health",
      "/api/setup",
      "/api/auth/login",
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
  return /^[A-Z0-9]{4}-\d{2}$/.test(chave);
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

// -----------------------------
// AUTH
// -----------------------------
router.post("/setup", async (req, res) => {
  const setupToken = process.env.SETUP_TOKEN;
  if (setupToken) {
    const provided = String(req.headers["x-setup-token"] ?? req.query.token ?? "").trim();
    if (provided !== setupToken) return res.status(403).json({ error: "setup bloqueado" });
  }

  const username = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASS || "admin123";

  const exists = await prisma.user.findUnique({ where: { username } });
  if (!exists) {
    const hash = await bcrypt.hash(pass, 10);
    await prisma.user.create({ data: { username, password: hash } });
  }

  res.json({ ok: true });
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "Credenciais inválidas" });

  const u = await prisma.user.findUnique({ where: { username } });
  if (!u) return res.status(401).json({ error: "Usuário/senha inválidos" });

  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.status(401).json({ error: "Usuário/senha inválidos" });

  const token = signToken({ sub: u.id, username: u.username });
  res.json({ token });
});

// -----------------------------
// IMPORT CONTRATOS (schema fixo)
// -----------------------------
router.post("/import/contratos", authMiddleware, upload.single("file"), async (req, res) => {
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

  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 50), 1), 200);
  const skip = (page - 1) * pageSize;

  if (!q || q.length < 2) {
    return res.json({ total: 0, page, pageSize, columns: [], items: [] });
  }

  const where: any = {
    sheet,
    searchText: { contains: q, mode: "insensitive" },
  };

  const [total, items, columns] = await Promise.all([
    prisma.gridRow.count({ where }),
    prisma.gridRow.findMany({ where, orderBy: { id: "desc" }, skip, take: pageSize }),
    prisma.gridColumn.findMany({ where: { hidden: false }, orderBy: { order: "asc" } }),
  ]);

  // evita crash de BigInt em JSON
  const safeColumns = columns.map((c: any) => ({ ...c, id: c.id?.toString?.() ?? c.id }));
  const safeItems = items.map((r: any) => ({ ...r, id: r.id?.toString?.() ?? r.id }));

  res.json({
    total,
    page,
    pageSize,
    columns: safeColumns,
    items: safeItems,
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
router.post("/import/grid", authMiddleware, upload.single("file"), async (req, res) => {
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
  const chave = String(req.query.chave ?? "").trim().toUpperCase();
  const clienteId = toIntOrNull(req.query.clienteId);
  const grupo = String(req.query.grupo ?? "").trim();
  const ano = toIntOrNull(req.query.ano);

  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 200);
  const skip = (page - 1) * pageSize;

  const where: any = {
    ...(chave ? { chave: { contains: chave, mode: "insensitive" } } : {}),
    ...(clienteId ? { clienteId } : {}),
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
    return res.status(400).json({ error: "chave deve seguir o formato XXXX-NN" });
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
      return res.status(400).json({ error: "chave deve seguir o formato XXXX-NN" });
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

  const where: any = {
    ...(gpId ? { gpId } : {}),
    ...(gpChave ? { gp: { chave: { equals: gpChave, mode: "insensitive" } } } : {}),
    ...(status ? { status: { contains: status, mode: "insensitive" } } : {}),
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

