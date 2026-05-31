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
