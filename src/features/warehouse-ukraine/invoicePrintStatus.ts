import { translate } from '../../shared/i18n/translate'
import type { Sale } from './types'

export type InvoicePrintStatus = {
  color: 'orange' | 'teal'
  key: 'changed' | 'printed'
  label: string
}

export function getInvoicePrintStatus(sale: Sale): InvoicePrintStatus | null {
  if (hasApprovedInvoiceEdits(sale)) {
    return {
      color: 'orange',
      key: 'changed',
      label: translate('Змінено'),
    }
  }

  if (sale.IsPrinted) {
    return {
      color: 'teal',
      key: 'printed',
      label: translate('Роздруковано'),
    }
  }

  return null
}

export function hasApprovedInvoiceEdits(sale: Sale): boolean {
  return (sale.HistoryInvoiceEdit || []).some((entry) => entry.ApproveUpdate)
}
