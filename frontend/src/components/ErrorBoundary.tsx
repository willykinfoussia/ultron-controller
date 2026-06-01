import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string | null }) {
    this.setState({ errorInfo: info.componentStack ?? "" });
    console.error("[ErrorBoundary] Caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", padding: 32,
          background: "var(--surface-1)", color: "var(--text)",
          fontFamily: "var(--font)", gap: 16,
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h2>
          <pre style={{
            maxWidth: "80vw", overflow: "auto", padding: 16,
            background: "var(--surface-2)", borderRadius: 8,
            fontSize: 12, color: "var(--text-2)", whiteSpace: "pre-wrap",
          }}>
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          {this.state.errorInfo && (
            <details style={{ maxWidth: "80vw", width: "100%" }}>
              <summary style={{ cursor: "pointer", color: "var(--text-3)", fontSize: 12 }}>
                Component stack
              </summary>
              <pre style={{
                overflow: "auto", padding: 12,
                background: "var(--surface-2)", borderRadius: 8,
                fontSize: 11, color: "var(--text-3)", whiteSpace: "pre-wrap",
              }}>
                {this.state.errorInfo}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: "8px 24px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--primary)", color: "#fff", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
