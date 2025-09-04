import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-lg p-8 max-w-2xl w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h1>
              <p className="text-gray-600">
                The application encountered an unexpected error. This has been logged for debugging.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-red-800 mb-2">Error Details:</h2>
              <p className="text-red-700 font-mono text-sm">
                {this.state.error?.message || 'Unknown error'}
              </p>
              
              {this.state.errorInfo?.componentStack && (
                <details className="mt-3">
                  <summary className="text-red-600 cursor-pointer hover:text-red-800">
                    Component Stack (click to expand)
                  </summary>
                  <pre className="text-xs text-red-600 mt-2 overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Reload Page
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>If this problem persists, try refreshing the page or clearing your browser cache.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;