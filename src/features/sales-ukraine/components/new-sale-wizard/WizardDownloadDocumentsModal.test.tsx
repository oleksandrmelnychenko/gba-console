import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import type { SaleDocumentResult } from '../../types'
import { WizardDownloadDocumentsModal } from './WizardDownloadDocumentsModal'

const mocks = vi.hoisted(() => ({
  permissionKeys: new Set<string>(),
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => mocks.permissionKeys.has(permission),
  }),
}))

vi.mock('../../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ items }: { items: ReadonlyArray<{ label?: string }>; opened: boolean; children?: ReactNode }) => (
    <div>{items.map((item) => <span key={item.label}>{item.label}</span>)}</div>
  ),
}))

const result: SaleDocumentResult = {
  excelUrl: 'https://example.test/payment.xlsx',
  invoiceExcelUrl: 'https://example.test/invoice.xlsx',
  invoicePdfUrl: null,
  isAcceptedToPacking: false,
  pdfUrl: null,
}

describe('WizardDownloadDocumentsModal canonical invoice permission', () => {
  beforeEach(() => {
    mocks.permissionKeys.clear()
  })

  it('uses export_invoice instead of role type for a pre-packing invoice', () => {
    const view = render(<WizardDownloadDocumentsModal result={result} onClose={vi.fn()} />)

    expect(screen.getByText('Рахунок на оплату · Excel')).toBeTruthy()
    expect(screen.queryByText('Видаткова накладна · Excel')).toBeNull()

    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportInvoice)
    view.rerender(<WizardDownloadDocumentsModal result={result} onClose={vi.fn()} />)

    expect(screen.getByText('Видаткова накладна · Excel')).toBeTruthy()
  })

  it('keeps the accepted-to-packing invoice visible without the override permission', () => {
    render(
      <WizardDownloadDocumentsModal
        result={{ ...result, isAcceptedToPacking: true }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Видаткова накладна · Excel')).toBeTruthy()
  })
})
