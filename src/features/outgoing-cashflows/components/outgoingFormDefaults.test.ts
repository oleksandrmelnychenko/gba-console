// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(`src/features/outgoing-cashflows/components/${file}`, 'utf8') as string

describe('outgoing cash-order form defaults', () => {
  it('Оплата постачальнику does not preselect the first (income) article', () => {
    expect(read('OutgoingPaymentGroupForm.tsx')).not.toMatch(/nextMovements\[0\]/)
  })

  it('Перерахування підзвітнику starts in the management ledger and needs one ledger', () => {
    const source = read('OutgoingCashOrderForm.tsx')

    expect(source).toMatch(/isManagementAccounting: true,/)
    expect(source).toContain('Оберіть облік: управлінський або бухгалтерський')
  })
})
