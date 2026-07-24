import { describe, expect, it } from 'vitest'
import {
  getOrderItemQuantityLimit,
  getSalesTtnFileValidationError,
  normalizePersistedGuid,
  requirePositiveFiniteQuantity,
  SALES_TTN_MAX_FILE_SIZE_BYTES,
} from './salesPayloadGuards'

describe('sales payload guards', () => {
  it('accepts only persisted non-empty GUIDs', () => {
    expect(normalizePersistedGuid(' AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA ')).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    expect(normalizePersistedGuid('00000000-0000-0000-0000-000000000000')).toBe(null)
    expect(normalizePersistedGuid('row-1')).toBe(null)
    expect(normalizePersistedGuid('')).toBe(null)
  })

  it('requires a finite positive quantity', () => {
    expect(requirePositiveFiniteQuantity('2,5', 'invalid')).toBe(2.5)
    expect(() => requirePositiveFiniteQuantity(0, 'invalid')).toThrow('invalid')
    expect(() => requirePositiveFiniteQuantity(Number.NaN, 'invalid')).toThrow('invalid')
    expect(() => requirePositiveFiniteQuantity(Number.POSITIVE_INFINITY, 'invalid')).toThrow('invalid')
  })

  it('limits an edit to the current reservation plus currently available stock', () => {
    expect(getOrderItemQuantityLimit({
      Product: { AvailableQtyUk: 4, AvailableQtyUkReSale: 3, AvailableQtyUkVAT: 9 },
      Qty: 2,
    }, false)).toBe(9)
    expect(getOrderItemQuantityLimit({
      Product: { AvailableQtyUk: 4, AvailableQtyUkReSale: 3, AvailableQtyUkVAT: 9 },
      Qty: 2,
    }, true)).toBe(11)
    expect(getOrderItemQuantityLimit({ Product: {}, Qty: 2 }, false)).toBe(null)
  })

  it('accepts only non-empty PDF/JPEG/PNG files up to the server limit', () => {
    expect(getSalesTtnFileValidationError(
      new File(['%PDF-1.7'], 'ttn.pdf', { type: 'application/pdf' }),
    )).toBe(null)
    expect(getSalesTtnFileValidationError(
      new File(['image'], 'ttn.png', { type: 'image/jpeg' }),
    )).toBe('Тип файлу ТТН не відповідає його розширенню')
    expect(getSalesTtnFileValidationError(
      new File(['data'], 'ttn.exe', { type: 'application/octet-stream' }),
    )).toBe('Файл ТТН має бути у форматі PDF, JPEG або PNG')
    expect(getSalesTtnFileValidationError(
      new File([], 'ttn.pdf', { type: 'application/pdf' }),
    )).toBe('Файл ТТН порожній')

    const oversized = new File(['data'], 'ttn.pdf', { type: 'application/pdf' })
    Object.defineProperty(oversized, 'size', { value: SALES_TTN_MAX_FILE_SIZE_BYTES + 1 })

    expect(getSalesTtnFileValidationError(oversized)).toBe('Файл ТТН має бути не більше 50 МБ')
  })
})
