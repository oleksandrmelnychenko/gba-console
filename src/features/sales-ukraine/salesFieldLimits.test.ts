import { describe, expect, it } from 'vitest'
import { getSaleReviewIssues } from './saleReviewGuards'
import { isValidOwnTtnNumber, isValidRecipientPhone } from './salesFieldLimits'

describe('delivery field formats (same rules as the server)', () => {
  it.each([
    ['20450123456789', true], ['MEEST-AB12345', true], ['', true],
    ['123', false], ['<b>1234567</b>', false], ['1'.repeat(150), false],
  ])('own TTN %s -> %s', (value, valid) => expect(isValidOwnTtnNumber(value)).toBe(valid))

  it.each([
    ['+380 (50) 123-45-67', true], ['0501234567', true], ['', true],
    ['abc😀<b>', false], ['12345', false],
  ])('phone %s -> %s', (value, valid) => expect(isValidRecipientPhone(value)).toBe(valid))

  it('reports a malformed phone and TTN before saving', () => {
    const issues = getSaleReviewIssues({
      CustomersOwnTtn: { Number: '1'.repeat(150) },
      DeliveryRecipient: { FullName: 'X', MobilePhone: 'abc😀<b>' },
      Transporter: { Id: 1 },
    })

    expect(issues).toEqual(expect.arrayContaining(['recipientPhoneFormat', 'ownTtnNumberFormat']))
  })
})
