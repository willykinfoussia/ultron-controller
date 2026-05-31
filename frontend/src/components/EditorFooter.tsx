import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type EditorFooterProps = {
  dirty: boolean;
  saving: boolean;
  lastSaved: Date | null;
  onSave: () => void;
  onDiscard: () => void;
  wordCount: number;
  lineCount: number;
};

export function EditorFooter({
  dirty,
  saving,
  lastSaved,
  onSave,
  onDiscard,
  wordCount,
  lineCount,
}: EditorFooterProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!lastSaved || !dirty) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [lastSaved, dirty]);

  const timeAgo = useCallback((d: Date | null) => {
    if (!d) return "never";
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }, [now]);

  return (
    <div className="editor-footer" role="status" aria-label="Editor status">
      {/* Left: dirty state + save info */}
      <div className="editor-footer-left">
        <AnimatePresence mode="wait">
          {dirty ? (
            <motion.span
              key="dirty"
              className="editor-footer-dirty"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <span className="editor-footer-dot editor-footer-dot--unsaved" aria-hidden="true" />
              Unsaved changes
            </motion.span>
          ) : saving ? (
            <motion.span
              key="saving"
              className="editor-footer-saving"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <span className="editor-footer-dot editor-footer-dot--saving" aria-hidden="true" />
              Saving…
            </motion.span>
          ) : (
            <motion.span
              key="saved"
              className="editor-footer-saved"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <span className="editor-footer-dot editor-footer-dot--saved" aria-hidden="true" />
              Saved {timeAgo(lastSaved)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Center: word/line count */}
      <div className="editor-footer-stats" aria-label="Document statistics">
        <span className="editor-footer-stat">{wordCount} words</span>
        <span className="editor-footer-stat-sep" aria-hidden="true">·</span>
        <span className="editor-footer-stat">{lineCount} lines</span>
      </div>

      {/* Right: actions */}
      <div className="editor-footer-actions">
        {dirty && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className="btn-ghost"
              onClick={onDiscard}
              aria-label="Discard changes"
            >
              Discard
            </button>
          </motion.div>
        )}
        <button
          className="primary"
          onClick={onSave}
          disabled={saving || !dirty}
          aria-label="Save (Ctrl+S)"
          title="Save (Ctrl+S)"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
