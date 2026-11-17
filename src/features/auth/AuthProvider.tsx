import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { notifications } from '@mantine/notifications'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getEffectivePermissionKeys,
  hasPermission as checkPermission,
  type RuntimePermissionKeys,
} from '../../shared/auth/permissions'
import { AUTH_PERMISSIONS_CHANGED_EVENT } from '../../shared/auth/permissionEvents'
import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  clearSession,
  isSessionStorageEvent,
  readSession,
  saveSession,
} from '../../shared/auth/session'
import { startSessionRefreshScheduler } from '../../shared/api/sessionRefreshScheduler'
import { getCurrentUserProfile, getServerSession, signIn, signOut } from './api/authApi'
import { getMyPermissions } from './api/permissionsApi'
import {
  consumeAuthReturnPath,
  markExplicitSignOut,
  rememberAuthReturnPath,
} from './authReturnPath'
import { AuthContext } from './AuthContext'
import type { AuthContextValue, AuthSession } from './types'

type RefreshPermissionsOptions = {
  blocking?: boolean
  clearOnError?: boolean
}

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const [isLoading, setLoading] = useState(true)
  const [runtimePermissionKeys, setRuntimePermissionKeys] = useState<RuntimePermissionKeys>(null)
  const [isPermissionsLoading, setPermissionsLoading] = useState(false)
  const permissionRequestRef = useRef(0)
  // Set while the user signs out on purpose: late 401s from requests still in flight must not
  // remember the page as a return path for the next, unrelated login.
  const explicitLogoutRef = useRef(false)

  const syncSession = useCallback(() => {
    setSession(readSession())
  }, [])

  const refreshPermissions = useCallback(async ({
    blocking = false,
    clearOnError = false,
  }: RefreshPermissionsOptions = {}) => {
    const requestId = permissionRequestRef.current + 1
    permissionRequestRef.current = requestId

    if (blocking) {
      setPermissionsLoading(true)
    }

    try {
      const myPermissions = await getMyPermissions()

      if (permissionRequestRef.current === requestId) {
        setRuntimePermissionKeys(myPermissions.permissionKeys)
      }
    } catch {
      if (clearOnError && permissionRequestRef.current === requestId) {
        setRuntimePermissionKeys(null)
      }
    } finally {
      if (permissionRequestRef.current === requestId) {
        setPermissionsLoading(false)
      }
    }
  }, [])

  const logout = useCallback(async () => {
    explicitLogoutRef.current = true

    try {
      await signOut()
    } catch (error) {
      explicitLogoutRef.current = false
      notifications.show({
        color: 'red',
        message: error instanceof Error
          ? error.message
          : 'Не вдалося вийти. Спробуйте ще раз.',
      })
      return
    }

    // Also stops pages reloaded by browser Back from becoming the next login's landing page.
    markExplicitSignOut()
    // signOut clears storage while holding the refresh/logout lock; repeat locally so the
    // provider also remains correct if the transport implementation is replaced or mocked.
    clearSession()
    permissionRequestRef.current += 1
    setSession(null)
    setRuntimePermissionKeys(null)
    setPermissionsLoading(false)
    navigate('/login', { replace: true })
  }, [navigate])
  const logoutAfterUnauthorized = useCallback(() => {
    if (!explicitLogoutRef.current) {
      const lostSession = readSession()
      rememberAuthReturnPath(location, lostSession?.userNetUid || lostSession?.user?.NetUid)
    }

    clearSession()
    permissionRequestRef.current += 1
    setSession(null)
    setRuntimePermissionKeys(null)
    setPermissionsLoading(false)
    navigate('/login', { replace: true })
  }, [location, navigate])
  const syncSessionRef = useRef(syncSession)
  const logoutRef = useRef(logout)
  const unauthorizedLogoutRef = useRef(logoutAfterUnauthorized)

  useEffect(() => {
    syncSessionRef.current = syncSession
    logoutRef.current = logout
    unauthorizedLogoutRef.current = logoutAfterUnauthorized
  }, [logout, logoutAfterUnauthorized, syncSession])

  const enrichSession = useCallback(async (baseSession: AuthSession): Promise<AuthSession> => {
    saveSession(baseSession)
    setSession(baseSession)

    const [user] = await Promise.all([
      getCurrentUserProfile(baseSession),
      refreshPermissions({ blocking: true, clearOnError: true }),
    ])
    const latestExpiry = readSession()?.accessTokenExpiresAt ?? baseSession.accessTokenExpiresAt
    const nextSession = user
      ? {
          ...baseSession,
          accessTokenExpiresAt: latestExpiry,
          user,
          userNetUid: baseSession.userNetUid || user.NetUid,
        }
      : { ...baseSession, accessTokenExpiresAt: latestExpiry }

    saveSession(nextSession)
    setSession(nextSession)

    return nextSession
  }, [refreshPermissions])

  useEffect(() => startSessionRefreshScheduler(), [])

  useEffect(() => {
    const handleSessionChanged = () => syncSessionRef.current()
    const handleUnauthorized = () => unauthorizedLogoutRef.current()
    // Sign-out or sign-in in another tab changes localStorage; follow it here.
    const handleStorage = (event: StorageEvent) => {
      if (isSessionStorageEvent(event)) syncSessionRef.current()
    }

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged)
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged)
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    const refreshCurrentPermissions = () => {
      if (readSession()?.csrfToken) {
        void refreshPermissions()
      }
    }

    window.addEventListener(
      AUTH_PERMISSIONS_CHANGED_EVENT,
      refreshCurrentPermissions,
    )
    window.addEventListener('focus', refreshCurrentPermissions)

    return () => {
      window.removeEventListener(
        AUTH_PERMISSIONS_CHANGED_EVENT,
        refreshCurrentPermissions,
      )
      window.removeEventListener('focus', refreshCurrentPermissions)
    }
  }, [refreshPermissions])

  useEffect(() => {
    let cancelled = false

    async function restoreServerSession() {
      setLoading(true)

      try {
        const serverSession = await getServerSession()

        if (cancelled) {
          return
        }

        if (serverSession) {
          await enrichSession(serverSession)
        } else {
          clearSession()
          permissionRequestRef.current += 1
          setSession(null)
          setRuntimePermissionKeys(null)
          setPermissionsLoading(false)
        }
      } catch {
        if (!cancelled) {
          clearSession()
          permissionRequestRef.current += 1
          setSession(null)
          setRuntimePermissionKeys(null)
          setPermissionsLoading(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void restoreServerSession()

    return () => {
      cancelled = true
    }
  }, [enrichSession])

  const permissions = useMemo(
    () => getEffectivePermissionKeys(runtimePermissionKeys),
    [runtimePermissionKeys],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session?.csrfToken),
      isLoading,
      isPermissionsLoading,
      permissions,
      hasPermission: (permissionKey) => checkPermission(
        permissionKey,
        runtimePermissionKeys,
      ),
      login: async (username, password) => {
        setLoading(true)

        try {
          const nextSession = await enrichSession(await signIn(username, password))
          explicitLogoutRef.current = false
          setSession(nextSession)
          navigate(consumeAuthReturnPath('/dashboard', nextSession.userNetUid || nextSession.user?.NetUid), { replace: true })
        } finally {
          setLoading(false)
        }
      },
      logout,
    }),
    [enrichSession, isLoading, isPermissionsLoading, logout, navigate, permissions, runtimePermissionKeys, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
