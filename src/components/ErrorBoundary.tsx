import React, { Component, ReactNode } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { NeonButton } from './ui/NeonButton';
import { Copy, RotateCcw } from 'lucide-react';
import { NeonButton } from './ui/NeonButton';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  compact?: boolean;
  onReset?: () => void;
  compact?: boolean;
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
    this.props.onReset?.();
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleCopyStack = () => {
    const stackTrace = this.state.error?.stack || 'No stack trace available';
    navigator.clipboard.writeText(stackTrace);
  };
  handleCopyStack = () => {
    const stackTrace = this.state.error?.stack || 'No stack trace available';
    navigator.clipboard.writeText(stackTrace);
  };
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Compact error card for debugger
      if (this.props.compact) {
        return (
          <div className="p-4 bg-danger/20 border border-danger/50 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-danger font-medium">Debugger Error</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <NeonButton
                variant="danger"
                size="sm"
                onClick={this.handleReset}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </NeonButton>
              <NeonButton
                variant="ghost"
                size="sm"
                onClick={this.handleCopyStack}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy Stack
              </NeonButton>
            </div>
          </div>
        );
      }
      // Compact error card for debugger
      if (this.props.compact) {
        return (
          <div className="p-4 bg-danger/20 border border-danger/50 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-danger font-medium">Debugger Error</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <NeonButton
                variant="danger"
                size="sm"
                onClick={this.handleReset}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </NeonButton>
              <NeonButton
                variant="ghost"
                size="sm"
                onClick={this.handleCopyStack}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy Stack
              </NeonButton>
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
          <div className="bg-panel border border-danger/50 rounded-lg p-8 max-w-2xl w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-slate-200 mb-2">Something went wrong</h1>
              <p className="text-slate-400">
                The application encountered an unexpected error. This has been logged for debugging.
              </p>
            </div>

            <div className="bg-danger/20 border border-danger/50 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-danger mb-2">Error Details:</h2>
              <p className="text-danger font-mono text-sm">
                {this.state.error?.message || 'Unknown error'}
              </p>
              
              {this.state.errorInfo?.componentStack && (
                <details className="mt-3">
                  <summary className="text-danger cursor-pointer hover:text-danger/80">
                    Component Stack (click to expand)
                  </summary>
                  <pre className="text-xs text-danger mt-2 overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex justify-center space-x-4">
              <NeonButton
                variant="primary"
                variant="primary"
                onClick={this.handleReset}
                Try Again
              </NeonButton>
              </NeonButton>
              <NeonButton
                variant="secondary"
                onClick={this.handleCopyStack}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Stack
              </NeonButton>
              <NeonButton
                variant="ghost"
                onClick={this.handleCopyStack}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Stack
              </NeonButton>
              <NeonButton
                variant="ghost"
                onClick={() => window.location.reload()}
                Reload Page
              </NeonButton>
              </NeonButton>

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