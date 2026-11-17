// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(`src/features/available-payments/${file}`, 'utf8') as string

describe('Платежі labels', () => {
  it('Рух коштів names the document type instead of showing its number', () => {
    const drawer = read('components/AvailablePaymentsDetailDrawer.tsx')

    expect(drawer).not.toContain("readUnknown(row, ['Name', 'Type', 'OperationTypeName'])")
    expect(drawer).toContain('getSupplierCashFlowTypeLabel(type)')
  })

  it('the outgoing order recipient prefers the task counterparty over our organization', () => {
    const drawer = read('components/AvailablePaymentsDetailDrawer.tsx')

    expect(drawer.indexOf('outcomeModels[0]?.organizationName')).toBeLessThan(drawer.indexOf('|| selectedOrganization?.Name'))
  })

  it('the invoice line says which amounts include VAT', () => {
    expect(read('models/paymentTaskModelMapper.ts')).toContain("header: t('Сума без ПДВ'), key: 'totalWithoutVat'")
  })

  it('the day row explains its two counters', () => {
    expect(read('pages/AvailablePaymentsPage.tsx')).toContain('Завершені задачі (не входять у суми)')
  })
})
