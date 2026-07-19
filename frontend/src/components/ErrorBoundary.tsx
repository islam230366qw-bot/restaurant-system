import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">حدث خطأ غير متوقع</h1>
            <p className="text-gray-500 mb-6">نأسف للإزعاج. يرجى تحديث الصفحة أو المحاولة لاحقًا.</p>
            <button onClick={() => window.location.reload()} className="btn-primary px-6 py-3">
              تحديث الصفحة
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
