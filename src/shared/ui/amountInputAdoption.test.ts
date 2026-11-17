// @ts-expect-error node types are not part of the browser tsconfig
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Numeric fields bound to a number snap back to «0» with the caret in front
 * when cleared (typing 3 then gives 30). These finance fields use AmountInput.
 */
const FILES = [
  'src/features/consumable-orders/pages/ConsumableOrderFormPage.tsx',
  'src/features/consumable-orders/pages/ConsumableOrderPayPage.tsx',
  'src/features/available-payments/components/AvailablePaymentsDetailDrawer.tsx',
  'src/features/document-outcome-payment/components/DocumentOutcomePaymentModal.tsx',
  'src/features/payment-online-shop/components/PaymentShopDetailDrawer.tsx',
  'src/features/sad/components/SadPaymentFromSadModal.tsx',
  'src/features/tax-free-documents/components/TaxFreePaymentFromTaxFreeModal.tsx',
  'src/features/income-cashflows/pages/IncomeCashflowConversionFormPage.tsx',
  'src/features/outgoing-cashflows/components/OutgoingCashOrderForm.tsx',
]

describe('finance numeric fields', () => {
  it.each(FILES)('%s has no NumberInput', (file) => {
    expect(readFileSync(file, 'utf8') as string).not.toMatch(/<NumberInput\b/)
  })

  it('the advance-report position quantity is an AmountInput', () => {
    const source = readFileSync('src/features/outgoing-cashflows/components/AdvanceReportConsumableOrderModal.tsx', 'utf8') as string
    const quantity = source.slice(source.lastIndexOf('<', source.indexOf("label={t('Кількість')}")))

    expect(quantity.startsWith('<AmountInput')).toBe(true)
  })
})
