import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type DialogConfig = {
  title: string;
  description?: string;
  /** When provided, shows a text input requiring a non-empty value before confirming. */
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

type DialogProps = {
  config: DialogConfig | null;
};

export function Dialog({ config }: DialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInput = config?.placeholder !== undefined;

  useEffect(() => {
    if (config && hasInput) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [config, hasInput]);

  function handleConfirm() {
    if (!config) return;
    if (hasInput) {
      const value = inputRef.current?.value.trim() ?? "";
      if (!value) return;
      config.onConfirm(value);
    } else {
      config.onConfirm("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") config?.onCancel();
  }

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          className="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) config.onCancel();
          }}
        >
          <motion.div
            className="dialog"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="dialog-header">
              <div className="dialog-title" id="dialog-title">
                {config.title}
              </div>
            </div>

            <div className="dialog-body">
              {config.description ? (
                <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: hasInput ? 12 : 0 }}>
                  {config.description}
                </p>
              ) : null}
              {hasInput ? (
                <input
                  ref={inputRef}
                  defaultValue={config.defaultValue ?? ""}
                  placeholder={config.placeholder}
                  aria-label={config.title}
                />
              ) : null}
            </div>

            <div className="dialog-footer">
              <button onClick={config.onCancel}>Cancel</button>
              <button
                className={config.confirmDanger ? "danger" : "primary"}
                onClick={handleConfirm}
              >
                {config.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
