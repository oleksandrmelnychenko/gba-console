import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient'
import { isUserReadableText, technicalErrorText, userErrorText } from './userErrorText'

afterEach(() => vi.restoreAllMocks())

describe('userErrorText', () => {
  it('hides an English validator message and logs it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('CheNbaApi: Escalated response contains an invalid, duplicate, or non-escalated task')
    expect(userErrorText(error, 'Не вдалося завантажити ескальовані задачі')).toBe('Не вдалося завантажити ескальовані задачі. Спробуйте пізніше.')
    expect(warn).toHaveBeenCalledWith(expect.any(String), error.message)
    expect(technicalErrorText(error)).toBe(error.message)
  })
  it('keeps a Ukrainian server message as is', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new ApiError('План закупівлі ще готується. Повторіть запит за хвилину.', 503, null)
    expect(userErrorText(error, 'Не вдалося завантажити план')).toBe('План закупівлі ще готується. Повторіть запит за хвилину.')
    expect(warn).not.toHaveBeenCalled()
  })
  it('maps failure classes to Ukrainian hints', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(userErrorText(new ApiError('Upstream timed out', 504, null), 'Прогноз недоступний.')).toBe('Прогноз недоступний. Сервіс тимчасово недоступний. Спробуйте пізніше.')
    expect(userErrorText(new ApiError('Forbidden', 403, null), 'Дані недоступні')).toBe('Дані недоступні. Недостатньо прав для цієї дії.')
    expect(userErrorText(new ApiError('Not Found', 404, null), 'Дані недоступні')).toBe('Дані недоступні. Дані не знайдено.')
    expect(userErrorText(null, 'Дані недоступні')).toBe('Дані недоступні. Спробуйте пізніше.')
  })
  it('treats a technical prefix as not user readable even with Ukrainian words', () => {
    expect(isUserReadableText('PricingApi: поле price обовʼязкове')).toBe(false)
    expect(isUserReadableText('value_error.missing: field required')).toBe(false)
    expect(isUserReadableText('Клієнта не знайдено')).toBe(true)
    expect(isUserReadableText('Залишок по SKU 123 недоступний')).toBe(true)
  })
})
