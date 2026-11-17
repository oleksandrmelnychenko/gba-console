import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { getSignInErrorMessage } from './signInError'

function tokenError(status: number, message?: string) {
  return new ApiError('raw', status, message === undefined ? null : { Message: message, StatusCode: status })
}

describe('getSignInErrorMessage', () => {
  it('keeps the neutral message for a wrong login or password', () => {
    expect(getSignInErrorMessage(tokenError(400, 'Не валідний пароль'))).toBe('Невірний логін або пароль')
    expect(getSignInErrorMessage(tokenError(400, 'Не валідний email/номер телефону або пароль'))).toBe('Невірний логін або пароль')
    expect(getSignInErrorMessage(tokenError(401))).toBe('Невірний логін або пароль')
    expect(getSignInErrorMessage(tokenError(400, 'Invalid credentials'))).toBe('Невірний логін або пароль')
  })

  it("shows the server's own reason when it is not about credentials", () => {
    expect(getSignInErrorMessage(tokenError(400, 'Користувач заблокований'))).toBe('Користувач заблокований')
    expect(getSignInErrorMessage(tokenError(400, 'Роль користувача видалено. Зверніться до адміністратора.')))
      .toBe('Роль користувача видалено. Зверніться до адміністратора.')
  })

  it('never shows raw English exception text', () => {
    expect(getSignInErrorMessage(tokenError(400, "Value cannot be null. (Parameter 'value')")))
      .toBe('Не вдалося увійти. Спробуйте ще раз.')
  })

  it('maps network and server failures', () => {
    expect(getSignInErrorMessage(new ApiError('x', 0, null))).toBe('Сервер авторизації недоступний. Спробуйте ще раз пізніше.')
    expect(getSignInErrorMessage(tokenError(500, 'boom'))).toBe('Сервер тимчасово недоступний. Спробуйте ще раз пізніше.')
    expect(getSignInErrorMessage(tokenError(403))).toBe('Недостатньо прав для входу')
  })
})
