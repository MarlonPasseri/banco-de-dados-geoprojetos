import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info";
export type ToastMsg = { id: string; type: ToastType; title?: string; text: string };

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastMsg | null;
  onClose: () => void;
}) {
  const style =
    toast?.type === "success"
      ? "border-emerald-300 bg-white"
      : toast?.type === "error"
      ? "border-red-300 bg-white"
      : "border-zinc-200 bg-white";

  const accent =
    toast?.type === "success"
      ? "bg-emerald-100"
      : toast?.type === "error"
      ? "bg-red-100"
      : "bg-zinc-100";

  const Icon = toast?.type === "success" ? CheckCircle2 : toast?.type === "error" ? XCircle : Info;

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className={`fixed right-4 top-4 z-50 w-[360px] max-w-[92vw] ${style} border rounded-2xl shadow-lg`}
        >
          <div className="p-4 flex items-start gap-3">
            <div className={`h-8 w-8 rounded-xl ${accent} text-zinc-900 grid place-items-center flex-shrink-0`}>
              <Icon size={16} />
            </div>

            <div className="flex-1">
              {toast.title && <p className="text-sm font-semibold text-zinc-900">{toast.title}</p>}
              <p className="text-sm text-zinc-700">{toast.text}</p>
            </div>

            <button
              className="text-zinc-500 hover:text-zinc-900 transition-colors"
              onClick={onClose}
              aria-label="Fechar"
            >
              x
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
