import type { ToastKind } from "../components/Toast";

type AccentId = "indigo" | "blue" | "cyan" | "emerald" | "rose" | "amber";
type Theme = "dark" | "light";

const ACCENTS: Record<AccentId, { color: string; label: string }> = {
  indigo:  { color: "#6c6af6", label: "Indigo" },
  blue:    { color: "#3b82f6", label: "Blue" },
  cyan:    { color: "#06b6d4", label: "Cyan" },
  emerald: { color: "#10b981", label: "Emerald" },
  rose:    { color: "#f43f5e", label: "Rose" },
  amber:   { color: "#f59e0b", label: "Amber" },
};

const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

type SettingsPageProps = {
  theme: Theme;
  accent: AccentId;
  onThemeChange: (t: Theme) => void;
  onAccentChange: (a: AccentId) => void;
  setToast: (message: string, kind?: ToastKind) => void;
  appVersion: string;
};

export function SettingsPage({
  theme,
  accent,
  onThemeChange,
  onAccentChange,
  setToast: _setToast,
  appVersion,
}: SettingsPageProps) {
  void _setToast;

  return (
    <div className="page settings-page">
      {/* ── Appearance ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Appearance</span>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>

          {/* Theme */}
          <div>
            <p className="section-label">Theme</p>
            <div className="settings-row">
              <div
                className={`settings-theme-btn ${theme === "dark" ? "active" : ""}`}
                onClick={() => onThemeChange("dark")}
                role="button"
                aria-pressed={theme === "dark"}
                tabIndex={0}
              >
                <span className="settings-theme-icon">🌙</span>
                <div>
                  <div className="settings-theme-name">Dark</div>
                  <div className="settings-theme-desc">Low-light mode</div>
                </div>
              </div>
              <div
                className={`settings-theme-btn ${theme === "light" ? "active" : ""}`}
                onClick={() => onThemeChange("light")}
                role="button"
                aria-pressed={theme === "light"}
                tabIndex={0}
              >
                <span className="settings-theme-icon">☀️</span>
                <div>
                  <div className="settings-theme-name">Light</div>
                  <div className="settings-theme-desc">Bright mode</div>
                </div>
              </div>
            </div>
          </div>

          {/* Accent colour */}
          <div>
            <p className="section-label">Accent colour</p>
            <div className="settings-accent-grid">
              {ACCENT_IDS.map((id) => (
                <button
                  key={id}
                  className={`settings-accent-btn ${accent === id ? "active" : ""}`}
                  style={{ "--swatch": ACCENTS[id].color } as React.CSSProperties}
                  onClick={() => onAccentChange(id)}
                  aria-label={ACCENTS[id].label}
                  aria-pressed={accent === id}
                >
                  <span className="settings-accent-swatch" />
                  <span className="settings-accent-label">{ACCENTS[id].label}</span>
                  {accent === id && <span className="settings-accent-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── About ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">About</span>
        </div>
        <div className="card-body">
          <div className="settings-about-row">
            <span className="settings-about-label">Application</span>
            <span className="settings-about-value">Ultron Controller</span>
          </div>
          <div className="settings-about-row">
            <span className="settings-about-label">Version</span>
            <span className="settings-about-value mono">{appVersion || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
