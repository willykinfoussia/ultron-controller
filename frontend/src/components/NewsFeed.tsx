import { useEffect, useState } from "react";
import { getCompanyNews, type CompanyNewsItem } from "../api/client";
import { Spinner } from "./Spinner";

type NewsFeedProps = {
  symbol: string;
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  if (isNaN(diffMs) || diffMs < 0) return iso;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function NewsFeed({ symbol }: NewsFeedProps) {
  const [news, setNews] = useState<CompanyNewsItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCompanyNews(symbol)
      .then((data) => {
        if (!cancelled) {
          setNews(data.news ?? []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="newsfeed-loading">
        <Spinner size="md" />
        <span>Loading news…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="newsfeed-error">
        <p>⚠️ Failed to load news</p>
        <p className="newsfeed-error-detail">{error}</p>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <div className="newsfeed-empty">
        <p>No news available for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="newsfeed">
      {news.map((item, idx) => (
        <a
          key={idx}
          className="newsfeed-card"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="newsfeed-card-header">
            <span className="newsfeed-card-title">{item.title}</span>
            {item.source && (
              <span className="newsfeed-card-source">{item.source}</span>
            )}
          </div>
          {item.summary && (
            <p className="newsfeed-card-summary">{item.summary}</p>
          )}
          <div className="newsfeed-card-footer">
            {item.published_at && (
              <span className="newsfeed-card-time">
                {relativeTime(item.published_at)}
              </span>
            )}
            <span className="newsfeed-card-link">Read more →</span>
          </div>
        </a>
      ))}
    </div>
  );
}
