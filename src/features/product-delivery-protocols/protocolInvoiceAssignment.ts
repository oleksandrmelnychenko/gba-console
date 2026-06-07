import type { SupplyInvoice } from './detailTypes'

export function getProtocolInvoiceAssignmentKey(invoice: SupplyInvoice): string {
  return invoice.NetUid || (typeof invoice.Id === 'number' ? String(invoice.Id) : '')
}

export function mergeProtocolInvoiceAssignmentCandidates(
  approvedInvoices: SupplyInvoice[],
  assignedInvoices: SupplyInvoice[],
): SupplyInvoice[] {
  const seen = new Set<string>()
  const candidates: SupplyInvoice[] = []

  function append(invoice: SupplyInvoice) {
    const key = getProtocolInvoiceAssignmentKey(invoice)

    if (!key || seen.has(key)) {
      return
    }

    seen.add(key)
    candidates.push(invoice)
  }

  approvedInvoices.forEach(append)
  assignedInvoices.forEach(append)

  return candidates
}

export function getSelectedProtocolInvoices(
  candidates: SupplyInvoice[],
  selected: Record<string, boolean>,
): SupplyInvoice[] {
  return candidates.filter((invoice) => {
    const key = getProtocolInvoiceAssignmentKey(invoice)

    return Boolean(key && selected[key])
  })
}
