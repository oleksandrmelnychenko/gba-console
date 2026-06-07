import { describe, expect, it } from 'vitest'
import type { SupplyInvoice } from './detailTypes'
import {
  getSelectedProtocolInvoices,
  mergeProtocolInvoiceAssignmentCandidates,
} from './protocolInvoiceAssignment'

function invoice(NetUid: string, Number: string): SupplyInvoice {
  return { NetUid, Number }
}

describe('protocol invoice assignment', () => {
  it('appends currently assigned invoices missing from approved candidates', () => {
    const approvedInvoices = [invoice('approved-1', 'INV-1')]
    const assignedInvoices = [invoice('assigned-1', 'INV-2')]

    expect(mergeProtocolInvoiceAssignmentCandidates(approvedInvoices, assignedInvoices)).toEqual([
      approvedInvoices[0],
      assignedInvoices[0],
    ])
  })

  it('keeps approved invoice when an assigned invoice has the same NetUid', () => {
    const approvedInvoice = invoice('same-invoice', 'approved')
    const assignedInvoice = invoice('same-invoice', 'assigned')

    expect(mergeProtocolInvoiceAssignmentCandidates([approvedInvoice], [assignedInvoice])).toEqual([approvedInvoice])
  })

  it('resolves selected invoices from appended assigned candidates', () => {
    const assignedInvoice = invoice('assigned-1', 'INV-2')
    const candidates = mergeProtocolInvoiceAssignmentCandidates([], [assignedInvoice])

    expect(getSelectedProtocolInvoices(candidates, { 'assigned-1': true })).toEqual([assignedInvoice])
  })
})
