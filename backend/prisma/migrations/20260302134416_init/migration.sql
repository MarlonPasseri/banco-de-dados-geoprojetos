-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gp" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "grupo" TEXT,
    "ano" INTEGER,
    "os" BOOLEAN NOT NULL DEFAULT false,
    "aditivo" BOOLEAN NOT NULL DEFAULT false,
    "tipoServico" TEXT,
    "descricao" TEXT,
    "clienteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" SERIAL NOT NULL,
    "gpId" INTEGER NOT NULL,
    "convite" TIMESTAMP(3),
    "entrega" TIMESTAMP(3),
    "ultimoContato" TIMESTAMP(3),
    "status" TEXT,
    "valor" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nome_key" ON "Cliente"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Gp_chave_key" ON "Gp"("chave");

-- CreateIndex
CREATE INDEX "Gp_grupo_idx" ON "Gp"("grupo");

-- CreateIndex
CREATE INDEX "Gp_ano_idx" ON "Gp"("ano");

-- CreateIndex
CREATE INDEX "Gp_clienteId_idx" ON "Gp"("clienteId");

-- CreateIndex
CREATE INDEX "FollowUp_gpId_idx" ON "FollowUp"("gpId");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE INDEX "FollowUp_ultimoContato_idx" ON "FollowUp"("ultimoContato");

-- AddForeignKey
ALTER TABLE "Gp" ADD CONSTRAINT "Gp_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_gpId_fkey" FOREIGN KEY ("gpId") REFERENCES "Gp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
