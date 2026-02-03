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
