-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "numero" INTEGER NOT NULL,
    "ordemDataEntrega" INTEGER,
    "followUp" TEXT,
    "grupo" TEXT,
    "convite" TIMESTAMP(3),
    "ano" INTEGER,
    "entrega" TIMESTAMP(3),
    "ultimoContato" TIMESTAMP(3),
    "nomeProjetoLocal" TEXT,
    "cliente" TEXT,
    "tipoServico" TEXT,
    "resp" TEXT,
    "status" TEXT,
    "contatos" TEXT,
    "valor" DECIMAL(14,2),
    "prazoMes" INTEGER,
    "go" TEXT,
    "observacoes" TEXT,
    "certidao" TEXT,
    "mediaMensal" DECIMAL(14,2),
    "total" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("numero")
);

-- CreateTable
CREATE TABLE "Parcela" (
    "id" BIGSERIAL NOT NULL,
    "contratoNumero" INTEGER NOT NULL,
    "parcela" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Contrato_status_idx" ON "Contrato"("status");

-- CreateIndex
CREATE INDEX "Contrato_cliente_idx" ON "Contrato"("cliente");

-- CreateIndex
CREATE INDEX "Contrato_ano_idx" ON "Contrato"("ano");

-- CreateIndex
CREATE INDEX "Parcela_contratoNumero_idx" ON "Parcela"("contratoNumero");

-- CreateIndex
CREATE UNIQUE INDEX "Parcela_contratoNumero_parcela_key" ON "Parcela"("contratoNumero", "parcela");

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_contratoNumero_fkey" FOREIGN KEY ("contratoNumero") REFERENCES "Contrato"("numero") ON DELETE CASCADE ON UPDATE CASCADE;
