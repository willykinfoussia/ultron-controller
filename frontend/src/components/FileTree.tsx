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

export function FileTree({ nodes, selectedUri, onSelect }: FileTreeProps) {
  return (
    <div className="list">
      {nodes.map((node) => {
        const uri = String(node.uri);
        const isDir = Boolean(node.isDir ?? node.is_dir);
        return (
          <div
            key={uri}
            className={`list-item ${selectedUri === uri ? "active" : ""}`}
            onClick={() => onSelect(uri)}
          >
            <div>{displayName(uri)}</div>
            <div className="muted">{isDir ? "Directory" : "File"}</div>
            <div className="muted">{uri}</div>
          </div>
        );
      })}
    </div>
  );
}
