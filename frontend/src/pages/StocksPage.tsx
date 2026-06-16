import { useState } from "react";
import { NewsFeed } from "../components/NewsFeed";
import { EmbeddedAnalysis } from "../components/EmbeddedAnalysis";

type StocksPageProps = {
  setToast: (message: string, kind?: "info" | "success" | "error" | "warning") => void;
};

type StocksTab = "analysis" | "news";

export function StocksPage({ setToast }: StocksPageProps) {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [activeTab, setActiveTab] = useState<StocksTab>("news");

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim().toUpperCase();
    if (!trimmed) return;
    setSymbol(trimmed);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Stocks</h1>
        <form className="stocks-search" onSubmit={handleSymbolSubmit}>
          <input
            className="stocks-search-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter symbol (e.g. AAPL)"
            aria-label="Stock symbol"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      <div className="stocks-symbol-header">
        <h2>{symbol}</h2>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-bar-btn ${activeTab === "news" ? "active" : ""}`}
          onClick={() => setActiveTab("news")}
        >
          News
        </button>
        <button
          className={`tab-bar-btn ${activeTab === "analysis" ? "active" : ""}`}
          onClick={() => setActiveTab("analysis")}
        >
          Analysis
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "news" && <NewsFeed symbol={symbol} />}
        {activeTab === "analysis" && <EmbeddedAnalysis symbol={symbol} />}
      </div>
    </div>
  );
}
