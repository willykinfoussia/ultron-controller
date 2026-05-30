import { useMemo, useState } from "react";

import { Toast } from "./components/Toast";
import { MemoryPage } from "./pages/MemoryPage";
import { OpenVikingPage } from "./pages/OpenVikingPage";
import { SearchPage } from "./pages/SearchPage";
import { SessionsPage } from "./pages/SessionsPage";

type TabId = "openviking" | "memory" | "sessions" | "search";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "openviking", label: "OpenViking" },
  { id: "memory", label: "Hermes Memory" },
  { id: "sessions", label: "Sessions" },
  { id: "search", label: "Search" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("openviking");
  const [toast, setToast] = useState<string | null>(null);

  const page = useMemo(() => {
    const api = { setToast: (message: string) => setToast(message) };
    if (activeTab === "openviking") return <OpenVikingPage {...api} />;
    if (activeTab === "memory") return <MemoryPage {...api} />;
    if (activeTab === "sessions") return <SessionsPage {...api} />;
    return <SearchPage {...api} />;
  }, [activeTab]);

  return (
    <div className="layout">
      <header className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </header>
      {page}
      <Toast message={toast} />
    </div>
  );
}
