import { AnimatePresence, motion } from "framer-motion";

export type ToastKind = "info" | "success" | "error" | "warning";

export type ToastState = {
  message: string;
  kind: ToastKind;
} | null;

type ToastProps = {
  toast: ToastState;
};

const icons: Record<ToastKind, string> = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
  info:    "·",
};

export function Toast({ toast }: ToastProps) {
  return (
    <div className="toast-portal" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            className={`toast ${toast.kind}`}
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="toast-icon" aria-hidden="true">
              {icons[toast.kind]}
            </span>
            <span className="toast-text">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
