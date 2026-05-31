import { motion } from "framer-motion";

type MarkdownPreviewToggleProps = {
  mode: "edit" | "preview" | "split";
  onChange: (mode: "edit" | "preview" | "split") => void;
};

const MODES: Array<{ id: "edit" | "preview" | "split"; label: string; icon: string; title: string }> = [
  { id: "edit", label: "Edit", icon: "✏️", title: "Editor only (Ctrl+E)" },
  { id: "split", label: "Split", icon: "⬜", title: "Side-by-side (Ctrl+D)" },
  { id: "preview", label: "Preview", icon: "👁", title: "Preview only (Ctrl+P)" },
];

export function MarkdownPreviewToggle({ mode, onChange }: MarkdownPreviewToggleProps) {
  return (
    <div
      className="md-toggle"
      role="radiogroup"
      aria-label="Editor mode"
    >
      {MODES.map((m) => {
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            role="radio"
            aria-checked={isActive}
            className={`md-toggle-btn ${isActive ? "active" : ""}`}
            onClick={() => onChange(m.id)}
            title={m.title}
          >
            <span className="md-toggle-icon" aria-hidden="true">{m.icon}</span>
            <span className="md-toggle-label">{m.label}</span>
            {isActive && (
              <motion.span
                className="md-toggle-indicator"
                layoutId="md-toggle-indicator"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
