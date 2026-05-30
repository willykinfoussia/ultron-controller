import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { ovSearch, sessionSearch, type SearchResult } from "../api/client";
import { SkeletonListItem } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

type SearchPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export function SearchPage({ setToast }: SearchPageProps) {
  const prefersReduced = useReducedMotion();

  const [query, setQuery] = useState("");
  const [ovResults, setOvResults] = useState<SearchResult[]>([]);
  const [sessionResults, setSessionResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const [ov, sessions] = await Promise.all([ovSearch(q), sessionSearch(q)]);
      setOvResults(ov.items || []);
      setSessionResults(sessions.items || []);
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const totalResults = ovResults.length + sessionResults.length;
  const motionProps  = prefersReduced ? {} : FADE;
  const motionT      = prefersReduced ? { duration: 0 } : { duration: 0.2 };

  return (
    <div className="page">
      {/* ── Search bar ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Cross Search</span>
          {hasSearched && !loading && (
            <span className="badge">
              {totalResults} result{totalResults !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="toolbar">
            <div className="search-input-wrap">
              <svg
                className="search-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={query}
                placeholder="Search OpenViking and sessions…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch().catch((err: unknown) => setToast(String(err), "error"));
                }}
                aria-label="Search query"
                autoComplete="off"
              />
            </div>
            <button
              className="primary"
              onClick={() => runSearch().catch((e) => setToast(String(e), "error"))}
              disabled={loading || !query.trim()}
              aria-label="Run search"
            >
              {loading ? <Spinner size="sm" /> : "Search"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Results area ── */}
      <AnimatePresence mode="wait" initial={false}>
        {!hasSearched ? (
          <motion.div key="prompt" {...motionProps} transition={motionT}>
            <div className="empty-state">
              <span className="empty-state-icon">🔍</span>
              <span className="empty-state-title">Search across all data</span>
              <span className="empty-state-desc">
                Enter a query above to search OpenViking entries and session messages simultaneously.
              </span>
            </div>
          </motion.div>
        ) : loading ? (
          <motion.div key="skel-results" {...motionProps} transition={motionT}>
            <div className="split-2">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">OpenViking</span>
                </div>
                <div className="card-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <SkeletonListItem key={i} titleWidth="70%" metaWidth="95%" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Sessions FTS</span>
                </div>
                <div className="card-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <SkeletonListItem key={i} titleWidth="55%" metaWidth="85%" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" {...motionProps} transition={motionT}>
            <div className="split-2">
              {/* OpenViking results */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">OpenViking</span>
                  <span className="badge">{ovResults.length}</span>
                </div>
                <div className="card-body">
                  {ovResults.length === 0 ? (
                    <div className="empty-state" style={{ padding: "16px 0" }}>
                      <span className="empty-state-desc">No results in OpenViking</span>
                    </div>
                  ) : (
                    <div className="search-results">
                      {ovResults.map((item, index) => (
                        <motion.div
                          className="list-item"
                          key={`${item.uri ?? "ov"}-${index}`}
                          initial={prefersReduced ? {} : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.18 }}
                        >
                          <span className="list-item-name mono" style={{ fontSize: 12 }}>
                            {item.uri || "unknown-uri"}
                          </span>
                          {item.content ? (
                            <span className="list-item-meta">
                              {item.content.slice(0, 120)}{item.content.length > 120 ? "…" : ""}
                            </span>
                          ) : null}
                          {item.score != null ? (
                            <span className="badge" style={{ marginTop: 2, alignSelf: "flex-start" }}>
                              score {item.score.toFixed(3)}
                            </span>
                          ) : null}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Session FTS results */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Sessions FTS</span>
                  <span className="badge">{sessionResults.length}</span>
                </div>
                <div className="card-body">
                  {sessionResults.length === 0 ? (
                    <div className="empty-state" style={{ padding: "16px 0" }}>
                      <span className="empty-state-desc">No results in sessions</span>
                    </div>
                  ) : (
                    <div className="search-results">
                      {sessionResults.map((item, index) => (
                        <motion.div
                          className="list-item"
                          key={`${item.id ?? "session"}-${index}`}
                          initial={prefersReduced ? {} : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.18 }}
                        >
                          <span className="list-item-name">{item.title || item.session_id || "—"}</span>
                          {item.content ? (
                            <span className="list-item-meta">
                              {item.content.slice(0, 120)}{item.content.length > 120 ? "…" : ""}
                            </span>
                          ) : null}
                          <div className="list-item-row" style={{ marginTop: 2 }}>
                            {item.role ? <span className={`role-chip ${item.role}`}>{item.role}</span> : null}
                            {item.timestamp ? <span className="badge">{item.timestamp}</span> : null}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
