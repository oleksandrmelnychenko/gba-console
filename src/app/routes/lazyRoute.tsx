import { Suspense, type ReactNode } from 'react'

const routeFallback = <div className="console-route-loading">Завантаження</div>

export function lazyRoute(element: ReactNode) {
  return <Suspense fallback={routeFallback}>{element}</Suspense>
}
