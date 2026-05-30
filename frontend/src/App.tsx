import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Toast, type ToastKind, type ToastState } from "./components/Toast";
import { HermesPage } from "./pages/HermesPage";
import { MemoryPage } from "./pages/MemoryPage";
import { OpenVikingPage } from "./pages/OpenVikingPage";
import { SearchPage } from "./pages/SearchPage";
import { SessionsPage } from "./pages/SessionsPage";
import { SystemPage } from "./pages/SystemPage";

/* ── Types ──────────────────────────────────────────────── */
type TabId = "openviking" | "memory" | "sessions" | "search" | "system" | "hermes";
type Theme  = "dark" | "light";
type AccentId = "indigo" | "blue" | "cyan" | "emerald" | "rose" | "amber";

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
  root.style.setProperty("--primary",      a.primary);
  root.style.setProperty("--primary-hover", a.hover);
  root.style.setProperty("--primary-fg",   a.fg);
  root.style.setProperty("--primary-sub",  a.sub);
  root.style.setProperty("--primary-ring", a.ring);
  root.style.setProperty("--primary-glow", a.glow);
}

/* ── Tabs config ─────────────────────────────────────────── */
const TABS: Array<{ id: TabId; label: string }> = [
  { id: "openviking", label: "OpenViking" },
  { id: "memory",     label: "Hermes Memory" },
  { id: "sessions",   label: "Sessions" },
  { id: "search",     label: "Search" },
  { id: "system",     label: "System" },
  { id: "hermes",     label: "Hermes" },
];

const TAB_IDS = TABS.map((t) => t.id);

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

  /* Apply theme on mount and on change */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("uc-theme", theme);
  }, [theme]);

  /* Apply accent on mount and on change */
  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem("uc-accent", accent);
  }, [accent]);

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  function setAccent(id: AccentId) {
    setAccentState(id);
  }

  /* ── Tab navigation ── */
  const [activeTab, setActiveTab] = useState<TabId>("openviking");
  const dirRef = useRef<1 | -1>(1);

  function handleTabChange(id: TabId) {
    const cur  = TAB_IDS.indexOf(activeTab);
    const next = TAB_IDS.indexOf(id);
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
    return <SearchPage {...props} />;
  }, [activeTab, setToast]);

  /* ── Reduced motion ── */
  const prefersReduced = useReducedMotion();

  const pageVariants = prefersReduced
    ? undefined
    : {
        initial: { opacity: 0, x: dirRef.current * 28 },
        animate: { opacity: 1, x: 0 },
        exit:    { opacity: 0, x: dirRef.current * -18 },
      };

  const pageTransition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.2, ease: [0, 0, 0.2, 1] };

  /* ── Render ── */
  return (
    <div className="layout">
      {/* ── Header ── */}
      <header className="app-header" role="banner">
        <span className="app-name" aria-label="Ultron Controller">
          <span>U</span>ltron
        </span>
        <div className="app-divider" aria-hidden="true" />

        <nav role="tablist" className="tabs" aria-label="Navigation principale">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                className={`tab-btn ${isActive ? "active" : ""}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
                {isActive && (
                  <motion.span
                    className="tab-indicator"
                    layoutId="tab-indicator"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Right controls: accent + theme ── */}
        <div className="header-controls">
          <div className="accent-picker" role="group" aria-label="Accent color">
            {ACCENT_IDS.map((id) => (
              <button
                key={id}
                className={`accent-dot ${accent === id ? "active" : ""}`}
                style={{
                  backgroundColor: ACCENTS[id].color,
                  color: ACCENTS[id].color,
                }}
                onClick={() => setAccent(id)}
                aria-label={`Accent ${id}`}
                aria-pressed={accent === id}
                title={id.charAt(0).toUpperCase() + id.slice(1)}
              />
            ))}
          </div>

          <motion.button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            whileTap={prefersReduced ? {} : { scale: 0.88, rotate: 20 }}
            transition={{ duration: 0.15 }}
          >
            {theme === "dark" ? "☀︎" : "☽"}
          </motion.button>
        </div>
      </header>

      {/* ── Page (animated) ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={activeTab}
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-label={TABS.find((t) => t.id === activeTab)?.label}
          variants={pageVariants}
          initial={prefersReduced ? false : "initial"}
          animate={prefersReduced ? undefined : "animate"}
          exit={prefersReduced ? undefined : "exit"}
          transition={pageTransition}
          style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          {page}
        </motion.main>
      </AnimatePresence>

      {/* ── Footer ── */}
      <footer className="app-footer" role="contentinfo">
        <span className="footer-version">v{appVersion || "—"}</span>
        <span className="footer-sep" aria-hidden="true">·</span>
        <span className="footer-name">Ultron Controller</span>
      </footer>

      <Toast toast={toast} />
    </div>
  );
}
