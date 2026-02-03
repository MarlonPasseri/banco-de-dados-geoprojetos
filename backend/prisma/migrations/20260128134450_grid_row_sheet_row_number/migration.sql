-- 1) adiciona sheet com default
ALTER TABLE "GridRow"
ADD COLUMN IF NOT EXISTS "sheet" TEXT NOT NULL DEFAULT 'CONTRATOS';

-- 2) adiciona rowNumber como NULLABLE primeiro (para não quebrar dados existentes)
ALTER TABLE "GridRow"
ADD COLUMN IF NOT EXISTS "rowNumber" INTEGER;

-- 3) preenche rowNumber para linhas antigas (fallback usando id)
-- Se você preferir sequência 1..N, dá pra fazer com row_number() também,
-- mas id já é suficiente e garante único.
UPDATE "GridRow"
SET "rowNumber" = CAST("id" AS INTEGER)
WHERE "rowNumber" IS NULL;

-- 4) agora torna rowNumber obrigatório
ALTER TABLE "GridRow"
ALTER COLUMN "rowNumber" SET NOT NULL;

-- 5) cria unique (sheet, rowNumber)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GridRow_sheet_rowNumber_key'
  ) THEN
    ALTER TABLE "GridRow"
    ADD CONSTRAINT "GridRow_sheet_rowNumber_key" UNIQUE ("sheet", "rowNumber");
  END IF;
END $$;

-- 6) index por sheet (performance)
CREATE INDEX IF NOT EXISTS "GridRow_sheet_idx" ON "GridRow" ("sheet");
