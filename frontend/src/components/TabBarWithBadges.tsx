import { motion } from "framer-motion";

type TabDef = {
  id: string;
  label: string;
  badge?: number;
  badgeKind?: "default" | "warning" | "danger";
};

type TabBarWithBadgesProps = {
  tabs: TabDef[];
  activeTab: string;
  onChange: (id: string) => void;
};

export function TabBarWithBadges({ tabs, activeTab, onChange }: TabBarWithBadgesProps) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Memory sections">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            className={`tab-btn ${isActive ? "active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="tab-btn-label">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <motion.span
                key={tab.badge}
                className={`tab-badge ${tab.badgeKind ?? "default"}`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {tab.badge}
              </motion.span>
            )}
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
    </div>
  );
}
