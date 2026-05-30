import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Toast, type ToastKind, type ToastState } from "./components/Toast";
import { HermesPage } from "./pages/HermesPage";
import { MemoryPage } from "./pages/MemoryPage";
import { OpenVikingPage } from "./pages/OpenVikingPage";
import { SearchPage } from "./pages/SearchPage";
import { SessionsPage } from "./pages/SessionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemPage } from "./pages/SystemPage";

/* ── Types ──────────────────────────────────────────────── */
type TabId = "openviking" | "memory" | "sessions" | "search" | "system" | "hermes" | "settings";
type Theme  = "dark" | "light";
type AccentId = "indigo" | "blue" | "cyan" | "emerald" | "rose" | "amber";

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
  { id: "activity",  label: "Activity" },
  { id: "system",    label: "System" },
];

const NAV: NavItem[] = [
  { id: "openviking", label: "OpenViking", icon: "📚", section: "knowledge" },
  { id: "memory",     label: "Hermes Memory", icon: "🧠", section: "knowledge" },
  { id: "sessions",   label: "Sessions",   icon: "🗂️", section: "activity" },
  { id: "search",     label: "Search",     icon: "🔍", section: "activity" },
  { id: "hermes",     label: "Hermes",     icon: "🤖", section: "activity" },
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
  const [activeTab, setActiveTab] = useState<TabId>("openviking");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const dirRef = useRef<1 | -1>(1);

  function handleTabChange(id: TabId) {
    const cur  = NAV.findIndex((n) => n.id === activeTab);
    const next = NAV.findIndex((n) => n.id === id);
    dirRef.current = next >= cur ? 1 : -1;
    setActiveTab(id);
  }

  /* ── Toast ── */
  const [toast, setToastState] = useState<ToastState>(null);
  const setToast = useCallback((message: string, kind: ToastKind = "info") => {
    setToastState({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToastState(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  /* ── Page render ── */
  const page = useMemo(() => {
    const props = { setToast };
    if (activeTab === "openviking") return <OpenVikingPage {...props} />;
    if (activeTab === "memory")     return <MemoryPage {...props} />;
    if (activeTab === "sessions")   return <SessionsPage {...props} />;
    if (activeTab === "system")     return <SystemPage {...props} />;
    if (activeTab === "hermes")     return <HermesPage {...props} />;
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
  }, [activeTab, setToast, theme, accent, appVersion]);

  /* ── Reduced motion ── */
  const prefersReduced = useReducedMotion();

  const pageVariants = prefersReduced
    ? undefined
    : {
        initial: { opacity: 0, x: dirRef.current * 20 },
        animate: { opacity: 1, x: 0 },
        exit:    { opacity: 0, x: dirRef.current * -14 },
      };

  const pageTransition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.18, ease: [0, 0, 0.2, 1] };

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
                    onClick={() => handleTabChange(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
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
          <span className="topbar-title">
            {NAV.find((n) => n.id === activeTab)?.label ?? ""}
          </span>
          <div className="topbar-nav">
            <button
              className={`topbar-nav-link ${activeTab === "memory" ? "active" : ""}`}
              onClick={() => handleTabChange("memory")}
            >
              Hermès Memory
            </button>
            <button
              className={`topbar-nav-link ${activeTab === "hermes" ? "active" : ""}`}
              onClick={() => handleTabChange("hermes")}
            >
              Hermès
            </button>
          </div>
        </header>

        {/* ── Page (animated) ── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={activeTab}
            role="main"
            variants={pageVariants}
            initial={prefersReduced ? false : "initial"}
            animate={prefersReduced ? undefined : "animate"}
            exit={prefersReduced ? undefined : "exit"}
            transition={pageTransition}
            className="main-content"
          >
            {page}
          </motion.main>
        </AnimatePresence>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
