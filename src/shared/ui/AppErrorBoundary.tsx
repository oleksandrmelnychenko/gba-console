import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react'

type AppErrorBoundaryState = {
  error: Error | null
}

/* Deliberately Mantine-free: the fallback must render even when providers
   above it are the thing that crashed. */
export class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="app-error-boundary" role="alert">
        <div className="app-error-boundary__card">
          <div className="app-error-boundary__title">Щось пішло не так</div>
          <div className="app-error-boundary__message">{this.state.error.message}</div>
          <div className="app-error-boundary__actions">
            <button className="app-error-boundary__button" type="button" onClick={this.handleRetry}>
              Спробувати ще раз
            </button>
            <button
              className="app-error-boundary__button is-primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Перезавантажити сторінку
            </button>
          </div>
        </div>
      </div>
    )
  }
}
