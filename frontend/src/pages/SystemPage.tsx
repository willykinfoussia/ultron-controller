import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
  systemCpu,
  systemDisk,
  systemMemory,
  systemProcesses,
  type SystemCpuMetric,
  type SystemDiskMetric,
  type SystemMemoryMetric,
  type SystemProcess,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import { StorageAnalyzer } from "../components/StorageAnalyzer";
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

  const [refreshSeconds, setRefreshSeconds] = useState(5);
  const [processServerSort, setProcessServerSort] = useState<"cpu" | "memory">("cpu");
  const [tableSortKey, setTableSortKey] = useState<SortKey>("cpu_percent");
  const [tableSortDir, setTableSortDir] = useState<SortDir>("desc");

  async function refreshData(showLoader: boolean) {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      const [cpuData, memoryData, diskData, processData] = await Promise.all([
        systemCpu(),
        systemMemory(),
        systemDisk(),
        systemProcesses(20, processServerSort),
      ]);

      setCpu(cpuData);
      setMemory(memoryData);
      setDisk(diskData);
      setProcesses(processData.items);
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
  }, [refreshSeconds, processServerSort]);

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
            <StorageAnalyzer setToast={setToast} />

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
