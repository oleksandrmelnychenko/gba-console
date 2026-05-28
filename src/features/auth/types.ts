import type { AuthSession, AuthUser } from '../../shared/auth/types'

export type { AuthSession, AuthUser }

export type AuthContextValue = {
  session: AuthSession | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasPermission: (permissionKey: string) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export type SignInResponse = {
  AccessToken?: string
  RefreshToken?: string
  UserNetUid?: string
  CsrfToken?: string
}

export type ServerSessionResponse = {
  UserNetUid?: string
  CsrfToken?: string
}
