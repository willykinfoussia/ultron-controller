import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import type { OvNode } from "../api/client";

/* ── Types ──────────────────────────────────────────────── */

type TreeEntry = OvNode & {
  _depth: number;
  _children: TreeEntry[];
  _path: string[];
};

type FileTreeProps = {
  nodes: OvNode[];
  selectedUri: string | null;
  onSelect: (uri: string) => void;
};

/* ── Helpers ────────────────────────────────────────────── */

function pathParts(uri: string): string[] {
  // Strip "viking://" prefix, then split
  const stripped = uri.startsWith("viking://") ? uri.slice(9) : uri;
  return stripped.split("/").filter(Boolean);
}

function displayName(uri: string): string {
  const parts = pathParts(uri);
  return parts[parts.length - 1] || uri;
}

/**
 * Converts the flat list (depth-first from the API) into a proper
 * nested tree.  The API already guarantees parents appear before
 * their children and the list is sorted by depth.
 */
function buildTree(nodes: OvNode[]): TreeEntry[] {
  const roots: TreeEntry[] = [];
  // Stack holds [depth, entry] pairs; last element is the current parent candidate
  const stack: TreeEntry[] = [];

  for (const node of nodes) {
    const uri = String(node.uri);
    const isDir = Boolean(node.isDir ?? node.is_dir);
    const parts = pathParts(uri);
    const depth = parts.length;

    const entry: TreeEntry = {
      ...node,
      uri,
      _depth: depth,
      _children: [],
      _path: parts,
    };

    // Pop stack until we find our parent (the last entry with depth < ours and matching prefix)
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top._depth < depth && uri.startsWith(top.uri.endsWith("/") ? top.uri : top.uri + "/")) {
        break;
      }
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(entry);
    } else {
      stack[stack.length - 1]._children.push(entry);
    }

    if (isDir) {
      stack.push(entry);
    }
  }

  return roots;
}

/* ── Collapse state hook ────────────────────────────────── */

function useCollapsedState(roots: TreeEntry[]) {
  // Default: collapse everything beyond depth 2
  const defaultCollapsed = useMemo(() => {
    const set = new Set<string>();
    function walk(entries: TreeEntry[]) {
      for (const e of entries) {
        if (e._depth >= 2 && e._children.length > 0) {
          set.add(e.uri);
        }
        walk(e._children);
      }
    }
    walk(roots);
    return set;
  }, [roots]);

  const [collapsed, setCollapsed] = useState<Set<string>>(defaultCollapsed);

  const toggle = useCallback((uri: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

/* ── ChevronIcon ────────────────────────────────────────── */

function ChevronIcon({ open, onClick, disabled }: { open: boolean; onClick: (e: React.MouseEvent) => void; disabled: boolean }) {
  if (disabled) {
    return (
      <span
        className="tree-chevron tree-chevron-empty"
        aria-hidden="true"
        style={{
          opacity: 0.12,
          display: "inline-block",
          width: 14,
          height: 14,
          fontSize: 10,
          color: "var(--text-2)",
          flexShrink: 0,
          lineHeight: "14px",
          textAlign: "center",
        }}
      >
        ▶
      </span>
    );
  }
  return (
    <button
      className="tree-chevron"
      onClick={onClick}
      tabIndex={-1}
      aria-label={open ? "Collapse" : "Expand"}
      style={{
        opacity: 0.55,
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: 2,
        margin: 0,
        lineHeight: 1,
        fontSize: 10,
        color: "var(--text-2)",
        transition: "transform 0.15s ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        display: "inline-block",
        width: 14,
        height: 14,
        flexShrink: 0,
      }}
    >
      ▶
    </button>
  );
}

/* ── TreeRow ────────────────────────────────────────────── */

function TreeRow({
  entry,
  selectedUri,
  onSelect,
  collapsed,
  toggle,
}: {
  entry: TreeEntry;
  selectedUri: string | null;
  onSelect: (uri: string) => void;
  collapsed: Set<string>;
  toggle: (uri: string) => void;
}) {
  const isDir = Boolean(entry.isDir ?? entry.is_dir);
  const isOpen = !collapsed.has(entry.uri);
  const isActive = selectedUri === entry.uri;
  const name = displayName(entry.uri);
  const hasChildren = entry._children.length > 0;
  const depth = entry._depth - 1; // root is depth 0 visually

  return (
    <>
      <motion.button
        aria-current={isActive ? "true" : undefined}
        aria-label={`${isDir ? "Directory" : "File"}: ${name}`}
        className={`list-item tree-row ${isActive ? "active" : ""} ${isDir ? "tree-dir" : "tree-file"}`}
        onClick={() => onSelect(entry.uri)}
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          paddingRight: 10,
          paddingTop: 5,
          paddingBottom: 5,
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronIcon
            open={isOpen}
            disabled={!hasChildren}
            onClick={(e) => {
              e.stopPropagation();
              toggle(entry.uri);
            }}
          />
          <span className="file-icon" aria-hidden="true" style={{ flexShrink: 0 }}>
            {isDir ? (isOpen ? "📂" : "📁") : "📄"}
          </span>
          <span className="list-item-name" style={{ fontSize: isDir ? "var(--text-md)" : "var(--text-sm)", fontWeight: isDir ? 600 : 400 }}>
            {name}
          </span>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {isDir && isOpen && hasChildren && (
          <motion.div
            key={entry.uri + "-children"}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            {entry._children.map((child) => (
              <TreeRow
                key={child.uri}
                entry={child}
                selectedUri={selectedUri}
                onSelect={onSelect}
                collapsed={collapsed}
                toggle={toggle}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── FileTree ───────────────────────────────────────────── */

export function FileTree({ nodes, selectedUri, onSelect }: FileTreeProps) {
  const prefersReduced = useReducedMotion();
  const roots = useMemo(() => buildTree(nodes), [nodes]);
  const { collapsed, toggle } = useCollapsedState(roots);

  const handleSelect = useCallback(
    (uri: string) => {
      onSelect(uri);
    },
    [onSelect]
  );

  if (!nodes.length) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">📂</span>
        <span className="empty-state-desc">No files found</span>
      </div>
    );
  }

  return (
    <div className="list tree" role="navigation" aria-label="File tree">
      {roots.map((entry) => (
        <TreeRow
          key={entry.uri}
          entry={entry}
          selectedUri={selectedUri}
          onSelect={handleSelect}
          collapsed={collapsed}
          toggle={toggle}
        />
      ))}
    </div>
  );
}
