import { motion } from "framer-motion";
import type { SessionMessage } from "../api/client";

type MessageListProps = {
  messages: SessionMessage[];
};

function roleClass(role: string): string {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "tool") return "tool";
  return "system";
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function MessageList({ messages }: MessageListProps) {
  if (!messages.length) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">💬</span>
        <span className="empty-state-title">No messages</span>
        <span className="empty-state-desc">This session has no recorded messages.</span>
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((message, i) => {
        const visibleContent = message.content_text || message.content || "";
        return (
          <motion.div
            className="message"
            key={message.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
          >
            <div className="message-header">
              <span className={`role-chip ${roleClass(message.role)}`}>
                {message.role}
              </span>
              {message.tool_name ? (
                <span className="badge warning">{message.tool_name}</span>
              ) : null}
              {message.timestamp ? (
                <span className="badge" style={{ marginLeft: "auto" }}>
                  {formatTimestamp(message.timestamp)}
                </span>
              ) : null}
            </div>
            <div className="message-body">
              {visibleContent ? <pre>{visibleContent}</pre> : null}
              {message.reasoning ? (
                <details>
                  <summary>Reasoning</summary>
                  <pre>{message.reasoning}</pre>
                </details>
              ) : null}
              {message.tool_calls ? (
                <details>
                  <summary>Tool calls</summary>
                  <pre>{message.tool_calls}</pre>
                </details>
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
