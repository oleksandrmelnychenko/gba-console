import { ApiError } from '../../../shared/api/apiClient'
import { translate } from '../../../shared/i18n/translate'

const INVALID_CREDENTIALS_MESSAGE = 'Невірний логін або пароль'

// Wrong login or password: one neutral message (the server's own texts differ for an unknown login and a wrong password).
const invalidCredentialsPatterns = [
  /не\s*валідн\p{L}*\s+(email|пароль)/iu,
  /невірн\p{L}*\s+(логін|пароль)/iu,
  /invalid\s+(credentials|password|user\s*name|username)/i,
  /password\s+you\s+entered\s+is\s+incorrect/i,
]

const cyrillicPattern = /[Ѐ-ӿ]/

/**
 * The login form's message for a failed POST /usermanagement/token.
 * Wrong credentials stay 'Невірний логін або пароль'; any other Ukrainian message from the server
 * (a blocked user, a user whose role was removed, ...) is shown as is instead of being hidden behind it.
 * Raw English exception text is never shown.
 */
export function getSignInErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : translate('Не вдалося увійти. Спробуйте ще раз.')
  }

  if (error.status === 0) {
    return translate('Сервер авторизації недоступний. Спробуйте ще раз пізніше.')
  }

  if (error.status >= 500) {
    return translate('Сервер тимчасово недоступний. Спробуйте ще раз пізніше.')
  }

  if (error.status === 403) {
    return translate('Недостатньо прав для входу')
  }

  const serverMessage = getServerMessage(error.payload)

  if (!serverMessage || invalidCredentialsPatterns.some((pattern) => pattern.test(serverMessage))) {
    return error.status === 400 || error.status === 401
      ? translate(INVALID_CREDENTIALS_MESSAGE)
      : translate('Не вдалося увійти. Спробуйте ще раз.')
  }

  return cyrillicPattern.test(serverMessage)
    ? serverMessage
    : translate('Не вдалося увійти. Спробуйте ще раз.')
}

function getServerMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload.trim()
  }

  if (payload && typeof payload === 'object') {
    const record = payload as { Message?: unknown; message?: unknown }
    const message = typeof record.Message === 'string' ? record.Message : record.message

    return typeof message === 'string' ? message.trim() : ''
  }

  return ''
}
