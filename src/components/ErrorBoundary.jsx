import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Mudra App Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-mudra-bg flex items-center justify-center p-4">
          <div className="card max-w-lg w-full text-center p-8 border-red-500/40">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-xs text-mudra-muted mb-4">
              {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary text-xs px-4 py-2 font-bold"
              >
                Reload Page 🔄
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="btn-outline text-xs px-4 py-2"
              >
                Go to Home 🏠
              </button>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details className="mt-4 text-left text-[11px] text-mudra-muted bg-black/40 p-3 rounded overflow-auto max-h-48 font-mono">
                <summary className="cursor-pointer text-mudra-accent">Stack Trace</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error?.stack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
