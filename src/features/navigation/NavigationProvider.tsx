import { useEffect, useMemo, useReducer, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
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
  errorPermissionSetKey: string | null
  errorSessionKey: string | null
  loadedPermissionSetKey: string | null
  loadedSessionKey: string | null
  modules: NavigationModule[]
  selectedModuleKey: string | null
}

type NavigationAction =
  | { type: 'menuLoaded'; modules: NavigationModule[]; permissionSetKey: string; sessionKey: string }
  | { type: 'menuFailed'; error: Error; permissionSetKey: string; sessionKey: string }
  | { type: 'moduleSelected'; moduleKey: string }

const initialNavigationState: NavigationState = {
  error: null,
  errorPermissionSetKey: null,
  errorSessionKey: null,
  loadedPermissionSetKey: null,
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
        errorPermissionSetKey: null,
        errorSessionKey: null,
        loadedPermissionSetKey: action.permissionSetKey,
        loadedSessionKey: action.sessionKey,
        modules: action.modules,
      }
    case 'menuFailed':
      return {
        ...state,
        error: action.error,
        errorPermissionSetKey: action.permissionSetKey,
        errorSessionKey: action.sessionKey,
        loadedPermissionSetKey: action.permissionSetKey,
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
  const {
    hasPermission,
    isAuthenticated,
    isPermissionsLoading,
    permissions,
    session,
  } = useAuth()
  const routerLocation = useLocation()
  const [state, dispatch] = useReducer(navigationReducer, initialNavigationState)
  const sessionKey = session?.csrfToken || null
  const permissionSetKey = permissions.join('\u001f')
  const canLoadMenu = isAuthenticated && Boolean(sessionKey)
  const canViewVehicleRegistry = hasPermission(
    PermissionKeys.SystemPages.VehicleRegistry.View,
  )

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
            modules: normalizeNavigation(items, { includeVehicleRegistry: canViewVehicleRegistry }),
            permissionSetKey,
            sessionKey,
          })
        }
      })
      .catch((menuError: Error) => {
        if (!cancelled) {
          dispatch({
            type: 'menuFailed',
            error: menuError,
            permissionSetKey,
            sessionKey,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [canLoadMenu, canViewVehicleRegistry, permissionSetKey, sessionKey])

  const isMenuReady = canLoadMenu
    && state.loadedSessionKey === sessionKey
    && state.loadedPermissionSetKey === permissionSetKey
  const currentError = state.errorSessionKey === sessionKey
    && state.errorPermissionSetKey === permissionSetKey
    ? state.error
    : null
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
      isLoading: isPermissionsLoading
        || (canLoadMenu && !isMenuReady && !currentError),
      modules: availableModules,
      selectedModule,
      selectedNode: activeMatch?.node || null,
      getNodePath: getNavigationNodePath,
      isNodeActive: (node) => isNavigationNodeActive(node, routerTarget),
      selectModule: (module) => dispatch({ type: 'moduleSelected', moduleKey: getModuleKey(module) }),
    }),
    [activeMatch, availableModules, canLoadMenu, currentError, isMenuReady, isPermissionsLoading, routerTarget, selectedModule],
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}
