import { useCallback } from 'react'
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'

/**
 * A page with unsaved work registers a guard. The guard receives the pending
 * navigation and returns true when it takes over (for example, by showing a
 * confirmation dialog and calling `proceed` later), or false to let it through.
 */
export type NavigationGuard = (proceed: () => void) => boolean

let activeGuard: NavigationGuard | null = null

export function setNavigationGuard(guard: NavigationGuard): () => void {
  activeGuard = guard

  return () => {
    if (activeGuard === guard) {
      activeGuard = null
    }
  }
}

export function runGuardedNavigation(proceed: () => void): void {
  if (activeGuard?.(proceed)) {
    return
  }

  proceed()
}

/** Drop-in replacement for `useNavigate()` in the app shell (menu, header, notifications). */
export function useGuardedNavigate() {
  const navigate = useNavigate()

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      runGuardedNavigation(() => navigate(to, options))
    },
    [navigate],
  )
}
