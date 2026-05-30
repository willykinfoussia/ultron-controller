import { motion } from "framer-motion";
import type { OvNode } from "../api/client";

type FileTreeProps = {
  nodes: OvNode[];
  selectedUri: string | null;
  onSelect: (uri: string) => void;
};

function displayName(uri: string) {
  const parts = uri.split("/").filter(Boolean);
  return parts[parts.length - 1] || uri;
}

function parentPath(uri: string) {
  const trimmed = uri.endsWith("/") ? uri.slice(0, -1) : uri;
  const idx = trimmed.lastIndexOf("/");
  return idx < 0 ? "" : trimmed.slice(0, idx + 1);
}

export function FileTree({ nodes, selectedUri, onSelect }: FileTreeProps) {
  if (!nodes.length) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">📂</span>
        <span className="empty-state-desc">No files found</span>
      </div>
    );
  }

  return (
    <div className="list" role="navigation" aria-label="File tree">
      {nodes.map((node, i) => {
        const uri = String(node.uri);
        const isDir = Boolean(node.isDir ?? node.is_dir);
        const name = displayName(uri);
        const parent = parentPath(uri);
        const isActive = selectedUri === uri;

        return (
          <motion.button
            key={uri}
            aria-current={isActive ? "true" : undefined}
            aria-label={`${isDir ? "Directory" : "File"}: ${name}`}
            className={`list-item ${isActive ? "active" : ""}`}
            onClick={() => onSelect(uri)}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.025, duration: 0.18, ease: "easeOut" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="file-icon" aria-hidden="true">
                {isDir ? "📁" : "📄"}
              </span>
              <span className="list-item-name">{name}</span>
            </div>
            {parent ? (
              <span className="list-item-meta truncate">{parent}</span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
