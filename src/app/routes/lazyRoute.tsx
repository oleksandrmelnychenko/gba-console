import { Suspense, type ReactNode } from 'react'
import { AppErrorBoundary } from '../../shared/ui/AppErrorBoundary'
import { OrbSplash } from '../../shared/ui/orb/Orb'

const routeFallback = <OrbSplash label="Завантаження" />

export function lazyRoute(element: ReactNode) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={routeFallback}>{element}</Suspense>
    </AppErrorBoundary>
  )
}
