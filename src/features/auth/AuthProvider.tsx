import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getEffectivePermissionKeys,
  hasPermission as checkPermission,
  type RuntimePermissionKeys,
} from '../../shared/auth/permissions'
import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  clearSession,
  readSession,
  saveSession,
} from '../../shared/auth/session'
import { getCurrentUserProfile, getServerSession, signIn, signOut } from './api/authApi'
import { getMyPermissions } from './api/permissionsApi'
import {
  clearAuthReturnPath,
  consumeAuthReturnPath,
  rememberAuthReturnPath,
} from './authReturnPath'
import { AuthContext } from './AuthContext'
import type { AuthContextValue, AuthSession } from './types'

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const [isLoading, setLoading] = useState(true)
  const [runtimePermissionKeys, setRuntimePermissionKeys] = useState<RuntimePermissionKeys>(null)
  const [isPermissionsLoading, setPermissionsLoading] = useState(false)

  const syncSession = useCallback(() => {
    setSession(readSession())
  }, [])

  const logout = useCallback(() => {
    if (readSession()?.csrfToken) {
      void signOut().catch(() => undefined)
    }

    clearAuthReturnPath()
    clearSession()
    setSession(null)
    setRuntimePermissionKeys(null)
    navigate('/login', { replace: true })
  }, [navigate])
  const logoutAfterUnauthorized = useCallback(() => {
    rememberAuthReturnPath(location)

    if (readSession()?.csrfToken) {
      void signOut().catch(() => undefined)
    }

    clearSession()
    setSession(null)
    setRuntimePermissionKeys(null)
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

    setPermissionsLoading(true)
    const [user, myPermissions] = await Promise.all([
      getCurrentUserProfile(baseSession),
      getMyPermissions().catch(() => null),
    ]).finally(() => setPermissionsLoading(false))
    setRuntimePermissionKeys(myPermissions?.permissionKeys ?? null)
    const nextSession = user
      ? {
          ...baseSession,
          user,
          userNetUid: baseSession.userNetUid || user.NetUid,
        }
      : baseSession

    saveSession(nextSession)
    setSession(nextSession)

    return nextSession
  }, [])

  useEffect(() => {
    const handleSessionChanged = () => syncSessionRef.current()
    const handleUnauthorized = () => unauthorizedLogoutRef.current()

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged)
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged)
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [])

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
          setSession(null)
          setRuntimePermissionKeys(null)
        }
      } catch {
        if (!cancelled) {
          clearSession()
          setSession(null)
          setRuntimePermissionKeys(null)
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
          setSession(nextSession)
          navigate(consumeAuthReturnPath(), { replace: true })
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
