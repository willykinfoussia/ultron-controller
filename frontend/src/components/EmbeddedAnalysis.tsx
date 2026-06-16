import { useCallback, useState } from "react";
import {
  getAnalysisMethods,
  runFullAnalysis,
  type AnalysisMethod,
  type AnalysisResult,
} from "../api/client";
import { Spinner } from "./Spinner";

type EmbeddedAnalysisProps = {
  symbol: string;
};

function SignalBadge({ signal }: { signal?: string | null }) {
  if (!signal) return null;
  const cls = `analysis-signal analysis-signal--${signal.toLowerCase()}`;
  return <span className={cls}>{signal.toUpperCase()}</span>;
}

function ConfidenceMeter({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="analysis-confidence">
      <div className="analysis-confidence-bar">
        <div
          className="analysis-confidence-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="analysis-confidence-label">{pct}%</span>
    </div>
  );
}

function AnalysisCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="analysis-card">
      <div className="analysis-card-header">
        <span className="analysis-card-name">{result.method_name}</span>
        <SignalBadge signal={result.signal} />
      </div>
      <ConfidenceMeter value={result.confidence} />
      {result.summary && (
        <p className="analysis-card-summary">{result.summary}</p>
      )}
    </div>
  );
}

export function EmbeddedAnalysis({ symbol }: EmbeddedAnalysisProps) {
  const [methods, setMethods] = useState<AnalysisMethod[] | null>(null);
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  // Load methods on mount
  useState(() => {
    getAnalysisMethods(symbol)
      .then((data) => setMethods(data.methods ?? []))
      .catch(() => setMethods([])); // non-fatal; button still works
  });

  const handleRunAll = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRunMessage(null);
    setResults(null);
    try {
      const data = await runFullAnalysis(symbol);
      setResults(data.results ?? []);
      if (data.message) setRunMessage(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [symbol]);

  return (
    <div className="embedded-analysis">
      <div className="embedded-analysis-header">
        <h3>Analysis — {symbol}</h3>
        <button
          className="btn btn-primary"
          onClick={handleRunAll}
          disabled={running}
        >
          {running ? <Spinner size="sm" /> : "Run All Analysis"}
        </button>
      </div>

      {methods && methods.length > 0 && (
        <div className="embedded-analysis-methods">
          <p className="embedded-analysis-methods-title">Available methods:</p>
          <ul className="embedded-analysis-methods-list">
            {methods.map((m) => (
              <li key={m.id}>
                <strong>{m.name}</strong>
                {m.description && <span> — {m.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="embedded-analysis-error">
          <p>⚠️ Analysis unavailable</p>
          <p className="embedded-analysis-error-detail">{error}</p>
          <p className="embedded-analysis-error-hint">
            The analysis backend endpoint is not yet wired. Results will appear once the integration is complete.
          </p>
        </div>
      )}

      {runMessage && !error && (
        <p className="embedded-analysis-message">{runMessage}</p>
      )}

      {results && results.length > 0 && (
        <div className="embedded-analysis-results">
          {results.map((r, idx) => (
            <AnalysisCard key={idx} result={r} />
          ))}
        </div>
      )}

      {results && results.length === 0 && !error && (
        <p className="embedded-analysis-empty">No analysis results returned.</p>
      )}
    </div>
  );
}
