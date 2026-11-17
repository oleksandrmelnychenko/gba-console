import { matchPath } from 'react-router-dom'
import { consoleRoutes } from './consoleRoutes'
import { overlayConsoleRoutes } from './overlayConsoleRoutes'

const KNOWN_PATTERNS = [...consoleRoutes, ...overlayConsoleRoutes].map((route) => route.path)

/** True when a console page is registered for the path; anything else is "not found", not "forbidden". */
export function isKnownConsolePath(pathname: string): boolean {
  return KNOWN_PATTERNS.some((pattern) => pattern && matchPath({ end: true, path: pattern }, pathname) !== null)
}
