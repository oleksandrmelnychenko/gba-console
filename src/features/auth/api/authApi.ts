import {
  ApiError,
  apiRequest,
  expiresAtFromNow,
  withAuthSessionLock,
} from '../../../shared/api/apiClient'
import { clearSession } from '../../../shared/auth/session'
import { translate } from '../../../shared/i18n/translate'
import type { AuthSession, AuthUser, ServerSessionResponse, SignInResponse } from '../types'
import { getSignInErrorMessage } from './signInError'

export async function signIn(username: string, password: string): Promise<AuthSession> {
  let token: SignInResponse

  try {
    token = await apiRequest<SignInResponse>('/usermanagement/token', {
      method: 'POST',
      auth: false,
      body: {
        Username: username,
        Password: password,
      },
    })
  } catch (error) {
    // Wrong credentials keep the neutral message; any other server reason (blocked user, removed role) is shown.
    if (error instanceof ApiError) {
      throw new ApiError(getSignInErrorMessage(error), error.status, error.payload, error.headers)
    }

    throw error
  }

  if (!token.CsrfToken) {
    throw new Error(translate('Сервер авторизації повернув некоректну відповідь'))
  }

  return {
    csrfToken: token.CsrfToken,
    userNetUid: token.UserNetUid,
    accessTokenExpiresAt: expiresAtFromNow(token.AccessTokenExpiresIn),
  }
}

export async function getServerSession(): Promise<AuthSession | null> {
  const session = await apiRequest<ServerSessionResponse>('/usermanagement/token/session', {
    errorMessages: {
      401: 'Сесію завершено. Увійдіть повторно.',
      403: 'Сесію завершено. Увійдіть повторно.',
    },
  })

  if (!session.CsrfToken) {
    return null
  }

  return {
    csrfToken: session.CsrfToken,
    userNetUid: session.UserNetUid,
    accessTokenExpiresAt: expiresAtFromNow(session.AccessTokenExpiresIn),
  }
}

export async function signOut(): Promise<void> {
  await withAuthSessionLock(async () => {
    await apiRequest('/usermanagement/token/logout', {
      method: 'POST',
      auth: false,
      errorMessages: {
        409: 'Сесія змінилася. Повторіть вихід.',
        503: 'Не вдалося завершити сеанс. Спробуйте ще раз.',
        default: 'Не вдалося вийти. Спробуйте ще раз.',
        network: 'Сервер авторизації недоступний. Спробуйте ще раз пізніше.',
      },
    })

    // Keep this inside the same refresh/logout lock: a queued refresh in this or another tab
    // must observe the cleared shared session before it can issue another refresh request.
    clearSession()
  })
}

export async function getCurrentUserProfile(session: AuthSession): Promise<AuthUser | null> {
  if (!session.userNetUid) {
    return null
  }

  return apiRequest<AuthUser>('/usermanagement/profiles/me')
}
