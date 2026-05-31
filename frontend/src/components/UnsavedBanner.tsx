import { AnimatePresence, motion } from "framer-motion";

type UnsavedBannerProps = {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
};

export function UnsavedBanner({ visible, onSave, onDiscard, saving }: UnsavedBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="unsaved-banner"
          role="alert"
          aria-live="assertive"
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="unsaved-banner-inner">
            <span className="unsaved-banner-icon" aria-hidden="true">⚠️</span>
            <span className="unsaved-banner-text">
              You have unsaved changes. Your changes will be lost if you navigate away.
            </span>
            <div className="unsaved-banner-actions">
              <button
                className="btn-ghost"
                onClick={onDiscard}
                disabled={saving}
              >
                Discard
              </button>
              <button
                className="primary"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save now"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
