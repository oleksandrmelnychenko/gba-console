import { describe, expect, it } from 'vitest'
import { getReserveLimit, validateReserveQty } from './reserveQty'

const t = (key: string) => key

describe('cart reserve quantity', () => {
  it('limits the reserve to the current reserve plus what is available', () => {
    expect(getReserveLimit({ AvailableQty: 0, ReservedQty: 0 })).toBe(0)
    expect(getReserveLimit({ AvailableQty: 7, ReservedQty: 3 })).toBe(10)
  })

  it('refuses an empty value instead of saving it as success', () => {
    expect(validateReserveQty('', 10, t)).toBe('Вкажіть кількість — ціле число від 0')
  })

  it('refuses more than available before calling the server', () => {
    expect(validateReserveQty(5, 0, t)).toBe('Можна зарезервувати не більше 0')
    expect(validateReserveQty(0, 0, t)).toBeNull()
    expect(validateReserveQty(10, 10, t)).toBeNull()
  })
})
