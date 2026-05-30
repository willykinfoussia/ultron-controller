export type MemoryFile = {
  name: string;
  size: number;
  mtime: number | null;
  kind: "memory" | "pinned";
  exists?: boolean;
};

export type SessionSummary = {
  id: string;
  title?: string | null;
  model?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  message_count?: number | null;
  tool_call_count?: number | null;
  estimated_cost_usd?: number | null;
};

export type SessionMessage = {
  id: number;
  role: string;
  content: string | null;
  content_text?: string | null;
  timestamp?: string | null;
  tool_name?: string | null;
  tool_calls?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
};

export type SearchResult = {
  id?: number;
  session_id?: string;
  role?: string;
  content?: string;
  timestamp?: string;
  title?: string;
  model?: string;
  uri?: string;
  score?: number;
};

export type SystemCpuMetric = {
  usage_percent: number;
};

export type SystemMemoryMetric = {
  total: number;
  used: number;
  free: number;
  percent: number;
};

export type SystemDiskMetric = {
  path: string;
  total: number;
  used: number;
  free: number;
  percent: number;
};

export type SystemProcess = {
  pid: number;
  name: string;
  username: string;
  status: string;
  cpu_percent: number;
  memory_percent: number;
};

export type StorageEntry = {
  path: string;
  size: number;
};

export type StorageScanMeta = {
  from_cache: boolean;
  partial: boolean;
  stop_reason: string;
  entries_visited: number;
  elapsed_ms: number;
  generated_at?: number;
};

export type StorageScanResponse = {
  status: "ok" | "partial";
  path: string;
  top_folders: StorageEntry[];
  top_files: StorageEntry[];
  entries_visited: number;
  permission_denied: number;
  partial: boolean;
  stop_reason: string;
  elapsed_ms: number;
  generated_at: number;
  from_cache: boolean;
};

export type StorageTopResponse = {
  status: "ok" | "partial";
  path: string;
  items: StorageEntry[];
  meta: StorageScanMeta;
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json()) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(data.detail || `Request failed (${response.status})`);
  }
  return data;
}

export async function healthCheck() {
  return request<{ status: string; openviking: unknown }>("/api/health");
}

export async function ovTree(uri: string, levelLimit = 2) {
  return request<{ result?: OvNode[]; status?: string }>(
    `/api/ov/tree?uri=${encodeURIComponent(uri)}&level_limit=${levelLimit}`
  );
}

export async function ovLs(uri: string, recursive = false) {
  return request<{ result?: OvNode[]; status?: string }>(
    `/api/ov/ls?uri=${encodeURIComponent(uri)}&recursive=${recursive}`
  );
}

export async function ovStat(uri: string) {
  return request<{ result?: Record<string, unknown>; status?: string }>(
    `/api/ov/stat?uri=${encodeURIComponent(uri)}`
  );
}

export async function ovRead(uri: string, raw = false) {
  return request<{ result?: unknown; status?: string }>(
    `/api/ov/read?uri=${encodeURIComponent(uri)}&raw=${raw}`
  );
}

export async function ovAbstract(uri: string) {
  return request<{ result?: string; status?: string }>(
    `/api/ov/abstract?uri=${encodeURIComponent(uri)}`
  );
}

export async function ovWrite(uri: string, content: string, mode = "replace") {
  return request("/api/ov/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri, content, mode })
  });
}

export async function ovDelete(uri: string, recursive = true) {
  return request(`/api/ov/delete?uri=${encodeURIComponent(uri)}&recursive=${recursive}`, {
    method: "DELETE"
  });
}

export async function ovMkdir(uri: string) {
  return request("/api/ov/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri })
  });
}

export async function ovSearch(query: string, targetUri = "", limit = 20) {
  return request<{ items: SearchResult[] }>("/api/search/openviking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, target_uri: targetUri, limit })
  });
}

export async function listMemoryFiles() {
  return request<{ files: MemoryFile[]; dir: string }>("/api/hermes/files");
}

export async function listPinnedFiles() {
  return request<{ files: MemoryFile[]; dir: string }>("/api/hermes/pinned");
}

export async function readMemoryFile(name: string) {
  return request<{ name: string; content: string }>(`/api/hermes/file/${encodeURIComponent(name)}`);
}

export async function writeMemoryFile(name: string, content: string) {
  return request(`/api/hermes/file/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, mode: "replace" })
  });
}

export async function deleteMemoryFile(name: string) {
  return request(`/api/hermes/file/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function readPinnedFile(name: string) {
  return request<{ name: string; content: string }>(`/api/hermes/pinned/${encodeURIComponent(name)}`);
}

export async function writePinnedFile(name: string, content: string) {
  return request(`/api/hermes/pinned/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, mode: "replace" })
  });
}

export async function listSessions(limit = 100) {
  const response = await request<{ sessions: Array<Record<string, unknown>> }>(
    `/api/sessions?limit=${limit}`
  );
  const sessions = response.sessions.map((raw) => ({
    id: String(raw.id),
    title: (raw.title as string | null) ?? null,
    model: (raw.model as string | null) ?? null,
    started_at: (raw.started_at as string | null) ?? null,
    ended_at: (raw.ended_at as string | null) ?? null,
    message_count: Number(raw.message_count ?? 0),
    tool_call_count: Number(raw.tool_call_count ?? 0),
    estimated_cost_usd: Number(raw.estimated_cost_usd ?? 0)
  }));
  return { sessions };
}

export async function sessionMessages(sessionId: string) {
  const response = await request<{ session_id: string; messages: SessionMessage[] }>(
    `/api/sessions/${encodeURIComponent(sessionId)}?limit=2000`
  );
  return response;
}

export async function sessionSearch(query: string, limit = 20) {
  return request<{ items: SearchResult[] }>("/api/search/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit })
  });
}

export async function systemCpu() {
  return request<SystemCpuMetric>("/api/system/cpu");
}

export async function systemMemory() {
  return request<SystemMemoryMetric>("/api/system/memory");
}

export async function systemDisk() {
  return request<SystemDiskMetric>("/api/system/disk");
}

export async function systemProcesses(limit = 20, sort: "cpu" | "memory" = "cpu") {
  return request<{ sort_by: string; count: number; items: SystemProcess[] }>(
    `/api/system/processes?limit=${limit}&sort=${sort}`
  );
}

export async function storageScan(path: string, depth = 4, limit = 10) {
  return request<StorageScanResponse>(
    `/api/storage/scan?path=${encodeURIComponent(path)}&depth=${depth}&limit=${limit}`
  );
}

export async function storageTopFolders(path: string, depth = 4, limit = 10) {
  return request<StorageTopResponse>(
    `/api/storage/top-folders?path=${encodeURIComponent(path)}&depth=${depth}&limit=${limit}`
  );
}

export async function storageTopFiles(path: string, depth = 4, limit = 10) {
  return request<StorageTopResponse>(
    `/api/storage/top-files?path=${encodeURIComponent(path)}&depth=${depth}&limit=${limit}`
  );
}

export type OvNode = {
  uri: string;
  isDir?: boolean;
  is_dir?: boolean;
  name?: string;
  abstract?: string;
  [key: string]: unknown;
};
