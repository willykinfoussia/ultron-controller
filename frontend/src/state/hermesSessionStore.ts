const STORAGE_KEY = "uc-hermes-active-session";
const TTL_MS = 24 * 60 * 60 * 1000;
const SCHEMA_VERSION = 1;

export type PersistedConversationMode = "stateless" | "session";

export type HermesPersistedSession = {
  version: number;
  activeSessionId: string | null;
  activeRunId: string | null;
  conversationMode: PersistedConversationMode;
  sessionKey: string;
  lastActiveAt: number;
  expiresAt: number;
};

function nowMs() {
  return Date.now();
}

export function defaultHermesSession(): HermesPersistedSession {
  const now = nowMs();
  return {
    version: SCHEMA_VERSION,
    activeSessionId: null,
    activeRunId: null,
    conversationMode: "session",
    sessionKey: "",
    lastActiveAt: now,
    expiresAt: now + TTL_MS,
  };
}

export function readHermesSessionState(): HermesPersistedSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultHermesSession();
    const parsed = JSON.parse(raw) as Partial<HermesPersistedSession>;
    if (parsed.version !== SCHEMA_VERSION) return defaultHermesSession();
    const merged: HermesPersistedSession = {
      ...defaultHermesSession(),
      ...parsed,
      version: SCHEMA_VERSION,
    };
    if (merged.expiresAt <= nowMs()) {
      clearHermesSessionState();
      return defaultHermesSession();
    }
    return merged;
  } catch {
    return defaultHermesSession();
  }
}

export function writeHermesSessionState(
  patch: Partial<Omit<HermesPersistedSession, "version" | "lastActiveAt" | "expiresAt">>,
): HermesPersistedSession {
  const prev = readHermesSessionState();
  const now = nowMs();
  const next: HermesPersistedSession = {
    ...prev,
    ...patch,
    version: SCHEMA_VERSION,
    lastActiveAt: now,
    expiresAt: now + TTL_MS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function touchHermesSessionState(): HermesPersistedSession {
  return writeHermesSessionState({});
}

export function clearHermesSessionState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
