import { Component } from "react";

/**
 * ErrorBoundary — catches any render/lifecycle crash in a child component
 * tree and shows a friendly recovery UI instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary page="Dashboard">
 *     <Dashboard />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console so you can see it in Render logs
    console.error(`[ErrorBoundary] Crash in "${this.props.page || "page"}":`, error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { page = "this page", onNavigate } = this.props;

    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}>
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "32px 36px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text1)", marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 24, lineHeight: 1.6 }}>
            {page} ran into an unexpected error. Your data is safe — this is just a display issue.
          </div>

          {/* Show error message in dev, hide in prod */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <div style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 20,
              fontSize: 11,
              fontFamily: "monospace",
              color: "var(--red)",
              textAlign: "left",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {this.state.error.message}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: "9px 20px",
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Try again
            </button>
            {onNavigate && (
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  onNavigate("dashboard");
                }}
                style={{
                  padding: "9px 20px",
                  borderRadius: 10,
                  background: "var(--bg3)",
                  color: "var(--text2)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
