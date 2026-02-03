-- AlterTable
ALTER TABLE "GridRow" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "GridRow_searchText_idx" ON "GridRow"("searchText");
