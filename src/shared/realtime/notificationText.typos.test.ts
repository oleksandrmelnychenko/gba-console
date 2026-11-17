import { describe, expect, it } from 'vitest'
import { fixServerToastText } from './notificationText'

describe('fixServerToastText (WH2-08)', () => {
  it('corrects «Створенено» in server toast texts', () => {
    expect(fixServerToastText('Створенено нове замовлення.')).toBe('Створено нове замовлення.')
    expect(fixServerToastText('Без змін')).toBe('Без змін')
  })
})
