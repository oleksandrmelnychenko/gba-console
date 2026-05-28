import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasPermission as checkPermission } from '../../shared/auth/permissions'
import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  clearSession,
  readSession,
  saveSession,
} from '../../shared/auth/session'
import { getCurrentUserProfile, getServerSession, signIn, signOut } from './api/authApi'
import { AuthContext } from './AuthContext'
import type { AuthContextValue, AuthSession } from './types'

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const [isLoading, setLoading] = useState(true)

  const syncSession = useCallback(() => {
    setSession(readSession())
  }, [])

  const logout = useCallback(() => {
    if (readSession()?.csrfToken) {
      void signOut().catch(() => undefined)
    }

    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])
  const syncSessionRef = useRef(syncSession)
  const logoutRef = useRef(logout)

  useEffect(() => {
    syncSessionRef.current = syncSession
    logoutRef.current = logout
  }, [logout, syncSession])

  const enrichSession = useCallback(async (baseSession: AuthSession): Promise<AuthSession> => {
    saveSession(baseSession)
    setSession(baseSession)

    const user = await getCurrentUserProfile(baseSession)
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
    const handleUnauthorized = () => logoutRef.current()

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
        }
      } catch {
        if (!cancelled) {
          clearSession()
          setSession(null)
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

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session?.csrfToken),
      isLoading,
      hasPermission: (permissionKey) => checkPermission(session?.user, permissionKey),
      login: async (username, password) => {
        setLoading(true)

        try {
          const nextSession = await enrichSession(await signIn(username, password))
          setSession(nextSession)
          navigate('/dashboard', { replace: true })
        } finally {
          setLoading(false)
        }
      },
      logout,
    }),
    [enrichSession, isLoading, logout, navigate, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
