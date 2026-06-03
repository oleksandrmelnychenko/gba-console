import { useEffect, useMemo, useReducer, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getNavigation } from './api/navigationApi'
import { NavigationContext, type NavigationContextValue } from './NavigationContext'
import {
  findNavigationMatch,
  getModuleKey,
  getNavigationNodePath,
  isNavigationNodeActive,
  normalizeNavigation,
} from './navigationUtils'
import type { NavigationModule } from './types'

type NavigationLocationState = {
  backgroundLocation?: {
    pathname: string
    search: string
  }
}

type NavigationState = {
  error: Error | null
  errorSessionKey: string | null
  loadedSessionKey: string | null
  modules: NavigationModule[]
  selectedModuleKey: string | null
}

type NavigationAction =
  | { type: 'menuLoaded'; modules: NavigationModule[]; sessionKey: string }
  | { type: 'menuFailed'; error: Error; sessionKey: string }
  | { type: 'moduleSelected'; moduleKey: string }

const initialNavigationState: NavigationState = {
  error: null,
  errorSessionKey: null,
  loadedSessionKey: null,
  modules: [],
  selectedModuleKey: null,
}

function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'menuLoaded':
      return {
        ...state,
        error: null,
        errorSessionKey: null,
        loadedSessionKey: action.sessionKey,
        modules: action.modules,
      }
    case 'menuFailed':
      return {
        ...state,
        error: action.error,
        errorSessionKey: action.sessionKey,
        loadedSessionKey: action.sessionKey,
        modules: [],
      }
    case 'moduleSelected':
      return {
        ...state,
        selectedModuleKey: action.moduleKey,
      }
    default:
      return state
  }
}

export function NavigationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, session } = useAuth()
  const routerLocation = useLocation()
  const [state, dispatch] = useReducer(navigationReducer, initialNavigationState)
  const sessionKey = session?.csrfToken || null
  const canLoadMenu = isAuthenticated && Boolean(sessionKey)

  useEffect(() => {
    if (!canLoadMenu || !sessionKey) {
      return undefined
    }

    let cancelled = false

    getNavigation()
      .then((items) => {
        if (!cancelled) {
          dispatch({
            type: 'menuLoaded',
            modules: normalizeNavigation(items),
            sessionKey,
          })
        }
      })
      .catch((menuError: Error) => {
        if (!cancelled) {
          dispatch({
            type: 'menuFailed',
            error: menuError,
            sessionKey,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [canLoadMenu, sessionKey])

  const isMenuReady = canLoadMenu && state.loadedSessionKey === sessionKey
  const currentError = state.errorSessionKey === sessionKey ? state.error : null
  const availableModules = useMemo(() => (isMenuReady ? state.modules : []), [isMenuReady, state.modules])
  const routerLocationState = routerLocation.state as NavigationLocationState | null
  const navigationLocation = routerLocationState?.backgroundLocation || routerLocation
  const routerTarget = `${navigationLocation.pathname}${navigationLocation.search}`
  const activeMatch = useMemo(
    () => findNavigationMatch(availableModules, routerTarget),
    [availableModules, routerTarget],
  )

  const selectedModule = useMemo(() => {
    if (activeMatch?.module) {
      return activeMatch.module
    }

    if (state.selectedModuleKey) {
      const selected = availableModules.find((module) => getModuleKey(module) === state.selectedModuleKey)

      if (selected) {
        return selected
      }
    }

    return null
  }, [activeMatch, availableModules, state.selectedModuleKey])

  const value = useMemo<NavigationContextValue>(
    () => ({
      error: currentError,
      isLoading: canLoadMenu && !isMenuReady && !currentError,
      modules: availableModules,
      selectedModule,
      selectedNode: activeMatch?.node || null,
      getNodePath: getNavigationNodePath,
      isNodeActive: (node) => isNavigationNodeActive(node, routerTarget),
      selectModule: (module) => dispatch({ type: 'moduleSelected', moduleKey: getModuleKey(module) }),
    }),
    [activeMatch, availableModules, canLoadMenu, currentError, isMenuReady, routerTarget, selectedModule],
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}
