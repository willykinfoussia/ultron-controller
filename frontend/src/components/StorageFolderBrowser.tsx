import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { BrowseEntry, StorageBrowseIndex } from "../api/client";
import { BreadcrumbPath } from "./BreadcrumbPath";
import type { ToastKind } from "./Toast";

type StorageFolderBrowserProps = {
  browse: StorageBrowseIndex;
  limit: number;
  partial: boolean;
  setToast: (message: string, kind?: ToastKind) => void;
};

function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let amount = Math.max(0, value);
  let idx = 0;
  while (amount >= 1024 && idx < units.length - 1) {
    amount /= 1024;
    idx += 1;
  }
  return `${amount.toFixed(2)} ${units[idx]}`;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const unified = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (unified.length > 1 && unified.endsWith("/")) {
    return unified.slice(0, -1);
  }
  return unified || "/";
}

function buildPathChain(root: string, current: string): string[] {
  const rootNorm = normalizePath(root);
  const currentNorm = normalizePath(current);

  if (currentNorm === rootNorm) {
    return [rootNorm];
  }

  if (rootNorm === "/" && currentNorm.startsWith("/")) {
    const parts = currentNorm.slice(1).split("/").filter(Boolean);
    const chain = ["/"];
    let acc = "";
    for (const part of parts) {
      acc += `/${part}`;
      chain.push(acc);
    }
    return chain;
  }

  if (currentNorm.startsWith(`${rootNorm}/`) || currentNorm === rootNorm) {
    const suffix = currentNorm.slice(rootNorm.length).replace(/^\//, "");
    const parts = suffix.split("/").filter(Boolean);
    const chain = [rootNorm];
    let acc = rootNorm;
    for (const part of parts) {
      acc = `${acc}/${part}`;
      chain.push(acc);
    }
    return chain;
  }

  return [currentNorm];
}

function segmentLabel(path: string, isRoot: boolean): string {
  if (isRoot && path === "/") return "/";
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

async function copyPath(path: string, setToast: StorageFolderBrowserProps["setToast"]) {
  try {
    await navigator.clipboard.writeText(path);
    setToast("Path copied to clipboard", "success");
  } catch {
    setToast("Failed to copy path", "error");
  }
}

export function StorageFolderBrowser({
  browse,
  limit,
  partial,
  setToast,
}: StorageFolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState(browse.root);

  useEffect(() => {
    setCurrentPath(browse.root);
  }, [browse.root, browse.entries_by_parent]);

  const allEntries = useMemo(() => {
    const currentNorm = normalizePath(currentPath);
    const key = Object.keys(browse.entries_by_parent).find(
      (candidate) => normalizePath(candidate) === currentNorm
    );
    if (key) return browse.entries_by_parent[key] ?? [];
    return browse.entries_by_parent[currentPath] ?? [];
  }, [browse.entries_by_parent, currentPath]);

  const visibleEntries = allEntries.slice(0, limit);
  const hiddenCount = Math.max(0, allEntries.length - visibleEntries.length);
  const maxSize = Math.max(...visibleEntries.map((entry) => entry.size), 1);

  const breadcrumbSegments = useMemo(() => {
    const chain = buildPathChain(browse.root, currentPath);
    return chain.map((path, index) => {
      const isLast = index === chain.length - 1;
      const isRoot = index === 0;
      return {
        label: segmentLabel(path, isRoot),
        icon: isRoot ? "📁" : undefined,
        onClick: isLast ? undefined : () => setCurrentPath(path),
      };
    });
  }, [browse.root, currentPath]);

  function handleEntryClick(entry: BrowseEntry) {
    if (entry.kind === "dir") {
      setCurrentPath(entry.path);
    }
  }

  return (
    <div className="storage-browse">
      <div className="storage-browse-header">
        <p className="section-label">Folders</p>
        {partial ? (
          <span className="badge warning storage-browse-hint">Navigation within scanned data only</span>
        ) : null}
      </div>

      <BreadcrumbPath segments={breadcrumbSegments} maxVisible={6} />

      {visibleEntries.length === 0 ? (
        <div className="empty-state" style={{ padding: "16px 8px" }}>
          <span className="empty-state-desc">
            {partial
              ? "Empty folder, or content not explored (depth limit / timeout / permissions)"
              : "No content scanned in this folder"}
          </span>
        </div>
      ) : (
        <div className="storage-browse-list">
          {visibleEntries.map((entry) => {
            const ratio = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;
            const isDir = entry.kind === "dir";
            return (
              <div
                key={entry.path}
                className={`storage-browse-row ${isDir ? "is-dir" : "is-file"}`}
                role={isDir ? "button" : undefined}
                tabIndex={isDir ? 0 : undefined}
                onClick={isDir ? () => handleEntryClick(entry) : undefined}
                onKeyDown={
                  isDir
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleEntryClick(entry);
                        }
                      }
                    : undefined
                }
              >
                <div className="storage-browse-row-main">
                  <span className="storage-browse-icon" aria-hidden="true">
                    {isDir ? "📁" : "📄"}
                  </span>
                  <span className="storage-browse-name truncate" title={entry.path}>
                    {entry.name}
                  </span>
                  <span className="mono storage-browse-size">{formatBytes(entry.size)}</span>
                  {isDir ? <span className="storage-browse-chevron" aria-hidden="true">›</span> : null}
                  {!isDir ? (
                    <button
                      className="btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyPath(entry.path, setToast).catch(() => undefined);
                      }}
                    >
                      Copy
                    </button>
                  ) : null}
                </div>
                <div className="progress-track">
                  <motion.div
                    className={`progress-bar ${isDir ? "success" : "warning"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${ratio}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 ? (
        <p className="muted storage-browse-truncated">{hiddenCount} more not shown (increase Limit)</p>
      ) : null}
    </div>
  );
}
