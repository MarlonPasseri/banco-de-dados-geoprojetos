import { useEffect, useState, type DragEvent } from "react";
import { importGrid, fetchGrid } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { motion } from "framer-motion";
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
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setToast({
        id: safeUUID(),
        type: 'error',
        title: 'Arquivo inválido',
        text: 'Envie apenas arquivos .xlsx',
      });
      return;
    }
    setFile(f);
  }

  async function onImport() {
    if (!file) {
      setToast({ id: safeUUID(), type: 'error', title: 'Faltou o arquivo', text: 'Selecione um .xlsx' });
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
        type: 'success',
        title: 'Importação concluída',
        text: `Colunas: ${r.colunas} • Linhas: ${r.linhas}`,
      });
      await loadSummary();
      setProgress(100);
    } catch (e: any) {
      setToast({
        id: safeUUID(),
        type: 'error',
        title: 'Erro ao importar',
        text: e?.message || 'Falha ao importar',
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

      <motion.div
        className="card p-5 flex items-end justify-between gap-3"
        variants={item}
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Carga</div>
          <h1 className="text-2xl font-semibold heading">Importar Excel</h1>
          <p className="text-sm text-zinc-500">
            Importe a aba do Excel para ficar salva no banco. Depois é só consultar e editar.
          </p>
        </div>

        {summary && (
          <div className="card px-4 py-3">
            <div className="text-xs text-zinc-500">Status atual</div>
            <div className="text-sm flex items-center gap-2 flex-wrap">
              <span className="badge">Linhas: {summary.rows}</span>
              <span className="badge">Colunas: {summary.columns}</span>
              <span className="badge">Aba: {sheet}</span>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        className="card p-5 space-y-4 bg-white/80"
        variants={item}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Aba</label>
            <input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Arquivo (.xlsx)</label>
            <label
              className={`border-2 border-dashed rounded-2xl px-4 py-6 text-sm text-center cursor-pointer transition-all ${
                isDragging ? 'border-zinc-900 bg-zinc-900/5' : 'border-zinc-200 bg-white'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                className="hidden"
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              <div className="font-medium">Arraste um .xlsx aqui</div>
              <div className="text-xs text-zinc-500 mt-1">
                ou clique para selecionar (aba atual: <b>{sheet}</b>)
              </div>
              {file && (
                <div className="mt-2 text-xs text-zinc-600 bg-zinc-100 rounded-xl px-2 py-1 inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {file.name}
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">Modo:</span>
          <button className={`btn ${mode === 'merge' ? 'btn-primary' : ''}`} onClick={() => setMode('merge')}>
            Atualizar (merge)
          </button>
          <button className={`btn ${mode === 'replace' ? 'btn-primary' : ''}`} onClick={() => setMode('replace')}>
            Substituir (replace)
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-primary" onClick={onImport} disabled={loading || !file}>
            {loading ? 'Importando...' : 'Importar'}
          </button>
          {progress > 0 && (
            <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden max-w-xs min-w-[180px]">
              <div
                className="h-full bg-zinc-900 transition-all"
                style={{ width: `${progress}%` }}
                aria-valuenow={progress}
              />
            </div>
          )}
          <p className="text-xs text-zinc-500">
            Dica: você só precisa importar quando quiser atualizar os dados.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
