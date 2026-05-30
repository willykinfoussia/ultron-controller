import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
  storageTopFiles,
  storageTopFolders,
  systemCpu,
  systemDisk,
  systemMemory,
  systemProcesses,
  type StorageEntry,
  type StorageTopResponse,
  type SystemCpuMetric,
  type SystemDiskMetric,
  type SystemMemoryMetric,
  type SystemProcess,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

type SystemPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

type SortKey = "pid" | "name" | "cpu_percent" | "memory_percent";
type SortDir = "asc" | "desc";

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

function metricVariant(percent: number): "success" | "warning" | "danger" {
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "success";
}

export function SystemPage({ setToast }: SystemPageProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const [cpu, setCpu] = useState<SystemCpuMetric | null>(null);
  const [memory, setMemory] = useState<SystemMemoryMetric | null>(null);
  const [disk, setDisk] = useState<SystemDiskMetric | null>(null);
  const [processes, setProcesses] = useState<SystemProcess[]>([]);
  const [topFolders, setTopFolders] = useState<StorageTopResponse | null>(null);
  const [topFiles, setTopFiles] = useState<StorageTopResponse | null>(null);

  const [scanPathDraft, setScanPathDraft] = useState("/");
  const [scanPath, setScanPath] = useState("/");
  const [depth, setDepth] = useState(4);
  const [limit, setLimit] = useState(10);
  const [refreshSeconds, setRefreshSeconds] = useState(5);
  const [processServerSort, setProcessServerSort] = useState<"cpu" | "memory">("cpu");
  const [tableSortKey, setTableSortKey] = useState<SortKey>("cpu_percent");
  const [tableSortDir, setTableSortDir] = useState<SortDir>("desc");

  async function refreshData(showLoader: boolean) {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      const [cpuData, memoryData, diskData, processData, foldersData, filesData] = await Promise.all([
        systemCpu(),
        systemMemory(),
        systemDisk(),
        systemProcesses(20, processServerSort),
        storageTopFolders(scanPath, depth, limit),
        storageTopFiles(scanPath, depth, limit),
      ]);

      setCpu(cpuData);
      setMemory(memoryData);
      setDisk(diskData);
      setProcesses(processData.items);
      setTopFolders(foldersData);
      setTopFiles(filesData);
      setLastUpdated(Date.now());
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshData(true).catch((err: unknown) => setToast(String(err), "error"));

    const everyMs = Math.max(2, refreshSeconds) * 1000;
    const intervalId = setInterval(() => {
      refreshData(false).catch((err: unknown) => setToast(String(err), "error"));
    }, everyMs);
    return () => clearInterval(intervalId);
  }, [scanPath, depth, limit, refreshSeconds, processServerSort]);

  const sortedProcesses = useMemo(() => {
    const rows = [...processes];
    rows.sort((a, b) => {
      const left = a[tableSortKey];
      const right = b[tableSortKey];
      let cmp = 0;
      if (typeof left === "number" && typeof right === "number") cmp = left - right;
      else cmp = String(left).localeCompare(String(right));
      return tableSortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [processes, tableSortKey, tableSortDir]);

  const foldersMax = useMemo(
    () => Math.max(...(topFolders?.items.map((entry) => entry.size) ?? [1])),
    [topFolders]
  );

  function applyScanPath() {
    const next = scanPathDraft.trim();
    if (!next) {
      setToast("Scan path cannot be empty", "warning");
      return;
    }
    setScanPath(next);
  }

  function toggleTableSort(nextKey: SortKey) {
    if (tableSortKey === nextKey) {
      setTableSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
      return;
    }
    setTableSortKey(nextKey);
    setTableSortDir("desc");
  }

  function renderUsageCard(
    label: string,
    percent: number,
    details: string,
    icon: string
  ) {
    const variant = metricVariant(percent);
    return (
      <div className={`card metric-card metric-${variant}`}>
        <div className="card-header">
          <span className="card-title">
            <span className="metric-icon">{icon}</span> {label}
          </span>
          <span className={`badge ${variant}`}>{percent.toFixed(1)}%</span>
        </div>
        <div className="card-body">
          <div className="progress-track">
            <motion.div
              className={`progress-bar ${variant}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>
          <p className="metric-details">{details}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page system-page">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">System Resource Manager</div>
            <div className="card-subtitle">
              {lastUpdated
                ? `Last refresh: ${new Date(lastUpdated).toLocaleTimeString()}`
                : "Waiting first refresh..."}
            </div>
          </div>
          <div className="toolbar">
            <span className={`badge ${refreshing ? "warning" : "success"}`}>
              {refreshing ? "refreshing" : "live"}
            </span>
            <label className="inline-field">
              <span>Refresh (s)</span>
              <input
                value={refreshSeconds}
                type="number"
                min={2}
                max={30}
                onChange={(e) => setRefreshSeconds(Number(e.target.value || 5))}
              />
            </label>
            <button onClick={() => refreshData(false)}>Refresh now</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="loading-center">
            <Spinner size="lg" />
          </div>
        </div>
      ) : (
        <>
          <div className="system-cards-grid">
            {cpu
              ? renderUsageCard("CPU Usage", cpu.usage_percent, "Global processor load", "🧠")
              : null}
            {memory
              ? renderUsageCard(
                  "RAM Usage",
                  memory.percent,
                  `${formatBytes(memory.used)} used / ${formatBytes(memory.total)} total`,
                  "🧩"
                )
              : null}
            {disk
              ? renderUsageCard(
                  "Disk Usage",
                  disk.percent,
                  `${formatBytes(disk.used)} used / ${formatBytes(disk.total)} total (${disk.path})`,
                  "💾"
                )
              : null}
          </div>

          <div className="system-sections-grid">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Storage Analyzer</div>
                  <div className="card-subtitle">Top folders and files</div>
                </div>
                <div className="toolbar">
                  <label className="inline-field inline-field-wide">
                    <span>Path</span>
                    <input
                      value={scanPathDraft}
                      onChange={(e) => setScanPathDraft(e.target.value)}
                      placeholder="/home"
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
                      onChange={(e) => setLimit(Number(e.target.value || 10))}
                    />
                  </label>
                  <button onClick={applyScanPath}>Scan</button>
                </div>
              </div>
              <div className="card-body">
                <p className="section-label">Top folders</p>
                <div className="bars-list">
                  {(topFolders?.items ?? []).map((entry: StorageEntry) => {
                    const ratio = foldersMax > 0 ? (entry.size / foldersMax) * 100 : 0;
                    return (
                      <div key={entry.path} className="bar-row">
                        <div className="bar-row-meta">
                          <span className="truncate" title={entry.path}>{entry.path}</span>
                          <span className="mono">{formatBytes(entry.size)}</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-bar success" style={{ width: `${ratio}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {(topFolders?.items.length ?? 0) === 0 ? (
                    <div className="empty-state" style={{ padding: "16px 8px" }}>
                      <span className="empty-state-desc">No folder data yet</span>
                    </div>
                  ) : null}
                </div>

                <p className="section-label" style={{ marginTop: 14 }}>Top files</p>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Path</th>
                        <th>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(topFiles?.items ?? []).map((entry) => (
                        <tr key={entry.path}>
                          <td className="truncate" title={entry.path}>{entry.path}</td>
                          <td className="mono">{formatBytes(entry.size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="system-meta-row">
                  <span className={`badge ${(topFolders?.meta.partial || topFiles?.meta.partial) ? "warning" : "success"}`}>
                    {(topFolders?.meta.partial || topFiles?.meta.partial) ? "partial scan" : "complete"}
                  </span>
                  <span className="muted">
                    {topFolders?.meta.from_cache || topFiles?.meta.from_cache ? "cache hit" : "fresh scan"}
                  </span>
                  {topFolders?.meta.stop_reason ? (
                    <span className="text-warning mono">{topFolders.meta.stop_reason}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Processes</div>
                  <div className="card-subtitle">Top CPU/RAM consumers</div>
                </div>
                <div className="toolbar">
                  <div className="btn-group">
                    <button
                      className={processServerSort === "cpu" ? "active" : ""}
                      onClick={() => setProcessServerSort("cpu")}
                    >
                      CPU
                    </button>
                    <button
                      className={processServerSort === "memory" ? "active" : ""}
                      onClick={() => setProcessServerSort("memory")}
                    >
                      RAM
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body no-padding">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th onClick={() => toggleTableSort("pid")} className="sortable">PID</th>
                        <th onClick={() => toggleTableSort("name")} className="sortable">Process</th>
                        <th onClick={() => toggleTableSort("cpu_percent")} className="sortable">CPU %</th>
                        <th onClick={() => toggleTableSort("memory_percent")} className="sortable">RAM %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProcesses.map((process) => {
                        const cpuHot = process.cpu_percent >= 50;
                        const ramHot = process.memory_percent >= 20;
                        return (
                          <tr key={`${process.pid}-${process.name}`}>
                            <td className="mono">{process.pid}</td>
                            <td title={process.username ? `${process.name} (${process.username})` : process.name}>
                              <span className="truncate">{process.name}</span>
                            </td>
                            <td className={cpuHot ? "text-danger mono" : "mono"}>
                              {process.cpu_percent.toFixed(1)}
                            </td>
                            <td className={ramHot ? "text-warning mono" : "mono"}>
                              {process.memory_percent.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
