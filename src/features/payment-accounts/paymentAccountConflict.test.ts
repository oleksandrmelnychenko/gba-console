// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Рахунок saved in two tabs', () => {
  const source = readFileSync('src/features/payment-accounts/pages/PaymentAccountFormPage.tsx', 'utf8') as string

  it('sends back the loaded account (with its Updated) and turns a 409 into a reload notice', () => {
    expect(source).toMatch(/return \{\s*\.\.\.account,/)
    expect(source).toContain('isConflictError(saveError)')
    expect(source).toContain('<StaleRecordAlert message={t(STALE_RECORD_MESSAGE)}')
  })
})
