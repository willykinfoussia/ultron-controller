import type { ReactNode } from "react";
import { MarkdownPreview } from "./MarkdownPreview";

type ContentEditorProps = {
  title: string;
  breadcrumbs?: string[];
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  disableDelete?: boolean;
  extraActions?: ReactNode;
  saving?: boolean;
  dirty?: boolean;
  preview?: boolean;
  onPreviewChange?: (preview: boolean) => void;
  charCount?: number;
  lineCount?: number;
};

export function ContentEditor({
  title,
  breadcrumbs,
  value,
  onChange,
  onSave,
  onDelete,
  disableDelete = false,
  extraActions,
  saving = false,
  dirty = false,
  preview = false,
  onPreviewChange,
  charCount = 0,
  lineCount = 0,
}: ContentEditorProps) {
  // Save status indicator
  const saveStatus = saving
    ? { label: "Saving…", className: "editor-status--saving" }
    : dirty
      ? { label: "Unsaved changes", className: "editor-status--dirty" }
      : { label: "Saved", className: "editor-status--saved" };

  const isPreview = preview && onPreviewChange;

  return (
    <div className="card">
      {/* ── Header ── */}
      <div className="card-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="card-title">{title}</div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="editor-breadcrumbs">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="editor-crumb">
                  {i > 0 && <span className="editor-crumb-sep">/</span>}
                  {crumb}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="toolbar">
          {extraActions}
          {onPreviewChange && (
            <div className="preview-toggle">
              <button
                className={`preview-toggle-btn ${!preview ? "active" : ""}`}
                onClick={() => onPreviewChange(false)}
                aria-label="Edit mode"
              >
                Edit
              </button>
              <button
                className={`preview-toggle-btn ${preview ? "active" : ""}`}
                onClick={() => onPreviewChange(true)}
                aria-label="Preview mode"
              >
                Preview
              </button>
            </div>
          )}
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

      {/* ── Unsaved changes banner ── */}
      {dirty && !saving && (
        <div className="unsaved-banner">
          <span className="unsaved-banner-icon">●</span>
          <span>Unsaved changes</span>
          <button className="unsaved-banner-save" onClick={onSave}>Save now</button>
        </div>
      )}

      {/* ── Body: editor or preview ── */}
      <div className="card-body no-padding">
        {isPreview ? (
          <div className="editor-preview-wrap">
            <MarkdownPreview content={value} />
          </div>
        ) : (
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
        )}
      </div>

      {/* ── Footer: file stats + save status ── */}
      <div className="editor-footer">
        <div className="editor-footer-left">
          <span className="editor-stat">{charCount} chars</span>
          <span className="editor-stat">{lineCount} lines</span>
          <span className="editor-stat">UTF-8</span>
        </div>
        <div className="editor-footer-right">
          <span className={`editor-status ${saveStatus.className}`}>
            <span className="editor-status-dot" />
            {saveStatus.label}
          </span>
        </div>
      </div>
    </div>
  );
}
