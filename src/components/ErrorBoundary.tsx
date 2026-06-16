import React, { ReactNode, ErrorInfo } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-space-900 via-space-800 to-space-700 flex items-center justify-center p-4">
          <div className="glass-glow rounded-2xl p-8 border border-neon-red/30 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-neon-red" size={32} />
              <h1 className="text-2xl font-bold text-neon-red">Application Error</h1>
            </div>

            <div className="bg-space-700/50 rounded-lg p-4 mb-6 border border-neon-red/20">
              <p className="text-gray-300 text-sm mb-2">
                <span className="text-neon-cyan font-mono">Error:</span>
              </p>
              <p className="text-red-300 font-mono text-xs break-words">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            {this.state.errorInfo && (
              <details className="mb-6">
                <summary className="text-neon-purple cursor-pointer mb-2">
                  Stack Trace
                </summary>
                <pre className="bg-space-700/50 p-3 rounded text-xs text-gray-400 overflow-auto max-h-48 border border-neon-purple/20">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 rounded-lg font-bold bg-gradient-to-r from-neon-blue to-neon-cyan text-space-900 hover:opacity-90 transition"
            >
              Reload Application
            </button>

            <p className="text-gray-400 text-xs mt-4 text-center">
              The application encountered an unexpected error. Please try reloading. If the problem persists, check your Deriv API credentials.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
