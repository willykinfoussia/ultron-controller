import type { SessionMessage } from "../api/client";

type MessageListProps = {
  messages: SessionMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  if (!messages.length) {
    return <div className="muted">No messages in this session.</div>;
  }

  return (
    <div className="messages">
      {messages.map((message) => {
        const visibleContent = message.content_text || message.content || "";
        return (
          <div className="message" key={message.id}>
            <div className="toolbar">
              <strong>{message.role}</strong>
              {message.timestamp ? <span className="badge">{message.timestamp}</span> : null}
              {message.tool_name ? <span className="badge">tool: {message.tool_name}</span> : null}
            </div>
            <pre>{visibleContent}</pre>
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
        );
      })}
    </div>
  );
}
