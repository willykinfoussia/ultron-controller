import { useState } from "react";

import { ovSearch, sessionSearch, type SearchResult } from "../api/client";

type SearchPageProps = {
  setToast: (message: string) => void;
};

export function SearchPage({ setToast }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [ovResults, setOvResults] = useState<SearchResult[]>([]);
  const [sessionResults, setSessionResults] = useState<SearchResult[]>([]);

  async function runSearch() {
    if (!query.trim()) {
      return;
    }
    const [ov, sessions] = await Promise.all([ovSearch(query), sessionSearch(query)]);
    setOvResults(ov.items || []);
    setSessionResults(sessions.items || []);
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <strong>Cross Search</strong>
        </div>
        <div className="card-content">
          <div className="toolbar">
            <input
              value={query}
              placeholder="Search OpenViking and sessions..."
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  runSearch().catch((error: unknown) => setToast(String(error)));
                }
              }}
            />
            <button className="primary" onClick={() => runSearch().catch((e) => setToast(String(e)))}>
              Search
            </button>
          </div>
        </div>
      </div>

      <div className="split-2">
        <div className="card">
          <div className="card-header">
            <strong>OpenViking ({ovResults.length})</strong>
          </div>
          <div className="card-content search-results">
            {ovResults.map((item, index) => (
              <div className="list-item" key={`${item.uri ?? "ov"}-${index}`}>
                <div>{item.uri || "unknown-uri"}</div>
                <div className="muted">{item.content || ""}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <strong>Sessions FTS ({sessionResults.length})</strong>
          </div>
          <div className="card-content search-results">
            {sessionResults.map((item, index) => (
              <div className="list-item" key={`${item.id ?? "session"}-${index}`}>
                <div>{item.title || item.session_id}</div>
                <div className="muted">{item.content || ""}</div>
                <div className="toolbar">
                  <span className="badge">{item.role || "unknown"}</span>
                  <span className="badge">{item.timestamp || ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
