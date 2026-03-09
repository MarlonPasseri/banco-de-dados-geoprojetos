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
  const Icon = toast?.type === "success" ? CheckCircle2 : toast?.type === "error" ? XCircle : Info;

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="toast-shell fixed right-4 top-4 z-50 w-[360px] max-w-[92vw]"
          data-type={toast.type}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="toast-icon flex-shrink-0">
              <Icon size={16} />
            </div>

            <div className="flex-1">
              {toast.title && <p className="toast-title text-sm font-semibold">{toast.title}</p>}
              <p className="toast-text text-sm">{toast.text}</p>
            </div>

            <button
              className="toast-close transition-colors"
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
