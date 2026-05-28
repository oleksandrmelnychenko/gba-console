import { apiRequest } from '../../../shared/api/apiClient'
import { translate } from '../../../shared/i18n/translate'
import type { AuthSession, AuthUser, ServerSessionResponse, SignInResponse } from '../types'

export async function signIn(username: string, password: string): Promise<AuthSession> {
  const token = await apiRequest<SignInResponse>('/usermanagement/token', {
    method: 'POST',
    auth: false,
    body: {
      Username: username,
      Password: password,
    },
    errorMessages: {
      400: 'Невірний логін або пароль',
      401: 'Невірний логін або пароль',
      403: 'Недостатньо прав для входу',
      500: 'Сервер тимчасово недоступний. Спробуйте ще раз пізніше.',
      default: 'Не вдалося увійти. Спробуйте ще раз.',
      network: 'Сервер авторизації недоступний. Спробуйте ще раз пізніше.',
    },
  })

  if (!token.CsrfToken) {
    throw new Error(translate('Сервер авторизації повернув некоректну відповідь'))
  }

  return {
    csrfToken: token.CsrfToken,
    userNetUid: token.UserNetUid,
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
  }
}

export async function signOut(): Promise<void> {
  await apiRequest('/usermanagement/token/logout', {
    method: 'POST',
  })
}

export async function getCurrentUserProfile(session: AuthSession): Promise<AuthUser | null> {
  const netId = session.userNetUid

  if (!netId) {
    return null
  }

  return apiRequest<AuthUser>('/usermanagement/profiles/get', {
    query: {
      netId,
    },
  })
}
