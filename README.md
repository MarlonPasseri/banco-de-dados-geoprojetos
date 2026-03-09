# Banco de Dados GeoProjetos

![CI](https://github.com/MarlonPasseri/banco-de-dados-geoprojetos/actions/workflows/ci.yml/badge.svg)
![Last Commit](https://img.shields.io/github/last-commit/MarlonPasseri/banco-de-dados-geoprojetos)
![Repo Size](https://img.shields.io/github/repo-size/MarlonPasseri/banco-de-dados-geoprojetos)

## Stack
- React + Vite
- Express + Prisma
- Postgres + Docker

Este projeto importa a aba **CONTRATOS** do Excel pela UI, faz login (JWT) e disponibiliza consultas.

## Requisitos
- Node 18+ (recomendado 20+)
- Docker Desktop (para Postgres)

## 1) Subir o banco
Na raiz do projeto:
```bash
docker compose up -d
```

## 2) Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```
API: http://localhost:3001/api

Usuário padrão (criado automaticamente ao abrir a tela de login):
- user: `admin`
- pass: `admin123`

## 3) Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```
App: http://localhost:5173

## Importação
- Faça login
- Vá em **Importar**
- Envie um `.xlsx` contendo a aba **CONTRATOS**

## Observação
As colunas 1..60 (parcelas) são normalizadas na tabela `Parcela` (uma linha por parcela).

## Persistencia de dados no Docker

### 1) Na mesma maquina (nao perder dados existentes)
- Use sempre: `docker compose up -d`
- Para parar: `docker compose stop`
- Evite: `docker compose down -v` (o `-v` remove o volume e apaga os dados)

### 2) Em outra maquina (levar os dados atuais)
Os dados do Postgres ficam no volume Docker local. Para migrar para outra maquina, faca backup e restore.

#### Backup (maquina origem)
- PowerShell: `./scripts/db-backup.ps1`
- Bash: `./scripts/db-backup.sh`

Isso gera um arquivo `.sql` em `backups/`.

#### Restore (maquina destino)
1. Suba o banco vazio com `docker compose up -d`
2. Copie o arquivo `.sql` para a nova maquina
3. Restaure:
   - PowerShell: `./scripts/db-restore.ps1 -InputPath backups/SEU_ARQUIVO.sql`
   - Bash: `./scripts/db-restore.sh backups/SEU_ARQUIVO.sql`

### 3) Migracoes Prisma em ambiente de deploy
Para subir schema sem risco de reset de dados, use:
- `npx prisma migrate deploy`

Evite `prisma migrate dev` fora do ambiente de desenvolvimento.

## Power BI

### Preparar views para relatorio
- PowerShell: `./scripts/powerbi-setup.ps1`
- Bash: `./scripts/powerbi-setup.sh`

Isso cria a schema `bi` com views prontas para consumo:
- `bi.contratos`
- `bi.parcelas`
- `bi.gps`
- `bi.followups`
- `bi.clientes`

### Criar usuario somente leitura para o Power BI
- PowerShell: `./scripts/powerbi-setup.ps1 -BiPassword "SUA_SENHA_FORTE"`
- Bash: `./scripts/powerbi-setup.sh powerbi_reader "SUA_SENHA_FORTE"`

### Conectar no Power BI Desktop
- Conector: `PostgreSQL`
- Servidor: `localhost:5433`
- Banco: `contratos`
- Usuario: `powerbi_reader` (ou `postgres`, se optar por nao criar usuario dedicado)

Escolha as views da schema `bi` no navegador do Power BI para montar os relatorios.

### Publicacao no Power BI Service
- Como o banco roda local/Docker, a atualizacao agendada exige `On-premises Data Gateway`.
