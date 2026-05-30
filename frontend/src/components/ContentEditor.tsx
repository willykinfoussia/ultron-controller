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
};

export function ContentEditor({
  title,
  subtitle,
  value,
  onChange,
  onSave,
  onDelete,
  disableDelete,
  extraActions
}: ContentEditorProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div>{title}</div>
          {subtitle ? <div className="muted">{subtitle}</div> : null}
        </div>
        <div className="toolbar">
          {extraActions}
          {onDelete ? (
            <button className="danger" onClick={onDelete} disabled={disableDelete}>
              Delete
            </button>
          ) : null}
          <button className="primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
      <div className="card-content">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              onSave();
            }
          }}
        />
      </div>
    </div>
  );
}
