import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { storageAnalyze, type FileInsight, type StorageAnalysis } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TabBarWithBadges } from "../components/TabBarWithBadges";
import type { ToastKind } from "../components/Toast";

type StorageAnalyzerProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

type AnalyzerTab = "overview" | "largest" | "junk" | "old" | "duplicates";
type SortKey = "size" | "age" | "deletability";

const CATEGORY_COLORS: Record<string, string> = {
  video: "#ef4444",
  audio: "#f97316",
  image: "#eab308",
  archive: "#a855f7",
  installer: "#ec4899",
  document: "#3b82f6",
  code: "#06b6d4",
  database: "#14b8a6",
  cache_log: "#64748b",
  other: "#94a3b8",
};

const CATEGORY_LABELS: Record<string, string> = {
  video: "Video",
  audio: "Audio",
  image: "Image",
  archive: "Archive",
  installer: "Installer",
  document: "Document",
  code: "Code",
  database: "Database",
  cache_log: "Cache / Logs",
  other: "Other",
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

function defaultScanPath(): string {
  if (typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("win")) {
    return "~";
  }
  return "~";
}

async function copyPath(path: string, setToast: StorageAnalyzerProps["setToast"]) {
  try {
    await navigator.clipboard.writeText(path);
    setToast("Path copied to clipboard", "success");
  } catch {
    setToast("Failed to copy path", "error");
  }
}

function DeletabilityBadge({ deletability }: { deletability: FileInsight["deletability"] }) {
  return (
    <span
      className={`deletability-badge deletability-${deletability.level}`}
      title={deletability.reasons.join("\n")}
    >
      {deletability.level} ({deletability.score})
    </span>
  );
}

function CategoryDonut({ analysis }: { analysis: StorageAnalysis }) {
  const total = analysis.summary.total_size || 1;
  const segments = analysis.categories.slice(0, 8);
  let cursor = 0;
  const gradientParts = segments.map((entry) => {
    const pct = (entry.size / total) * 100;
    const color = CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other;
    const start = cursor;
    cursor += pct;
    return `${color} ${start}% ${cursor}%`;
  });

  return (
    <div className="storage-donut-wrap">
      <div
        className="storage-donut"
        style={{ background: `conic-gradient(${gradientParts.join(", ")})` }}
      >
        <div className="storage-donut-hole">
          <span className="storage-donut-label">{formatBytes(analysis.summary.total_size)}</span>
          <span className="storage-donut-sub">{analysis.summary.file_count} files</span>
        </div>
      </div>
      <div className="storage-legend">
        {segments.map((entry) => (
          <div key={entry.category} className="storage-legend-row">
            <span
              className="storage-legend-dot"
              style={{ background: CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other }}
            />
            <span className="storage-legend-name">
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </span>
            <span className="mono">{formatBytes(entry.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileTable({
  rows,
  setToast,
  showDeletability = true,
}: {
  rows: FileInsight[];
  setToast: StorageAnalyzerProps["setToast"];
  showDeletability?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "16px 8px" }}>
        <span className="empty-state-desc">No files match the current filters</span>
      </div>
    );
  }

  return (
    <div className="table-wrap storage-table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Size</th>
            <th>Age</th>
            <th>Category</th>
            {showDeletability ? <th>Deletable</th> : null}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path}>
              <td className="truncate" title={row.path}>
                {row.path}
              </td>
              <td className="mono">{formatBytes(row.size)}</td>
              <td className="mono">{row.age_days}d</td>
              <td>
                <span className="category-pill">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </span>
              </td>
              {showDeletability ? (
                <td>
                  <DeletabilityBadge deletability={row.deletability} />
                </td>
              ) : null}
              <td>
                <button className="btn-sm" onClick={() => copyPath(row.path, setToast)}>
                  Copy
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StorageAnalyzer({ setToast }: StorageAnalyzerProps) {
  const [scanPathDraft, setScanPathDraft] = useState(defaultScanPath);
  const [depth, setDepth] = useState(4);
  const [limit, setLimit] = useState(20);
  const [oldDays, setOldDays] = useState(180);
  const [minSizeMb, setMinSizeMb] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyzerTab>("overview");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("size");

  async function runAnalysis() {
    const path = scanPathDraft.trim();
    if (!path) {
      setToast("Scan path cannot be empty", "warning");
      return;
    }

    try {
      setLoading(true);
      const data = await storageAnalyze(path, depth, limit, oldDays, minSizeMb * 1024 * 1024);
      setAnalysis(data);
      setToast(
        data.from_cache ? "Analysis loaded from cache" : `Analysis complete in ${data.elapsed_ms}ms`,
        "success"
      );
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const filteredLargest = useMemo(() => {
    if (!analysis) return [];
    let rows = [...analysis.largest_files];
    if (categoryFilter !== "all") {
      rows = rows.filter((row) => row.category === categoryFilter);
    }
    rows.sort((a, b) => {
      if (sortKey === "size") return b.size - a.size;
      if (sortKey === "age") return b.age_days - a.age_days;
      return b.deletability.score - a.deletability.score;
    });
    return rows;
  }, [analysis, categoryFilter, sortKey]);

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      {
        id: "largest",
        label: "Largest",
        badge: analysis?.largest_files.length,
      },
      {
        id: "junk",
        label: "Junk & Cache",
        badge: analysis?.junk.length,
        badgeKind: "warning" as const,
      },
      {
        id: "old",
        label: "Old files",
        badge: analysis?.old_files.length,
      },
      {
        id: "duplicates",
        label: "Duplicates",
        badge: analysis?.duplicates.length,
        badgeKind: "danger" as const,
      },
    ],
    [analysis]
  );

  const foldersMax = useMemo(
    () => Math.max(...(analysis?.top_folders.map((entry) => entry.size) ?? [1])),
    [analysis]
  );

  return (
    <div className="card storage-analyzer">
      <div className="card-header">
        <div>
          <div className="card-title">Storage Analyzer</div>
          <div className="card-subtitle">
            Identify heavy files, junk, old data and duplicates — recommendations only
          </div>
        </div>
        <div className="toolbar storage-toolbar">
          <label className="inline-field inline-field-wide">
            <span>Path</span>
            <input
              value={scanPathDraft}
              onChange={(e) => setScanPathDraft(e.target.value)}
              placeholder="~"
            />
          </label>
          <label className="inline-field">
            <span>Depth</span>
            <input
              value={depth}
              type="number"
              min={1}
              max={16}
              onChange={(e) => setDepth(Number(e.target.value || 4))}
            />
          </label>
          <label className="inline-field">
            <span>Limit</span>
            <input
              value={limit}
              type="number"
              min={1}
              max={50}
              onChange={(e) => setLimit(Number(e.target.value || 20))}
            />
          </label>
          <label className="inline-field">
            <span>Old (d)</span>
            <input
              value={oldDays}
              type="number"
              min={30}
              max={3650}
              onChange={(e) => setOldDays(Number(e.target.value || 180))}
            />
          </label>
          <label className="inline-field">
            <span>Min MB</span>
            <input
              value={minSizeMb}
              type="number"
              min={0}
              max={1024}
              onChange={(e) => setMinSizeMb(Number(e.target.value || 1))}
            />
          </label>
          <button onClick={runAnalysis} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      <div className="card-body">
        {loading ? (
          <div className="loading-center">
            <Spinner size="lg" />
          </div>
        ) : !analysis ? (
          <div className="empty-state">
            <span className="empty-state-desc">
              Run an analysis to discover what is using disk space and what can be cleaned up
            </span>
          </div>
        ) : (
          <>
            <div className="storage-summary-grid">
              <div className="storage-insight-card">
                <span className="storage-insight-label">Total scanned</span>
                <span className="storage-insight-value">{formatBytes(analysis.summary.total_size)}</span>
                <span className="storage-insight-meta">{analysis.summary.file_count} files</span>
              </div>
              <div className="storage-insight-card storage-insight-recoverable">
                <span className="storage-insight-label">Recoverable estimate</span>
                <span className="storage-insight-value">
                  {formatBytes(analysis.summary.recoverable_estimate)}
                </span>
                <span className="storage-insight-meta">
                  junk {formatBytes(analysis.summary.junk_size)} + dup{" "}
                  {formatBytes(analysis.summary.duplicate_wasted)}
                </span>
              </div>
              <div className="storage-insight-card">
                <span className="storage-insight-label">Top category</span>
                <span className="storage-insight-value">
                  {CATEGORY_LABELS[analysis.summary.top_category] ?? analysis.summary.top_category}
                </span>
                <span className="storage-insight-meta">
                  {analysis.entries_visited.toLocaleString()} entries visited
                </span>
              </div>
            </div>

            <TabBarWithBadges
              tabs={tabs}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as AnalyzerTab)}
            />

            {activeTab === "overview" ? (
              <div className="storage-tab-panel">
                <CategoryDonut analysis={analysis} />
                <p className="section-label">Top folders</p>
                <div className="bars-list">
                  {analysis.top_folders.map((entry) => {
                    const ratio = foldersMax > 0 ? (entry.size / foldersMax) * 100 : 0;
                    return (
                      <div key={entry.path} className="bar-row">
                        <div className="bar-row-meta">
                          <span className="truncate" title={entry.path}>
                            {entry.path}
                          </span>
                          <span className="mono">{formatBytes(entry.size)}</span>
                        </div>
                        <div className="progress-track">
                          <motion.div
                            className="progress-bar success"
                            initial={{ width: 0 }}
                            animate={{ width: `${ratio}%` }}
                            transition={{ duration: 0.35 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeTab === "largest" ? (
              <div className="storage-tab-panel">
                <div className="storage-filters">
                  <label className="inline-field">
                    <span>Category</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      {analysis.categories.map((entry) => (
                        <option key={entry.category} value={entry.category}>
                          {CATEGORY_LABELS[entry.category] ?? entry.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="btn-group">
                    <button
                      className={sortKey === "size" ? "active" : ""}
                      onClick={() => setSortKey("size")}
                    >
                      Size
                    </button>
                    <button
                      className={sortKey === "age" ? "active" : ""}
                      onClick={() => setSortKey("age")}
                    >
                      Age
                    </button>
                    <button
                      className={sortKey === "deletability" ? "active" : ""}
                      onClick={() => setSortKey("deletability")}
                    >
                      Deletable
                    </button>
                  </div>
                </div>
                <FileTable rows={filteredLargest} setToast={setToast} />
              </div>
            ) : null}

            {activeTab === "junk" ? (
              <div className="storage-tab-panel">
                {analysis.junk.length === 0 ? (
                  <div className="empty-state" style={{ padding: "16px 8px" }}>
                    <span className="empty-state-desc">No junk or cache detected in this scan</span>
                  </div>
                ) : (
                  analysis.junk.map((entry) => (
                    <div key={entry.kind} className="junk-group">
                      <div className="junk-group-header">
                        <span className="junk-kind">{entry.kind}</span>
                        <span className="mono">{formatBytes(entry.size)}</span>
                        <span className="badge warning">{entry.count} files</span>
                      </div>
                      <ul className="junk-samples">
                        {entry.sample_paths.map((path) => (
                          <li key={path} className="junk-sample-row">
                            <span className="truncate" title={path}>
                              {path}
                            </span>
                            <button className="btn-sm" onClick={() => copyPath(path, setToast)}>
                              Copy
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {activeTab === "old" ? (
              <div className="storage-tab-panel">
                <p className="section-label muted">
                  Files larger than {minSizeMb} MB not modified for {oldDays}+ days
                </p>
                <FileTable rows={analysis.old_files} setToast={setToast} />
              </div>
            ) : null}

            {activeTab === "duplicates" ? (
              <div className="storage-tab-panel">
                {analysis.duplicates.length === 0 ? (
                  <div className="empty-state" style={{ padding: "16px 8px" }}>
                    <span className="empty-state-desc">No duplicate groups found</span>
                  </div>
                ) : (
                  analysis.duplicates.map((group, index) => (
                    <div key={`${group.size}-${index}`} className="duplicate-group">
                      <div className="duplicate-group-header">
                        <span className="mono">{formatBytes(group.size)} each</span>
                        <span className="badge danger">{group.count} copies</span>
                        <span className="text-warning mono">wasted {formatBytes(group.wasted)}</span>
                      </div>
                      <ul className="duplicate-paths">
                        {group.paths.map((path) => (
                          <li key={path} className="duplicate-path-row">
                            <span className="truncate" title={path}>
                              {path}
                            </span>
                            <button className="btn-sm" onClick={() => copyPath(path, setToast)}>
                              Copy
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <div className="system-meta-row">
              <span className={`badge ${analysis.partial ? "warning" : "success"}`}>
                {analysis.partial ? "partial scan" : "complete"}
              </span>
              <span className={`badge ${analysis.from_cache ? "warning" : "success"}`}>
                {analysis.from_cache ? "cache hit" : "fresh scan"}
              </span>
              <span className="muted">{analysis.elapsed_ms}ms</span>
              {analysis.stop_reason ? (
                <span className="text-warning mono">{analysis.stop_reason}</span>
              ) : null}
              <span className="muted">
                {analysis.analysis_meta.hashes_computed} hashes,{" "}
                {analysis.analysis_meta.duplicate_groups_found} dup groups
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
