import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hermesTriggerUpdate, hermesUpdateStatus } from "./api/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toast, type ToastKind, type ToastState } from "./components/Toast";
import { HermesPage } from "./pages/HermesPage";
import { KanbanBoardPage } from "./pages/KanbanPage";
import { MemoryPage } from "./pages/MemoryPage";
import { OpenVikingPage } from "./pages/OpenVikingPage";
import { SearchPage } from "./pages/SearchPage";
import { SessionsPage } from "./pages/SessionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemPage } from "./pages/SystemPage";
import { TelegramIcon } from "./components/TelegramIcon";
import { TelegramPage } from "./pages/TelegramPage";
import { StocksPage } from "./pages/StocksPage";
import AnalysisPage from "./pages/Analysis";

/* ── Types ──────────────────────────────────────────────── */
type TabId = "openviking" | "memory" | "sessions" | "search" | "system" | "hermes" | "kanban" | "telegram" | "settings" | "stocks" | "analysis";
type Theme  = "dark" | "light";
type AccentId = "indigo" | "blue" | "cyan" | "emerald" | "rose" | "amber";
type HermesLedStatus = "up_to_date" | "outdated" | "unknown";

/* ── Sections (sidebar groups) ──────────────────────────── */
type SectionId = "knowledge" | "activity" | "system";

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
  section: SectionId;
}

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "knowledge", label: "Knowledge" },
  { id: "activity",    label: "Activity" },
  { id: "system",    label: "System" },
];

const NAV: NavItem[] = [
  { id: "openviking", label: "OpenViking", icon: "📚", section: "knowledge" },
  { id: "memory",     label: "Hermes Memory", icon: "🧠", section: "knowledge" },
  { id: "sessions",   label: "Sessions",   icon: "🗂️", section: "knowledge" },
  { id: "search",     label: "Search",     icon: "🔍", section: "knowledge" },
  { id: "hermes",     label: "Hermes",     icon: "🤖", section: "activity" },
  { id: "kanban",     label: "Kanban",     icon: "📊", section: "activity" },
  { id: "telegram",   label: "Telegram",   icon: "telegram", section: "activity" },
  { id: "stocks",     label: "Stocks",     icon: "📈", section: "activity" },
  { id: "analysis",   label: "Analysis",   icon: "🔬", section: "activity" },
  { id: "system",     label: "System",     icon: "🖥️", section: "system" },
  { id: "settings",   label: "Settings",   icon: "⚙️", section: "system" },
];

/* ── Accent presets ──────────────────────────────────────── */
const ACCENTS: Record<AccentId, {
  color: string;
  primary: string;
  hover: string;
  fg: string;
  sub: string;
  ring: string;
  glow: string;
}> = {
  indigo:  { color: "#6c6af6", primary: "#6c6af6", hover: "#7f7df9", fg: "#fff",  sub: "rgba(108,106,246,0.12)", ring: "rgba(108,106,246,0.30)", glow: "0 0 16px rgba(108,106,246,0.25)" },
  blue:    { color: "#3b82f6", primary: "#3b82f6", hover: "#60a5fa", fg: "#fff",  sub: "rgba(59,130,246,0.12)",  ring: "rgba(59,130,246,0.30)",  glow: "0 0 16px rgba(59,130,246,0.25)"  },
  cyan:    { color: "#06b6d4", primary: "#06b6d4", hover: "#22d3ee", fg: "#fff",  sub: "rgba(6,182,212,0.12)",   ring: "rgba(6,182,212,0.30)",   glow: "0 0 16px rgba(6,182,212,0.25)"   },
  emerald: { color: "#10b981", primary: "#10b981", hover: "#34d399", fg: "#fff",  sub: "rgba(16,185,129,0.12)",  ring: "rgba(16,185,129,0.30)",  glow: "0 0 16px rgba(16,185,129,0.25)"  },
  rose:    { color: "#f43f5e", primary: "#f43f5e", hover: "#fb7185", fg: "#fff",  sub: "rgba(244,63,94,0.12)",   ring: "rgba(244,63,94,0.30)",   glow: "0 0 16px rgba(244,63,94,0.25)"   },
  amber:   { color: "#f59e0b", primary: "#f59e0b", hover: "#fbbf24", fg: "#000",  sub: "rgba(245,158,11,0.12)",  ring: "rgba(245,158,11,0.30)",  glow: "0 0 16px rgba(245,158,11,0.25)"  },
};

const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

function applyAccent(id: AccentId) {
  const a = ACCENTS[id];
  const root = document.documentElement;
  root.style.setProperty("--primary",       a.primary);
  root.style.setProperty("--primary-hover", a.hover);
  root.style.setProperty("--primary-fg",    a.fg);
  root.style.setProperty("--primary-sub",   a.sub);
  root.style.setProperty("--primary-ring",  a.ring);
  root.style.setProperty("--primary-glow",  a.glow);
}

/* ── Version hook ─────────────────────────────────────────── */
function useVersion() {
  const [version, setVersion] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/version")
      .then((r) => r.json())
      .then((d: Record<string, string>) => {
        if (!cancelled && d.version) setVersion(d.version);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);
  return version;
}

/* ── App ─────────────────────────────────────────────────── */
export default function App() {
  const appVersion = useVersion();
  const [hermesStatus, setHermesStatus] = useState<HermesLedStatus>("unknown");
  const [isHermesUpdating, setIsHermesUpdating] = useState(false);
  const [hermesUpdateSupported, setHermesUpdateSupported] = useState(true);
  const [hermesCurrentVersion, setHermesCurrentVersion] = useState<string | null>(null);

  const refreshHermesStatus = useCallback(async (): Promise<boolean> => {
    try {
      const status = await hermesUpdateStatus();
      if (status.up_to_date === true) setHermesStatus("up_to_date");
      else if (status.up_to_date === false) setHermesStatus("outdated");
      else setHermesStatus("unknown");
      setHermesUpdateSupported(status.update_supported !== false);
      setHermesCurrentVersion(status.current_version ?? null);
      return true;
    } catch {
      setHermesStatus("unknown");
      setHermesUpdateSupported(false);
      setHermesCurrentVersion(null);
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      await refreshHermesStatus();
    };
    poll().catch(() => undefined);
    const intervalId = window.setInterval(() => {
      poll().catch(() => undefined);
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshHermesStatus]);

  /* ── Preferences (persisted) ── */
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("uc-theme") as Theme | null) ?? "dark"
  );
  const [accent, setAccentState] = useState<AccentId>(
    () => (localStorage.getItem("uc-accent") as AccentId | null) ?? "indigo"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("uc-theme", theme);
  }, [theme]);

  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem("uc-accent", accent);
  }, [accent]);

  function setAccent(id: AccentId) {
    setAccentState(id);
  }

  /* ── Navigation ── */
  const [activeTab, setActiveTab] = useState<TabId>("hermes");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ── Toast ── */
  const [toast, setToastState] = useState<ToastState>(null);
  const setToast = useCallback((message: string, kind: ToastKind = "info") => {
    setToastState({ message, kind });
  }, []);

  const hermesIndicatorLabel = useMemo(() => {
    const versionSuffix = hermesCurrentVersion ? ` (v${hermesCurrentVersion})` : "";
    if (isHermesUpdating) return "Hermes update in progress";
    if (!hermesUpdateSupported) return `Hermes update not supported${versionSuffix}`;
    if (hermesStatus === "up_to_date") return `Hermes is up to date${versionSuffix}`;
    if (hermesStatus === "outdated") return `Hermes update available${versionSuffix}`;
    return `Hermes status unavailable${versionSuffix}`;
  }, [isHermesUpdating, hermesCurrentVersion, hermesStatus, hermesUpdateSupported]);

  const handleHermesUpdateClick = useCallback(async () => {
    if (isHermesUpdating) return;
    if (!hermesUpdateSupported) {
      setToast("Hermes update is not supported on this server.", "info");
      return;
    }
    setIsHermesUpdating(true);
    try {
      const result = await hermesTriggerUpdate();
      if (result.status === "error") {
        throw new Error(result.error || result.message || "Hermes update failed");
      }
      const statusRefreshed = await refreshHermesStatus();
      if (!statusRefreshed) {
        setToast("Hermes update triggered. Unable to refresh update status.", "info");
      } else {
        setToast(result.message ?? "Hermes update triggered", "success");
      }
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setIsHermesUpdating(false);
    }
  }, [hermesUpdateSupported, isHermesUpdating, refreshHermesStatus, setToast]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToastState(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  /* ── Page render ── */
  function renderPage() {
    const props = { setToast };
    if (activeTab === "openviking") return <OpenVikingPage {...props} />;
    if (activeTab === "memory")     return <MemoryPage {...props} />;
    if (activeTab === "sessions")   return <SessionsPage {...props} />;
    if (activeTab === "system")     return <SystemPage {...props} />;
    if (activeTab === "hermes")     return <HermesPage {...props} />;
    if (activeTab === "kanban")     return <KanbanBoardPage {...props} />;
    if (activeTab === "telegram")   return <TelegramPage {...props} />;
    if (activeTab === "stocks")     return <StocksPage {...props} />;
    if (activeTab === "analysis")   return <AnalysisPage />;
    if (activeTab === "settings")   return (
      <SettingsPage
        theme={theme}
        accent={accent}
        onThemeChange={setThemeState}
        onAccentChange={setAccent}
        setToast={setToast}
        appVersion={appVersion}
      />
    );
    return <SearchPage {...props} />;
  }

  /* ── Sidebar sections ── */
  const navBySection = SECTIONS.map((sec) => ({
    ...sec,
    items: NAV.filter((n) => n.section === sec.id),
  }));

  /* ── Render ── */
  return (
    <div className={`layout ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>

      {/* ── Sidebar ── */}
      <aside className="sidebar" role="navigation" aria-label="Sidebar">
        {/* Sidebar header */}
        <div className="sidebar-header">
          <span className="sidebar-logo" aria-label="Ultron Controller">
            <span>U</span>{sidebarOpen && "ltron"}
          </span>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            ◀
          </button>
        </div>

        {/* Nav sections */}
        <div className="sidebar-nav">
          {navBySection.map((sec) => (
            <div key={sec.id} className="sidebar-section">
              {sidebarOpen && (
                <p className="sidebar-section-label">{sec.label}</p>
              )}
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`sidebar-link ${isActive ? "active" : ""}`}
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <span className="sidebar-link-icon" aria-hidden="true">
                      {item.icon === "telegram" ? <TelegramIcon size={16} /> : item.icon}
                    </span>
                    {sidebarOpen && (
                      <span className="sidebar-link-label">{item.label}</span>
                    )}
                    {isActive && (
                      <motion.span
                        className="sidebar-link-indicator"
                        layoutId="sidebar-indicator"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        {sidebarOpen && (
          <div className="sidebar-footer">
            <span className="sidebar-version">v{appVersion || "—"}</span>
          </div>
        )}
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">
        {/* ── Top bar ── */}
        <header className="topbar" role="banner">
          {!sidebarOpen && (
            <button
              className="topbar-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              title="Open sidebar"
            >
              ☰
            </button>
          )}
          <div className="topbar-nav">
            <button
              className={`topbar-nav-link ${activeTab === "memory" ? "active" : ""}`}
              onClick={() => setActiveTab("memory")}
            >
              Hermes Memory
            </button>
            <button
              className={`topbar-nav-link ${activeTab === "hermes" ? "active" : ""}`}
              onClick={() => setActiveTab("hermes")}
            >
              Hermes
            </button>
            <button
              className={`topbar-nav-link ${activeTab === "telegram" ? "active" : ""}`}
              onClick={() => setActiveTab("telegram")}
            >
              Telegram
            </button>
          </div>
          <div className="topbar-right">
            <button
              className={`topbar-hermes-indicator topbar-hermes-indicator--${hermesStatus}${isHermesUpdating ? " is-updating" : ""}`}
              onClick={() => {
                handleHermesUpdateClick().catch(() => undefined);
              }}
              disabled={isHermesUpdating || !hermesUpdateSupported}
              aria-label={hermesIndicatorLabel}
              title={hermesIndicatorLabel}
            >
              <span
                className={`topbar-hermes-indicator-dot${isHermesUpdating ? " is-spinning" : ""}`}
                aria-hidden="true"
              />
            </button>
            <span className="topbar-title">
              {NAV.find((n) => n.id === activeTab)?.label ?? ""}
            </span>
          </div>
        </header>

        {/* ── Page ── */}
        <main role="main" className="main-content">
          <ErrorBoundary key={activeTab}>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
