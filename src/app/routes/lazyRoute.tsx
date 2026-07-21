import { Suspense, type ReactNode } from 'react'
import { AppErrorBoundary } from '../../shared/ui/AppErrorBoundary'

const routeFallback = <div className="console-route-loading">Завантаження</div>

export function lazyRoute(element: ReactNode) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={routeFallback}>{element}</Suspense>
    </AppErrorBoundary>
  )
}
