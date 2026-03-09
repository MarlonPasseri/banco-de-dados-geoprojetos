CREATE SCHEMA IF NOT EXISTS bi;

CREATE OR REPLACE VIEW bi.contratos AS
SELECT
  c.numero AS contrato_numero,
  c.ano,
  c.cliente,
  c.grupo,
  c."tipoServico" AS tipo_servico,
  c.resp AS responsavel,
  c.status,
  c."nomeProjetoLocal" AS nome_projeto_local,
  c."followUp" AS follow_up,
  c.convite,
  c.entrega,
  c."ultimoContato" AS ultimo_contato,
  c."prazoMes" AS prazo_mes,
  c.go,
  c.certidao,
  c.contatos,
  c.observacoes,
  c.valor AS valor_contrato,
  c."mediaMensal" AS media_mensal,
  c.total AS total_contrato,
  COALESCE(parcelas.quantidade_parcelas, 0) AS quantidade_parcelas,
  COALESCE(parcelas.total_parcelas, 0::NUMERIC(18,2)) AS total_parcelas,
  parcelas.primeira_parcela,
  parcelas.ultima_parcela,
  c."createdAt" AS criado_em,
  c."updatedAt" AS atualizado_em
FROM "Contrato" c
LEFT JOIN (
  SELECT
    p."contratoNumero",
    COUNT(*)::INTEGER AS quantidade_parcelas,
    SUM(p.valor)::NUMERIC(18,2) AS total_parcelas,
    MIN(p.parcela)::INTEGER AS primeira_parcela,
    MAX(p.parcela)::INTEGER AS ultima_parcela
  FROM "Parcela" p
  GROUP BY p."contratoNumero"
) parcelas ON parcelas."contratoNumero" = c.numero;

CREATE OR REPLACE VIEW bi.parcelas AS
SELECT
  p.id AS parcela_id,
  p."contratoNumero" AS contrato_numero,
  p.parcela,
  p.valor AS valor_parcela,
  c.ano,
  c.cliente,
  c.grupo,
  c."tipoServico" AS tipo_servico,
  c.resp AS responsavel,
  c.status,
  c."nomeProjetoLocal" AS nome_projeto_local,
  c.convite,
  c.entrega,
  c."ultimoContato" AS ultimo_contato,
  c.total AS total_contrato,
  c."createdAt" AS contrato_criado_em,
  c."updatedAt" AS contrato_atualizado_em
FROM "Parcela" p
JOIN "Contrato" c ON c.numero = p."contratoNumero";

CREATE OR REPLACE VIEW bi.gps AS
SELECT
  g.id AS gp_id,
  g.chave AS gp_chave,
  g.grupo,
  g.ano,
  g.os,
  g.aditivo,
  g."tipoServico" AS tipo_servico,
  g.descricao,
  g."clienteId" AS cliente_id,
  c.nome AS cliente,
  g."createdAt" AS criado_em,
  g."updatedAt" AS atualizado_em
FROM "Gp" g
LEFT JOIN "Cliente" c ON c.id = g."clienteId";

CREATE OR REPLACE VIEW bi.followups AS
SELECT
  f.id AS followup_id,
  f."gpId" AS gp_id,
  g.chave AS gp_chave,
  g.grupo,
  g.ano,
  g.os,
  g.aditivo,
  g."tipoServico" AS tipo_servico,
  g.descricao,
  g."clienteId" AS cliente_id,
  c.nome AS cliente,
  f.convite,
  f.entrega,
  f."ultimoContato" AS ultimo_contato,
  f.status,
  f.valor,
  f."createdAt" AS criado_em,
  f."updatedAt" AS atualizado_em
FROM "FollowUp" f
JOIN "Gp" g ON g.id = f."gpId"
LEFT JOIN "Cliente" c ON c.id = g."clienteId";

CREATE OR REPLACE VIEW bi.clientes AS
SELECT
  c.id AS cliente_id,
  c.nome AS cliente,
  COUNT(DISTINCT g.id)::INTEGER AS quantidade_gps,
  COUNT(DISTINCT f.id)::INTEGER AS quantidade_followups,
  c."createdAt" AS criado_em,
  c."updatedAt" AS atualizado_em
FROM "Cliente" c
LEFT JOIN "Gp" g ON g."clienteId" = c.id
LEFT JOIN "FollowUp" f ON f."gpId" = g.id
GROUP BY c.id, c.nome, c."createdAt", c."updatedAt";

\if :{?bi_user}
\if :{?bi_password}
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  :'bi_user',
  :'bi_password'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = :'bi_user'
)
\gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L',
  :'bi_user',
  :'bi_password'
)
WHERE EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = :'bi_user'
)
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'bi_user')
\gexec

SELECT format('GRANT USAGE ON SCHEMA bi TO %I', :'bi_user')
\gexec

SELECT format('GRANT SELECT ON ALL TABLES IN SCHEMA bi TO %I', :'bi_user')
\gexec

SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA bi GRANT SELECT ON TABLES TO %I', :'bi_user')
\gexec
\endif
\endif
