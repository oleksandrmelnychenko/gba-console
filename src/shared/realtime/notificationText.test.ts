import { describe, expect, it } from 'vitest'
import { toastTitleAndMessage } from './notificationText'

describe('toastTitleAndMessage', () => {
  it('shows a lone or repeated title once', () => {
    expect(toastTitleAndMessage('Оновлено замовлення', '')).toEqual({ message: 'Оновлено замовлення' })
    expect(toastTitleAndMessage('Оновлено замовлення', 'Оновлено замовлення')).toEqual({ message: 'Оновлено замовлення' })
  })

  it('keeps a distinct body under the title', () => {
    expect(toastTitleAndMessage('Оновлено замовлення', 'Сума 10,00')).toEqual({ message: 'Сума 10,00', title: 'Оновлено замовлення' })
  })
})
