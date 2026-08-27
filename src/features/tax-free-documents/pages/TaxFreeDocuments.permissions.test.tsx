import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  changeTaxFreeDocumentStatus,
  getTaxFreeDocument,
  getTaxFreeDocuments,
  getTaxFreePrintDocument,
  printTaxFreeDocument,
  updateTaxFreeDocument,
} from '../api/taxFreeDocumentsApi'
import type { TaxFreeDocument } from '../types'
import { TaxFreeStatus } from '../types'
import { TaxFreeDocumentsPage } from './TaxFreeDocumentsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/taxFreeDocumentsApi', () => ({
  changeTaxFreeDocumentStatus: vi.fn(),
  createIncomePaymentFromTaxFree: vi.fn(),
  createTaxFreeCashflowArticle: vi.fn(),
  getTaxFreeCarrier: vi.fn(),
  getTaxFreeDocument: vi.fn(),
  getTaxFreeDocuments: vi.fn(),
  getTaxFreePrintDocument: vi.fn(),
  printTaxFreeDocument: vi.fn(),
  searchTaxFreeCarriers: vi.fn().mockResolvedValue([]),
  updateTaxFreeDocument: vi.fn(),
}))

vi.mock('../components/TaxFreePaymentFromTaxFreeModal', () => ({
  TaxFreePaymentFromTaxFreeModal: ({ opened }: { opened: boolean }) => opened ? <div>INCOME_MODAL</div> : null,
}))

vi.mock('../../document-outcome-payment/components/DocumentOutcomePaymentModal', () => ({
  DocumentOutcomePaymentModal: ({ opened }: { opened: boolean }) => opened ? <div>OUTCOME_MODAL</div> : null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => (
    opened ? <section>{children}{footer}</section> : null
  ),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section>{children}</section> : null
  ),
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../../../shared/ui/table-row-action', () => ({
  TableRowAction: ({ disabled, label, onClick }: { disabled?: boolean; label: string; onClick: () => void }) => (
    <button disabled={disabled} type="button" onClick={onClick}>{label}</button>
  ),
}))

type TestRow = { document: TaxFreeDocument }
type TestColumn = { cell?: (row: TestRow) => ReactNode; id: string }

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, onRowClick }: { columns: TestColumn[]; data: TestRow[]; onRowClick?: (row: TestRow) => void }) => (
    <div>
      {data.map((row) => (
        <div key={row.document.NetUid}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(row)}>
            ROW:{row.document.Number}
          </button>
          {columns.filter((column) => column.id.endsWith('Action')).map((column) => (
            <div key={column.id}>{column.cell?.(row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const FORMED_DOCUMENT: TaxFreeDocument = {
  NetUid: 'tax-free-formed',
  Number: 'TF-1',
  TaxFreeItems: [],
  TaxFreePackList: {
    Client: { Id: 1, NetUid: 'client-1' },
    ClientAgreementId: 2,
    IsSent: true,
  },
  TaxFreeStatus: TaxFreeStatus.Formed,
  VatAmountPl: 100,
}

const PRINTED_DOCUMENT: TaxFreeDocument = {
  ...FORMED_DOCUMENT,
  NetUid: 'tax-free-printed',
  Number: 'TF-2',
  TaxFreeStatus: TaxFreeStatus.Printed,
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/tax-free/all']}>
          <TaxFreeDocumentsPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Tax Free document canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getTaxFreeDocuments).mockResolvedValue({ Items: [FORMED_DOCUMENT, PRINTED_DOCUMENT], Total: 2 })
    vi.mocked(getTaxFreeDocument).mockImplementation(async (netId) => (
      netId === PRINTED_DOCUMENT.NetUid ? PRINTED_DOCUMENT : FORMED_DOCUMENT
    ))
    vi.mocked(updateTaxFreeDocument).mockImplementation(async (document) => document)
    vi.mocked(changeTaxFreeDocumentStatus).mockImplementation(async (document) => document)
    vi.mocked(getTaxFreePrintDocument).mockResolvedValue({ PdfDocumentURL: '/tax-free.pdf' })
    vi.mocked(printTaxFreeDocument).mockResolvedValue({ Message: 'printed' })
  })

  it('keeps every document action absent and rows inert with page access alone', async () => {
    renderPage()

    expect((await screen.findByRole('button', { name: 'ROW:TF-1' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Деталі' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Панель статусів' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Попередній перегляд друку' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завантажити документи' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Створити бухгалтерський документ' })).toBeNull()
    expect(getTaxFreeDocument).not.toHaveBeenCalled()
  })

  it('hydrates details only through open_details and keeps edit controls read-only', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Document.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'ROW:TF-1' }))
    await waitFor(() => expect(getTaxFreeDocument).toHaveBeenCalledWith('tax-free-formed'))
    expect((screen.getByLabelText('Код') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })

  it('rechecks edit and status as separate mutation rights', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Document.OpenDetails)
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Document.Edit)
    const editRender = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'ROW:TF-1' }))
    await screen.findByRole('button', { name: 'Зберегти' })
    fireEvent.change(screen.getByLabelText('Код'), { target: { value: 'EDITED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateTaxFreeDocument).toHaveBeenCalledWith(expect.objectContaining({ CustomCode: 'EDITED' })))
    expect(changeTaxFreeDocumentStatus).not.toHaveBeenCalled()
    editRender.unmount()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Document.OpenDetails)
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Status.Change)
    renderPage()
    const statusButton = (await screen.findAllByRole('button', { name: 'Панель статусів' }))
      .find((button) => !(button as HTMLButtonElement).disabled)
    expect(statusButton).toBeTruthy()
    fireEvent.click(statusButton!)
    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти статус' }))
    await waitFor(() => expect(changeTaxFreeDocumentStatus).toHaveBeenCalledOnce())
  })

  it('guards print and export independently including final handlers', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Document.Print)
    const printRender = renderPage()
    const printPreviewButton = (await screen.findAllByRole('button', { name: 'Попередній перегляд друку' }))
      .find((button) => !(button as HTMLButtonElement).disabled)
    expect(printPreviewButton).toBeTruthy()
    fireEvent.click(printPreviewButton!)
    fireEvent.click(await screen.findByRole('button', { name: 'Друк' }))
    await waitFor(() => expect(printTaxFreeDocument).toHaveBeenCalledWith(FORMED_DOCUMENT))
    printRender.unmount()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Document.Export)
    renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Завантажити документи' }))[0])
    await waitFor(() => expect(getTaxFreePrintDocument).toHaveBeenCalledWith('tax-free-formed'))
  })

  it('shows only the assigned accounting action in the shared chooser', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Accounting.CreateIncome)
    const incomeRender = renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Створити бухгалтерський документ' }))[0])
    expect(screen.getByRole('button', { name: 'Прибутковий касовий ордер' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Видатковий касовий ордер' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Прибутковий касовий ордер' }))
    expect(screen.getByText('INCOME_MODAL')).toBeTruthy()
    incomeRender.unmount()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.TaxFreeDocuments.Accounting.CreateOutcome)
    renderPage()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Створити бухгалтерський документ' }))[0])
    expect(screen.queryByRole('button', { name: 'Прибутковий касовий ордер' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Видатковий касовий ордер' }))
    expect(screen.getByText('OUTCOME_MODAL')).toBeTruthy()
  })
})
