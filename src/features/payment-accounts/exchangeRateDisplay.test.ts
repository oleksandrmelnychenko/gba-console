// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatExchangeRate } from './exchangeRateGuard'

describe('exchange history rate column', () => {
  it('shows the rate with a decimal comma', () => {
    expect(formatExchangeRate(51.25)).toBe('51,25')
  })

  it('the «Курс» column uses that format', () => {
    const source = readFileSync('src/features/payment-accounts/pages/PaymentAccountFormPage.tsx', 'utf8') as string
    expect(source).toMatch(/key: 'rate', header: t\('Курс'\)[^\n]*formatExchangeRate\(exchange\.ExchangeRate\)/)
  })
})
