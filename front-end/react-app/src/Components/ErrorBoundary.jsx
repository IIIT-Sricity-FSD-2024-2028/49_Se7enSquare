import React, { Component } from 'react';

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in child component tree, logs them,
 * and renders a resilient fallback UI instead of unmounting the whole tree.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-0, #0a0a0f)',
            color: 'var(--text-1, #f3f4f6)',
            padding: '24px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-1, #12131a)',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              borderRadius: '16px',
              padding: '36px 32px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                fontSize: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '10px',
                color: '#fff',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-3, #9ca3af)',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              An unexpected error occurred while rendering this view. Your session and data remain safe.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#f87171',
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  marginBottom: '24px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
