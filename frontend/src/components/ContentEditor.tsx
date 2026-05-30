import type { ReactNode } from "react";

type ContentEditorProps = {
  title: string;
  subtitle?: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  disableDelete?: boolean;
  extraActions?: ReactNode;
  saving?: boolean;
};

export function ContentEditor({
  title,
  subtitle,
  value,
  onChange,
  onSave,
  onDelete,
  disableDelete,
  extraActions,
  saving = false,
}: ContentEditorProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="card-title">{title}</div>
          {subtitle ? (
            <div className="card-subtitle" title={subtitle}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="toolbar">
          {extraActions}
          {onDelete ? (
            <button
              className="danger"
              onClick={onDelete}
              disabled={disableDelete}
              aria-label="Delete"
              title="Delete"
            >
              Delete
            </button>
          ) : null}
          <button
            className="primary"
            onClick={onSave}
            disabled={saving}
            aria-label="Save (Ctrl+S)"
            title="Save (Ctrl+S)"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="card-body no-padding">
        <textarea
          className="editor"
          style={{ border: "none", borderRadius: 0, outline: "none" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              onSave();
            }
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
