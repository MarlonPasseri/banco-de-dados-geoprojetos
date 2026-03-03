import { useEffect, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, RefreshCw, UploadCloud } from "lucide-react";
import { importGrid, fetchGrid } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { safeUUID } from "../utils/uuid";

export default function ImportPage() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("CONTRATOS");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [summary, setSummary] = useState<{ rows: number; columns: number } | null>(null);

  async function loadSummary() {
    try {
      const r = await fetchGrid({ page: 1, pageSize: 1 });
      setSummary({ rows: r.total, columns: r.columns.length });
    } catch {
      setSummary(null);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  function handleFile(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Arquivo invalido",
        text: "Envie apenas arquivos .xlsx",
      });
      return;
    }
    setFile(f);
  }

  async function onImport() {
    if (!file) {
      setToast({ id: safeUUID(), type: "error", title: "Faltou o arquivo", text: "Selecione um .xlsx" });
      return;
    }

    setLoading(true);
    setProgress(12);
    const timer = setInterval(() => {
      setProgress((p) => Math.min(90, p + 8));
    }, 180);

    try {
      const r = await importGrid(file, sheet, mode);
      setToast({
        id: safeUUID(),
        type: "success",
        title: "Importacao concluida",
        text: `Colunas: ${r.colunas} • Linhas: ${r.linhas}`,
      });
      await loadSummary();
      setProgress(100);
    } catch (e: any) {
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Erro ao importar",
        text: e?.message || "Falha ao importar",
      });
    } finally {
      clearInterval(timer);
      setLoading(false);
      setTimeout(() => setProgress(0), 600);
      setIsDragging(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0] || null;
    handleFile(f);
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div className="page-hero" variants={item}>
        <div>
          <div className="page-kicker">Carga</div>
          <h1 className="page-title inline-flex items-center gap-2">
            <UploadCloud size={22} />
            Importar Excel
          </h1>
          <p className="page-desc">Importe planilhas para manter os dados atualizados no banco.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary ? (
            <>
              <span className="badge">Linhas: {summary.rows}</span>
              <span className="badge">Colunas: {summary.columns}</span>
            </>
          ) : (
            <span className="badge">Resumo indisponivel</span>
          )}
          <span className="badge">Aba: {sheet}</span>
        </div>
      </motion.div>

      <motion.div className="panel-soft space-y-4" variants={item}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Aba</label>
              <input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm text-zinc-600">Modo de importacao</div>
              <div className="grid grid-cols-2 gap-2">
                <button className={`btn ${mode === "merge" ? "btn-primary" : ""}`} onClick={() => setMode("merge")}>
                  Merge
                </button>
                <button className={`btn ${mode === "replace" ? "btn-primary" : ""}`} onClick={() => setMode("replace")}>
                  Replace
                </button>
              </div>
            </div>

            <div className="text-xs text-zinc-500">
              Merge atualiza linhas existentes. Replace substitui os dados da aba selecionada.
            </div>
          </div>

          <div className="space-y-3">
            <label
              className={`block cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all ${
                isDragging ? "border-sky-400 bg-sky-50" : "border-zinc-200 bg-white"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input className="hidden" type="file" accept=".xlsx" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              <div className="mx-auto mb-2 inline-flex rounded-xl bg-zinc-100 p-2 text-zinc-700">
                <FileSpreadsheet size={18} />
              </div>
              <div className="text-sm font-semibold text-zinc-800">Arraste um arquivo .xlsx ou clique para selecionar</div>
              <div className="mt-1 text-xs text-zinc-500">A importacao sera aplicada na aba: {sheet}</div>
              {file && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {file.name}
                </div>
              )}
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" onClick={onImport} disabled={loading || !file}>
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar"
                )}
              </button>
              <button className="btn" onClick={loadSummary} disabled={loading}>
                <RefreshCw size={14} />
                Atualizar resumo
              </button>
            </div>

            {progress > 0 && (
              <div className="h-2 max-w-sm overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full progress-fill transition-all"
                  style={{ width: `${progress}%` }}
                  aria-valuenow={progress}
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
