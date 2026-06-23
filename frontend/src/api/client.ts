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

export type Deletability = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
};

export type FileInsight = {
  path: string;
  size: number;
  mtime: number;
  atime: number;
  age_days: number;
  category: string;
  junk_kind: string | null;
  deletability: Deletability;
};

export type CategoryInsight = {
  category: string;
  size: number;
  count: number;
};

export type JunkEntry = {
  kind: string;
  size: number;
  count: number;
  sample_paths: string[];
};

export type DuplicateGroup = {
  size: number;
  count: number;
  wasted: number;
  paths: string[];
};

export type StorageAnalysisSummary = {
  total_size: number;
  file_count: number;
  recoverable_estimate: number;
  junk_size: number;
  duplicate_wasted: number;
  top_category: string;
};

export type StorageAnalysis = {
  status: "ok" | "partial";
  path: string;
  summary: StorageAnalysisSummary;
  categories: CategoryInsight[];
  largest_files: FileInsight[];
  junk: JunkEntry[];
  old_files: FileInsight[];
  duplicates: DuplicateGroup[];
  top_folders: StorageEntry[];
  top_files: StorageEntry[];
  entries_visited: number;
  permission_denied: number;
  partial: boolean;
  stop_reason: string;
  elapsed_ms: number;
  generated_at: number;
  from_cache: boolean;
  analysis_meta: {
    old_days: number;
    min_file_size: number;
    hashes_computed: number;
    duplicate_groups_found: number;
  };
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  let data: unknown = null;
  if (raw) {
    const looksJson = contentType.includes("application/json") || /^[\s]*[\[{]/.test(raw);
    if (looksJson) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    } else {
      data = raw;
    }
  }
  if (!response.ok) {
    const payload = (data && typeof data === "object") ? (data as { detail?: string; message?: string }) : null;
    const detail = payload?.detail ?? payload?.message;
    if (detail) throw new Error(detail);
    if (typeof data === "string" && data.trim()) {
      // Avoid surfacing full HTML error pages from reverse proxies.
      const msg = data.trim().startsWith("<!DOCTYPE") ? `Request failed (${response.status})` : data.trim();
      throw new Error(msg);
    }
    throw new Error(`Request failed (${response.status})`);
  }
  if (data === null || data === "") return {} as T;
  return data as T;
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

/* ── Agent Profiles API ─────────────────────────────────── */

export type AgentProfile = {
  name: string;
  has_soul: boolean;
  memories_count: number;
  role: string | null;
};

export type AgentMemoryFile = {
  name: string;
  size: number;
  mtime: number;
  kind: "memory";
  exists?: boolean;
};

export async function listAgentProfiles() {
  return request<{ profiles: AgentProfile[] }>("/api/hermes/profiles");
}

export async function readAgentSoul(name: string) {
  return request<{ name: string; content: string; path: string; exists: boolean }>(
    `/api/hermes/profiles/${encodeURIComponent(name)}/soul`
  );
}

export async function writeAgentSoul(name: string, content: string) {
  return request(`/api/hermes/profiles/${encodeURIComponent(name)}/soul`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, mode: "replace" }),
  });
}

export async function listAgentMemories(name: string) {
  return request<{ dir: string; files: AgentMemoryFile[] }>(
    `/api/hermes/profiles/${encodeURIComponent(name)}/memories`
  );
}

export async function readAgentMemory(name: string, filename: string) {
  return request<{ name: string; content: string; path: string }>(
    `/api/hermes/profiles/${encodeURIComponent(name)}/memories/${encodeURIComponent(filename)}`
  );
}

export async function writeAgentMemory(name: string, filename: string, content: string) {
  return request(
    `/api/hermes/profiles/${encodeURIComponent(name)}/memories/${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, mode: "replace" }),
    }
  );
}

export async function deleteAgentMemory(name: string, filename: string) {
  return request(
    `/api/hermes/profiles/${encodeURIComponent(name)}/memories/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
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

export async function storageAnalyze(
  path: string,
  depth = 4,
  limit = 20,
  oldDays = 180,
  minSize = 1024 * 1024
) {
  return request<StorageAnalysis>(
    `/api/storage/analyze?path=${encodeURIComponent(path)}&depth=${depth}&limit=${limit}&old_days=${oldDays}&min_size=${minSize}`
  );
}

export type OvNode = {
  uri: string;
  isDir?: boolean;
  is_dir?: boolean;
  name?: string;
  abstract?: string;
  rel_path?: string;
  children?: OvNode[];
  [key: string]: unknown;
};

/* ═══════════════════════════════════════════════════════════
   HERMES API SERVER — types + helpers + functions
   All calls go through /api/hermes_api (Ultron proxy)
   The bearer secret never reaches the browser.
   ═══════════════════════════════════════════════════════════ */

/* ── Types ──────────────────────────────────────────────── */

export type HermesMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export type HermesChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | HermesMessageContentPart[];
};

export type HermesRunStatus = {
  object: string;
  run_id: string;
  status: "started" | "running" | "completed" | "failed" | "cancelled" | "stopping";
  session_id?: string | null;
  model?: string | null;
  output?: string | null;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number } | null;
};

export type HermesJob = {
  id: string;
  prompt: string;
  schedule?: string | null;
  status?: string | null;
  last_run?: string | null;
  next_run?: string | null;
  [key: string]: unknown;
};

export type HermesAgentSession = {
  id: string;
  title?: string | null;
  source?: string | null;
  model?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  end_reason?: string | null;
  message_count?: number | null;
  [key: string]: unknown;
};

export type HermesCapabilities = {
  object: string;
  platform: string;
  model: string;
  auth: { type: string; required: boolean };
  features: Record<string, boolean>;
  [key: string]: unknown;
};

export type HermesSkill = {
  name: string;
  description?: string | null;
  category?: string | null;
  [key: string]: unknown;
};

export type HermesToolset = {
  name: string;
  label?: string | null;
  description?: string | null;
  enabled: boolean;
  configured: boolean;
  tools: string[];
  [key: string]: unknown;
};

export type SseEvent = { event: string; data: string };

/* ── SSE stream helpers ──────────────────────────────────── */

/**
 * Parses a ReadableStream of bytes into SSE events.
 * Works for both GET and POST SSE streams (unlike EventSource which is GET-only).
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const ev: SseEvent = { event: "message", data: "" };
        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) ev.event = line.slice(7).trim();
          else if (line.startsWith("data: "))
            ev.data = ev.data ? ev.data + "\n" + line.slice(6) : line.slice(6);
        }
        if (ev.data) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function _ssePost(url: string, body: unknown, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Stream failed (${resp.status}): ${text}`);
  }
  return resp.body;
}

async function _sseGet(url: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const resp = await fetch(url, { signal });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Stream failed (${resp.status}): ${text}`);
  }
  return resp.body;
}

/* ── Chat streaming helper ───────────────────────────────── */

export type ChatStreamChunk =
  | { kind: "text"; text: string }
  | { kind: "tool_progress"; content: string }
  | { kind: "done"; usage?: unknown };

/**
 * Streams a chat completion from Hermes via POST /api/hermes_api/v1/chat/completions.
 * Handles hermes.tool.progress events and standard OpenAI delta chunks.
 */
export async function* hermesChatStream(
  messages: HermesChatMessage[],
  signal?: AbortSignal,
  sessionKey?: string,
): AsyncGenerator<ChatStreamChunk> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionKey) headers["X-Hermes-Session-Key"] = sessionKey;
  const resp = await fetch("/api/hermes_api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({ model: "hermes-agent", messages, stream: true }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Chat stream failed (${resp.status}): ${text}`);
  }
  for await (const ev of parseSseStream(resp.body, signal)) {
    if (ev.event === "hermes.tool.progress") {
      let content = ev.data;
      try {
        const parsed = JSON.parse(ev.data) as Record<string, unknown>;
        content = String(parsed.content ?? parsed.message ?? parsed.tool ?? ev.data);
      } catch { /* raw string */ }
      yield { kind: "tool_progress", content };
    } else if (ev.event === "error") {
      let msg = ev.data;
      try { msg = (JSON.parse(ev.data) as { error?: string }).error ?? ev.data; } catch { /* keep raw */ }
      throw new Error(msg);
    } else if (ev.data === "[DONE]") {
      yield { kind: "done" };
    } else {
      try {
        const chunk = JSON.parse(ev.data) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          usage?: unknown;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { kind: "text", text };
        if (chunk.choices?.[0]?.finish_reason) yield { kind: "done", usage: chunk.usage };
      } catch { /* ignore parse errors on non-JSON data lines */ }
    }
  }
}

/* ── Run events streaming helper ─────────────────────────── */

export type RunStreamEvent =
  | { kind: "token"; text: string }
  | { kind: "tool"; content: string }
  | { kind: "status"; status: string }
  | { kind: "done"; output?: string }
  | { kind: "error"; message: string };

export async function* hermesRunEventStream(
  runId: string,
  signal?: AbortSignal,
): AsyncGenerator<RunStreamEvent> {
  const body = await _sseGet(`/api/hermes_api/v1/runs/${runId}/events`, signal);
  for await (const ev of parseSseStream(body, signal)) {
    if (ev.event === "error") {
      let msg = ev.data;
      try { msg = (JSON.parse(ev.data) as { error?: string }).error ?? ev.data; } catch { /* keep raw */ }
      yield { kind: "error", message: msg };
    } else {
      try {
        const data = JSON.parse(ev.data) as Record<string, unknown>;
        // OpenAI Responses-flavored event names can carry deltas.
        if (
          ev.event === "response.output_text.delta" &&
          typeof data.delta === "string"
        ) {
          yield { kind: "token", text: data.delta };
          continue;
        }
        if (ev.event === "run.completed" || (data as { status?: string }).status === "completed") {
          yield { kind: "done", output: String(data.output ?? "") };
        } else if (ev.event === "tool.started" || ev.event === "tool.completed") {
          yield { kind: "tool", content: ev.data };
        } else if (typeof data.delta === "string") {
          yield { kind: "token", text: data.delta };
        } else {
          yield { kind: "status", status: ev.event };
        }
      } catch {
        yield { kind: "status", status: ev.data };
      }
    }
  }
}

/* ── Session chat streaming helper ──────────────────────── */

export async function* hermesSessionChatStream(
  sessionId: string,
  input: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamChunk> {
  const body = await _ssePost(
    `/api/hermes_api/sessions/${sessionId}/chat/stream`,
    { input },
    signal,
  );
  for await (const ev of parseSseStream(body, signal)) {
    if (ev.event === "error") {
      let msg = ev.data;
      try { msg = (JSON.parse(ev.data) as { error?: string }).error ?? ev.data; } catch { /* keep raw */ }
      throw new Error(msg);
    } else if (ev.event === "assistant.delta") {
      try {
        const d = JSON.parse(ev.data) as { text?: string };
        if (d.text) yield { kind: "text", text: d.text };
      } catch { yield { kind: "text", text: ev.data }; }
    } else if (ev.event === "tool.started" || ev.event === "tool.completed") {
      yield { kind: "tool_progress", content: ev.data };
    } else if (ev.event === "run.completed") {
      yield { kind: "done" };
    }
  }
}

/* ── Health & discovery ──────────────────────────────────── */

export async function hermesApiHealth() {
  return request<{ status: string }>("/api/hermes_api/health");
}

export async function hermesApiHealthDetailed() {
  return request<Record<string, unknown>>("/api/hermes_api/health/detailed");
}

export interface HermesUpdateStatus {
  status?: "ok" | "unknown";
  up_to_date?: boolean | null;
  update_available?: boolean | null;
  current_version?: string | null;
  commits_behind?: number | null;
  update_supported?: boolean;
  source?: string;
  error?: string;
  raw_output?: string;
}

export async function hermesUpdateStatus() {
  return request<HermesUpdateStatus>("/api/hermes_api/update-status");
}

export async function hermesTriggerUpdate() {
  return request<{ status?: string; message?: string; error?: string; output?: string; source?: string; exit_code?: number }>("/api/hermes_api/update", {
    method: "POST",
  });
}

export async function hermesApiModels() {
  return request<{ data: Array<{ id: string }> }>("/api/hermes_api/v1/models");
}

export async function hermesApiCapabilities() {
  return request<HermesCapabilities>("/api/hermes_api/v1/capabilities");
}

export async function hermesApiSkills() {
  return request<HermesSkill[]>("/api/hermes_api/v1/skills");
}

export async function hermesApiToolsets() {
  return request<HermesToolset[]>("/api/hermes_api/v1/toolsets");
}

/* ── Chat completions (non-streaming) ────────────────────── */

export async function hermesChatSync(messages: HermesChatMessage[]) {
  return request<{
    choices: Array<{ message: { role: string; content: string } }>;
    usage?: { total_tokens: number };
  }>("/api/hermes_api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "hermes-agent", messages, stream: false }),
  });
}

/* ── Responses API ───────────────────────────────────────── */

export async function hermesCreateResponse(body: {
  input: string | unknown[];
  instructions?: string;
  store?: boolean;
  previous_response_id?: string;
  conversation?: string;
  stream?: boolean;
}) {
  return request<Record<string, unknown>>("/api/hermes_api/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "hermes-agent", ...body }),
  });
}

export async function hermesGetResponse(id: string) {
  return request<Record<string, unknown>>(`/api/hermes_api/v1/responses/${id}`);
}

export async function hermesDeleteResponse(id: string) {
  return request<{ status: string }>(`/api/hermes_api/v1/responses/${id}`, { method: "DELETE" });
}

/* ── Runs API ────────────────────────────────────────────── */

export async function hermesCreateRun(body: {
  input: string;
  session_id?: string;
  instructions?: string;
  previous_response_id?: string;
}, sessionKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionKey) headers["X-Hermes-Session-Key"] = sessionKey;
  return request<{ run_id: string; status: string }>("/api/hermes_api/v1/runs", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function hermesGetRun(runId: string) {
  return request<HermesRunStatus>(`/api/hermes_api/v1/runs/${runId}`);
}

export async function hermesStopRun(runId: string) {
  return request<{ status: string }>(`/api/hermes_api/v1/runs/${runId}/stop`, { method: "POST" });
}

/* ── Jobs API ────────────────────────────────────────────── */

export async function hermesListJobs() {
  return request<HermesJob[]>("/api/hermes_api/jobs");
}

export async function hermesCreateJob(body: { prompt: string; schedule?: string; [k: string]: unknown }) {
  return request<HermesJob>("/api/hermes_api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function hermesGetJob(jobId: string) {
  return request<HermesJob>(`/api/hermes_api/jobs/${jobId}`);
}

export async function hermesUpdateJob(jobId: string, body: Record<string, unknown>) {
  return request<HermesJob>(`/api/hermes_api/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function hermesDeleteJob(jobId: string) {
  return request<{ status: string }>(`/api/hermes_api/jobs/${jobId}`, { method: "DELETE" });
}

export async function hermesPauseJob(jobId: string) {
  return request<{ status: string }>(`/api/hermes_api/jobs/${jobId}/pause`, { method: "POST" });
}

export async function hermesResumeJob(jobId: string) {
  return request<{ status: string }>(`/api/hermes_api/jobs/${jobId}/resume`, { method: "POST" });
}

export async function hermesRunJob(jobId: string) {
  return request<{ status: string }>(`/api/hermes_api/jobs/${jobId}/run`, { method: "POST" });
}

/* ── Hermes Sessions API (live agent sessions) ───────────── */

export async function hermesListSessions(params?: { limit?: number; offset?: number; source?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.source) qs.set("source", params.source);
  return request<HermesAgentSession[]>(`/api/hermes_api/sessions?${qs}`);
}

export async function hermesCreateSession(body?: { title?: string }) {
  if (body) {
    return request<HermesAgentSession>("/api/hermes_api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return request<HermesAgentSession>("/api/hermes_api/sessions", { method: "POST" });
}

export async function hermesGetSession(id: string) {
  return request<HermesAgentSession>(`/api/hermes_api/sessions/${id}`);
}

export async function hermesUpdateSession(id: string, body: { title?: string; end_reason?: string }) {
  return request<HermesAgentSession>(`/api/hermes_api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function hermesDeleteSession(id: string) {
  return request<{ status: string }>(`/api/hermes_api/sessions/${id}`, { method: "DELETE" });
}

export async function hermesGetSessionMessages(id: string, limit = 500) {
  return request<{ messages: SessionMessage[] }>(
    `/api/hermes_api/sessions/${id}/messages?limit=${limit}`,
  );
}

export async function hermesForkSession(id: string, body?: { title?: string }) {
  return request<HermesAgentSession>(`/api/hermes_api/sessions/${id}/fork`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export async function hermesSessionChat(id: string, input: string) {
  return request<{ output: string; usage?: unknown }>(`/api/hermes_api/sessions/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
}

/* ═══════════════════════════════════════════════════════════
   KANBAN ACTIVITY PAGE — types + API functions
   All calls go through /api/kanban
   ═══════════════════════════════════════════════════════════ */

/* ── Types ──────────────────────────────────────────────── */

export type KanbanSummary = {
  total_boards: number;
  total_tasks: number;
  tasks_by_status: {
    done: number;
    running: number;
    todo: number;
    blocked: number;
    triage: number;
  };
  completion_rate: number;
  active_agents: number;
  blocked_count: number;
};

export type KanbanStatusEntry = {
  status: string;
  count: number;
};

export type KanbanBoard = {
  board_id: string;
  board_name: string;
  total_tasks: number;
  statuses: KanbanStatusEntry[];
  done: number;
  running: number;
  todo: number;
  blocked: number;
  triage: number;
};

export type KanbanBoardDetail = {
  board_id: string;
  board_name: string;
  total: number;
  limit: number;
  offset: number;
  filters: {
    status: string | null;
    assignee: string | null;
    priority: number | null;
    sort: string;
    sort_dir: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    body: string | null;
    assignee: string | null;
    status: string;
    priority: number;
    created_by: string;
    created_at: number;
    started_at: number | null;
    completed_at: number | null;
    workspace_kind: string | null;
    tenant: string | null;
    result: string | null;
  }>;
};

export type KanbanAgent = {
  assignee: string;
  total_tasks: number;
  active_tasks: number;
  completed_24h: number;
  completed_7d: number;
  completed_30d: number;
};

export type KanbanActivityEvent = {
  id: number;
  task_id: string | null;
  run_id: string | null;
  kind: string;
  payload: string;
  created_at: number;
  task_title: string | null;
  task_assignee: string | null;
  task_status: string | null;
};

export type KanbanActivityResponse = {
  total: number;
  limit: number;
  offset: number;
  filters: {
    type: string | null;
    since: number | null;
  };
  events: KanbanActivityEvent[];
};

/* ── API functions ──────────────────────────────────────── */

export async function kanbanSummary(): Promise<KanbanSummary> {
  return request<KanbanSummary>("/api/kanban/summary");
}

export async function kanbanBoards(): Promise<{ boards: KanbanBoard[] }> {
  return request<{ boards: KanbanBoard[] }>("/api/kanban/boards");
}

export async function kanbanBoardDetail(
  boardId: string,
  params?: {
    status?: string;
    assignee?: string;
    priority?: number;
    sort?: string;
    sort_dir?: string;
    limit?: number;
    offset?: number;
  },
): Promise<KanbanBoardDetail> {
  const qs = new URLSearchParams();
  if (params) {
    if (params.status) qs.set("status", params.status);
    if (params.assignee) qs.set("assignee", params.assignee);
    if (params.priority !== undefined) qs.set("priority", String(params.priority));
    if (params.sort) qs.set("sort", params.sort);
    if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<KanbanBoardDetail>(`/api/kanban/boards/${boardId}${suffix}`);
}

export async function kanbanAgents(): Promise<{ agents: KanbanAgent[] }> {
  return request<{ agents: KanbanAgent[] }>("/api/kanban/agents");
}

export async function kanbanActivity(params?: {
  limit?: number;
  offset?: number;
  type?: string;
  since?: number;
}): Promise<KanbanActivityResponse> {
  const qs = new URLSearchParams();
  if (params) {
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    if (params.type) qs.set("type", params.type);
    if (params.since !== undefined) qs.set("since", String(params.since));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<KanbanActivityResponse>(`/api/kanban/activity${suffix}`);
}

/* ── Kanban Card types ──────────────────────────────────── */

export type KanbanCard = {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: string;
  priority: number;
  created_by: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  workspace_kind: string | null;
  tenant: string | null;
  result: string | null;
};

export type KanbanListCardsResponse = {
  board_id: string;
  board_name: string;
  total: number;
  limit: number;
  offset: number;
  filters: {
    status: string | null;
    assignee: string | null;
    priority: number | null;
    sort: string;
    sort_dir: string;
  };
  tasks: KanbanCard[];
};

/* ── Kanban Card API functions ──────────────────────────── */

export async function kanbanListCards(params: {
  status: string;
  assignee?: string;
  priority?: number;
  limit?: number;
  offset?: number;
  sort?: string;
  sort_dir?: string;
}): Promise<KanbanListCardsResponse> {
  const qs = new URLSearchParams();
  qs.set("status", params.status);
  if (params.assignee) qs.set("assignee", params.assignee);
  if (params.priority !== undefined) qs.set("priority", String(params.priority));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.sort) qs.set("sort", params.sort);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  return request<KanbanListCardsResponse>(`/api/kanban/cards?${qs}`);
}

export async function kanbanMoveCard(
  cardId: string,
  newStatus: string,
): Promise<KanbanCard> {
  return request<KanbanCard>(`/api/kanban/cards/${cardId}?status=${encodeURIComponent(newStatus)}`, {
    method: "PATCH",
  });
}

/* ── Task detail ─────────────────────────────────────────── */

export type KanbanTaskDetail = KanbanCard & {
  workspace_path: string | null;
  branch_name: string | null;
  claim_lock: string | null;
  claim_expires: number | null;
  consecutive_failures: number;
  last_failure_error: string | null;
  max_runtime_seconds: number | null;
  last_heartbeat_at: number | null;
  current_run_id: number | null;
  workflow_template_id: string | null;
  current_step_key: string | null;
  model_override: string | null;
  max_retries: number | null;
  session_id: string | null;
  goal_mode: number;
  goal_max_turns: number | null;
  runs: Array<{
    id: number;
    task_id: string;
    profile: string | null;
    step_key: string | null;
    status: string;
    claim_lock: string | null;
    claim_expires: number | null;
    worker_pid: number | null;
    max_runtime_seconds: number | null;
    last_heartbeat_at: number | null;
    started_at: number;
    ended_at: number | null;
    outcome: string | null;
    summary: string | null;
    metadata: string | null;
    error: string | null;
  }>;
  comments: Array<{
    id: number;
    task_id: string;
    author: string;
    body: string;
    created_at: number;
  }>;
  parents: Array<{ id: string; title: string; status: string }>;
  children: Array<{ id: string; title: string; status: string }>;
  recent_events: Array<{
    id: number;
    task_id: string;
    run_id: number | null;
    kind: string;
    payload: string;
    created_at: number;
  }>;
};

export async function kanbanTaskDetail(taskId: string): Promise<KanbanTaskDetail> {
  return request<KanbanTaskDetail>(`/api/kanban/tasks/${taskId}`);
}

/* ── Comments ────────────────────────────────────────────── */

export async function kanbanAddComment(
  taskId: string,
  body: string,
  author?: string,
): Promise<NonNullable<KanbanTaskDetail["comments"]>[number]> {
  const qs = new URLSearchParams();
  qs.set("body", body);
  if (author) qs.set("author", author);
  return request<NonNullable<KanbanTaskDetail["comments"]>[number]>(
    `/api/kanban/tasks/${taskId}/comments?${qs}`,
    { method: "POST" },
  );
}

/* ── Create task ─────────────────────────────────────────── */

export async function kanbanCreateTask(params: {
  title: string;
  body?: string;
  assignee?: string;
  priority?: number;
  status?: string;
  created_by?: string;
}): Promise<KanbanCard> {
  const qs = new URLSearchParams();
  qs.set("title", params.title);
  if (params.body) qs.set("body", params.body);
  if (params.assignee) qs.set("assignee", params.assignee);
  if (params.priority !== undefined) qs.set("priority", String(params.priority));
  if (params.status) qs.set("status", params.status);
  if (params.created_by) qs.set("created_by", params.created_by);
  return request<KanbanCard>(`/api/kanban/tasks?${qs}`, { method: "POST" });
}

/* ── Search ──────────────────────────────────────────────── */

export type KanbanSearchResponse = {
  query: string;
  total: number;
  limit: number;
  offset: number;
  tasks: KanbanCard[];
};

export async function kanbanSearch(
  query: string,
  limit?: number,
  offset?: number,
): Promise<KanbanSearchResponse> {
  const qs = new URLSearchParams();
  qs.set("q", query);
  if (limit !== undefined) qs.set("limit", String(limit));
  if (offset !== undefined) qs.set("offset", String(offset));
  return request<KanbanSearchResponse>(`/api/kanban/search?${qs}`);
}

/* ── Update task ─────────────────────────────────────────── */

export async function kanbanUpdateTask(
  taskId: string,
  params: {
    title?: string;
    body?: string;
    assignee?: string;
    priority?: number;
  },
): Promise<KanbanCard> {
  const qs = new URLSearchParams();
  if (params.title !== undefined) qs.set("title", params.title);
  if (params.body !== undefined) qs.set("body", params.body);
  if (params.assignee !== undefined) qs.set("assignee", params.assignee);
  if (params.priority !== undefined) qs.set("priority", String(params.priority));
  return request<KanbanCard>(`/api/kanban/tasks/${taskId}?${qs}`, { method: "PATCH" });
}

/* ── Delete task ─────────────────────────────────────────── */

export async function kanbanDeleteTask(taskId: string): Promise<{ deleted: boolean; task_id: string }> {
  return request<{ deleted: boolean; task_id: string }>(`/api/kanban/tasks/${taskId}`, { method: "DELETE" });
}

/* ── Link / Unlink tasks ─────────────────────────────────── */

export async function kanbanLinkTasks(parentId: string, childId: string): Promise<{ parent_id: string; child_id: string; linked: boolean }> {
  return request(`/api/kanban/tasks/${parentId}/link/${childId}`, { method: "POST" });
}

export async function kanbanUnlinkTasks(parentId: string, childId: string): Promise<{ parent_id: string; child_id: string; unlinked: boolean }> {
  return request(`/api/kanban/tasks/${parentId}/link/${childId}`, { method: "DELETE" });
}

/* ── Block / Unblock tasks ───────────────────────────────── */

export async function kanbanBlockTask(taskId: string, reason: string): Promise<KanbanCard> {
  const qs = new URLSearchParams();
  qs.set("reason", reason);
  return request<KanbanCard>(`/api/kanban/tasks/${taskId}/block?${qs}`, { method: "POST" });
}

export async function kanbanUnblockTask(taskId: string, status?: string): Promise<KanbanCard> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  return request<KanbanCard>(`/api/kanban/tasks/${taskId}/unblock?${qs}`, { method: "POST" });
}

/* ── Reclaim task ────────────────────────────────────────── */

export async function kanbanReclaimTask(taskId: string): Promise<KanbanCard> {
  return request<KanbanCard>(`/api/kanban/tasks/${taskId}/reclaim`, { method: "POST" });
}

/* ── Assign task ─────────────────────────────────────────── */

export async function kanbanAssignTask(taskId: string, assignee: string): Promise<KanbanCard> {
  const qs = new URLSearchParams();
  qs.set("assignee", assignee);
  return request<KanbanCard>(`/api/kanban/tasks/${taskId}/assign?${qs}`, { method: "POST" });
}

/* ═══════════════════════════════════════════════════════════
   GWS (Google Workspace) API — file upload + Drive helpers
   ═══════════════════════════════════════════════════════════ */

/* ── Types ──────────────────────────────────────────────── */

export type GwsUploadResult = {
  file_name: string;
  drive_link: string;
  drive_id: string;
  mime_type: string;
};

export type GwsHermesFolder = {
  folder_id: string;
  folder_link: string;
};

export type FileAttachment = {
  id: string;
  name: string;
  type:
    | "spreadsheet"
    | "document"
    | "presentation"
    | "image"
    | "archive"
    | "text"
    | "pdf"
    | "other";
  size: number;
  mimeType: string;
  driveLink: string;
  driveId: string;
};

/* ── fileCategory helper ─────────────────────────────────── */

/**
 * Classifies a file into a category based on its MIME type and filename extension.
 * MIME type is checked first (more reliable), then falls back to extension matching.
 */
export function fileCategory(
  mimeType: string,
  fileName: string,
): FileAttachment["type"] {
  const lowerMime = mimeType.toLowerCase();
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : "";

  // Check MIME type first — most authoritative
  if (lowerMime === "application/pdf") return "pdf";
  if (lowerMime.startsWith("image/")) return "image";
  if (
    lowerMime.includes("spreadsheet") ||
    lowerMime === "application/vnd.ms-excel" ||
    lowerMime === "text/csv"
  )
    return "spreadsheet";
  if (
    lowerMime.includes("document") ||
    lowerMime.includes("wordprocessing") ||
    lowerMime === "application/msword" ||
    lowerMime === "application/rtf"
  )
    return "document";
  if (
    lowerMime.includes("presentation") ||
    lowerMime === "application/vnd.ms-powerpoint"
  )
    return "presentation";
  if (
    lowerMime.includes("zip") ||
    lowerMime.includes("tar") ||
    lowerMime.includes("compressed") ||
    lowerMime.includes("archive") ||
    lowerMime === "application/x-rar-compressed" ||
    lowerMime === "application/x-7z-compressed"
  )
    return "archive";
  if (
    lowerMime.startsWith("text/") ||
    lowerMime === "application/json" ||
    lowerMime === "application/xml" ||
    lowerMime === "application/javascript"
  )
    return "text";

  // Fall back to file extension
  const extMap: Record<string, FileAttachment["type"]> = {
    ".xlsx": "spreadsheet",
    ".xls": "spreadsheet",
    ".csv": "spreadsheet",
    ".ods": "spreadsheet",
    ".docx": "document",
    ".doc": "document",
    ".odt": "document",
    ".rtf": "document",
    ".pptx": "presentation",
    ".ppt": "presentation",
    ".odp": "presentation",
    ".pdf": "pdf",
    ".zip": "archive",
    ".tar": "archive",
    ".gz": "archive",
    ".rar": "archive",
    ".7z": "archive",
    ".bz2": "archive",
    ".txt": "text",
    ".md": "text",
    ".log": "text",
    ".json": "text",
    ".xml": "text",
    ".yaml": "text",
    ".yml": "text",
    ".js": "text",
    ".ts": "text",
    ".py": "text",
    ".sh": "text",
    ".css": "text",
    ".html": "text",
    ".svg": "image",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".webp": "image",
    ".bmp": "image",
    ".ico": "image",
  };

  if (ext in extMap) return extMap[ext];

  return "other";
}

/* ── API functions ──────────────────────────────────────── */

/**
 * Upload a file to Google Drive via the backend GWS endpoint.
 * Sends the file as FormData — the browser sets the multipart
 * Content-Type header with the correct boundary automatically.
 */
export async function uploadToDrive(file: File): Promise<GwsUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  return request<GwsUploadResult>("/api/gws/upload", {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets multipart/form-data with boundary
  });
}

/**
 * Retrieve the Hermes folder link and ID from Google Drive.
 */
export async function getHermesFolder(): Promise<GwsHermesFolder> {
  return request<GwsHermesFolder>("/api/gws/hermes-folder");
}

/* ── Telegram (MTProto user client) ─────────────────────── */

export type TelegramStatus = {
  configured: boolean;
  connected: boolean;
  bot_username?: string | null;
  error?: string | null;
  missing?: string[];
  max_file_size_mb?: number;
};

export type TelegramMessage = {
  id: number;
  role: "user" | "assistant" | string;
  content: string;
  timestamp?: string | null;
  outgoing?: boolean;
  has_media?: boolean;
  media_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  drive_links?: string[];
};

export async function telegramStatus(): Promise<TelegramStatus> {
  return request<TelegramStatus>("/api/telegram/status");
}

export async function telegramMessages(limit = 50): Promise<{ messages: TelegramMessage[]; count: number }> {
  return request<{ messages: TelegramMessage[]; count: number }>(
    `/api/telegram/messages?limit=${limit}`,
  );
}

export async function telegramSend(text: string, file?: File): Promise<TelegramMessage> {
  if (file) {
    const form = new FormData();
    const trimmed = text.trim();
    if (trimmed) form.append("text", trimmed);
    form.append("file", file);
    return request<TelegramMessage>("/api/telegram/send", {
      method: "POST",
      body: form,
    });
  }
  return request<TelegramMessage>("/api/telegram/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export function telegramMediaDownloadUrl(messageId: number): string {
  return `/api/telegram/messages/${messageId}/media`;
}
