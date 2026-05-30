import { useEffect, useState } from "react";

import { listSessions, sessionMessages, type SessionMessage, type SessionSummary } from "../api/client";
import { MessageList } from "../components/MessageList";

type SessionsPageProps = {
  setToast: (message: string) => void;
};

export function SessionsPage({ setToast }: SessionsPageProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);

  useEffect(() => {
    listSessions(120)
      .then((result) => setSessions(result.sessions))
      .catch((error: unknown) => setToast(String(error)));
  }, []);

  async function openSession(session: SessionSummary) {
    setSelected(session);
    const result = await sessionMessages(session.id);
    setMessages(result.messages);
  }

  return (
    <div className="page split-2">
      <div className="card">
        <div className="card-header">
          <strong>Sessions ({sessions.length})</strong>
        </div>
        <div className="card-content list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`list-item ${selected?.id === session.id ? "active" : ""}`}
              onClick={() => openSession(session).catch((error: unknown) => setToast(String(error)))}
            >
              <div>{session.title || session.id}</div>
              <div className="muted">{session.model || "unknown-model"}</div>
              <div className="toolbar">
                <span className="badge">{session.message_count ?? 0} msgs</span>
                <span className="badge">{session.tool_call_count ?? 0} tools</span>
                <span className="badge">${(session.estimated_cost_usd ?? 0).toFixed(4)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div>Session Detail</div>
            <div className="muted">{selected?.id || "Select a session"}</div>
          </div>
        </div>
        <div className="card-content">
          <MessageList messages={messages} />
        </div>
      </div>
    </div>
  );
}
