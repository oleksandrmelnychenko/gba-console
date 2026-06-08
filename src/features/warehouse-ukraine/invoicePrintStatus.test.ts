import { describe, expect, it } from 'vitest'
import type { Sale } from './types'
import { getInvoicePrintStatus, hasApprovedInvoiceEdits } from './invoicePrintStatus'

describe('invoice print status', () => {
  it('marks approved invoice edits as changed before printed state', () => {
    const sale: Sale = {
      IsPrinted: true,
      HistoryInvoiceEdit: [{ ApproveUpdate: true }],
    }

    expect(hasApprovedInvoiceEdits(sale)).toBe(true)
    expect(getInvoicePrintStatus(sale)).toEqual({
      color: 'orange',
      key: 'changed',
      label: 'Змінено',
    })
  })

  it('marks printed invoices when there are no approved edits', () => {
    expect(getInvoicePrintStatus({ IsPrinted: true })).toEqual({
      color: 'teal',
      key: 'printed',
      label: 'Роздруковано',
    })
  })

  it('returns no badge for unprinted unchanged invoices', () => {
    expect(getInvoicePrintStatus({ IsPrinted: false })).toBeNull()
  })
})
