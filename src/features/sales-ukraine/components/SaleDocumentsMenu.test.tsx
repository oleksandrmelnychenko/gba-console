import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import type { SaleDocumentResult, SalesUkraineSale } from '../types'
import { SaleDocumentsMenu } from './SaleDocumentsMenu'

const mocks = vi.hoisted(() => ({
  getApiLanguage: vi.fn(() => 'uk'),
  getSaleActForEditingHistoryDocument: vi.fn(),
  getSaleInvoiceDocument: vi.fn(),
  getSaleInvoiceHistoryDocument: vi.fn(),
  getSalePaymentDocument: vi.fn(),
  getSalePzDocument: vi.fn(),
  getSaleRevisionBaseInvoiceDocument: vi.fn(),
  getSaleRevisionBaseShipmentListDocument: vi.fn(),
  getSaleShipmentListDocument: vi.fn(),
  getSaleShipmentListHistoryDocument: vi.fn(),
  notificationsShow: vi.fn(),
  notificationsUpdate: vi.fn(),
  permissionKeys: new Set<string>(),
}))

vi.mock('../../../shared/api/apiClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/api/apiClient')>(),
  getApiLanguage: mocks.getApiLanguage,
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: mocks.notificationsShow,
    update: mocks.notificationsUpdate,
  },
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => mocks.permissionKeys.has(permission),
    permissions: [...mocks.permissionKeys],
    session: { userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    user: undefined,
  }),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../api/salesUkraineApi', () => ({
  getSaleActForEditingHistoryDocument: mocks.getSaleActForEditingHistoryDocument,
  getSaleInvoiceDocument: mocks.getSaleInvoiceDocument,
  getSaleInvoiceHistoryDocument: mocks.getSaleInvoiceHistoryDocument,
  getSalePaymentDocument: mocks.getSalePaymentDocument,
  getSalePzDocument: mocks.getSalePzDocument,
  getSaleRevisionBaseInvoiceDocument: mocks.getSaleRevisionBaseInvoiceDocument,
  getSaleRevisionBaseShipmentListDocument: mocks.getSaleRevisionBaseShipmentListDocument,
  getSaleShipmentListDocument: mocks.getSaleShipmentListDocument,
  getSaleShipmentListHistoryDocument: mocks.getSaleShipmentListHistoryDocument,
}))

const documentResult: SaleDocumentResult = {
  excelUrl: 'https://example.test/document.xlsx',
  invoiceExcelUrl: null,
  invoicePdfUrl: null,
  isAcceptedToPacking: false,
  pdfUrl: 'https://example.test/document.pdf',
}

function createSale(overrides: Partial<SalesUkraineSale> = {}): SalesUkraineSale {
  return {
    BaseLifeCycleStatus: { SaleLifeCycleType: 'Packaging' },
    ClientAgreement: {
      Agreement: { WithVATAccounting: false },
    },
    HistoryInvoiceEdit: [],
    IsVatSale: false,
    NetUid: 'sale-net-id',
    TransporterId: 3,
    ...overrides,
  }
}

function renderMenu(sale = createSale()) {
  return render(
    <MantineProvider theme={theme}>
      <SaleDocumentsMenu sale={sale} />
    </MantineProvider>,
  )
}

async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Документи' }))
  await screen.findByText('Видаткова накладна')
}

describe('SaleDocumentsMenu legacy document semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    mocks.getApiLanguage.mockReturnValue('uk')
    mocks.getSaleActForEditingHistoryDocument.mockResolvedValue(documentResult)
    mocks.getSaleInvoiceDocument.mockResolvedValue(documentResult)
    mocks.getSaleInvoiceHistoryDocument.mockResolvedValue(documentResult)
    mocks.getSalePaymentDocument.mockResolvedValue(documentResult)
    mocks.getSalePzDocument.mockResolvedValue(documentResult)
    mocks.getSaleRevisionBaseInvoiceDocument.mockResolvedValue(documentResult)
    mocks.getSaleRevisionBaseShipmentListDocument.mockResolvedValue(documentResult)
    mocks.getSaleShipmentListDocument.mockResolvedValue(documentResult)
    mocks.getSaleShipmentListHistoryDocument.mockResolvedValue(documentResult)
    mocks.permissionKeys.clear()
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportInvoice)
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportShipmentList)
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportPaymentInvoice)
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportPz)
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportRevisionDocuments)
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('uses the current invoice endpoint for a Ukrainian invoice-status sale and hides PZ', async () => {
    renderMenu()
    await openMenu()

    expect(screen.getByText('Видаткова накладна')).toBeTruthy()
    expect(screen.queryByText('PZ')).toBeNull()

    fireEvent.click(screen.getByText('Видаткова накладна'))

    await waitFor(() => expect(mocks.getSaleInvoiceDocument).toHaveBeenCalledWith('sale-net-id'))
    expect(mocks.getSalePzDocument).not.toHaveBeenCalled()
  })

  it('shows only the document action covered by its exact permission', async () => {
    mocks.permissionKeys.clear()
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportPaymentInvoice)

    renderMenu(createSale({
      ClientAgreement: { Agreement: { WithVATAccounting: true } },
      IsVatSale: true,
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Документи' }))

    expect(await screen.findByText('Рахунок на оплату')).toBeTruthy()
    expect(screen.queryByText('Видаткова накладна')).toBeNull()
    expect(screen.queryByText('Лист відвантаження')).toBeNull()
  })

  it('bundles the invoice only when export_invoice is assigned before packing', async () => {
    mocks.permissionKeys.clear()
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportPaymentInvoice)
    mocks.getSalePaymentDocument.mockResolvedValueOnce({
      ...documentResult,
      invoiceExcelUrl: 'https://example.test/invoice.xlsx',
      invoicePdfUrl: 'https://example.test/invoice.pdf',
      isAcceptedToPacking: false,
    })

    renderMenu(createSale({ BaseLifeCycleStatus: { SaleLifeCycleType: 'New' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Документи' }))
    fireEvent.click(await screen.findByText('Рахунок на оплату'))

    await waitFor(() => expect(mocks.getSalePaymentDocument).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Видаткова накладна')).toBeNull()

    cleanup()
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportInvoice)
    mocks.getSalePaymentDocument.mockResolvedValueOnce({
      ...documentResult,
      invoiceExcelUrl: 'https://example.test/invoice.xlsx',
      invoicePdfUrl: 'https://example.test/invoice.pdf',
      isAcceptedToPacking: false,
    })

    renderMenu(createSale({ BaseLifeCycleStatus: { SaleLifeCycleType: 'New' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Документи' }))
    fireEvent.click(await screen.findByText('Рахунок на оплату'))

    expect(await screen.findByText('Видаткова накладна')).toBeTruthy()
  })

  it('keeps the first revision bundle on the revision permission facade', async () => {
    mocks.permissionKeys.clear()
    mocks.permissionKeys.add(PermissionKeys.SalesUkraine.Sale.ExportRevisionDocuments)

    renderMenu(createSale({ HistoryInvoiceEdit: [{ NetUid: 'history-1' }] }))
    fireEvent.click(screen.getByRole('button', { name: 'Документи' }))
    fireEvent.click(await screen.findByText('Правка 1 документа'))

    await waitFor(() => expect(mocks.getSaleRevisionBaseInvoiceDocument).toHaveBeenCalledWith('sale-net-id'))
    expect(mocks.getSaleInvoiceDocument).not.toHaveBeenCalled()
  })

  it('shows PZ only for a Polish sale in invoice status', async () => {
    mocks.getApiLanguage.mockReturnValue('pl')

    renderMenu()
    await openMenu()

    fireEvent.click(screen.getByText('PZ'))

    await waitFor(() => expect(mocks.getSalePzDocument).toHaveBeenCalledWith('sale-net-id'))
  })

  it('hides PZ for a Polish sale after invoice status', async () => {
    mocks.getApiLanguage.mockReturnValue('pl')

    renderMenu(createSale({ BaseLifeCycleStatus: { SaleLifeCycleType: 'Packaged' } }))
    await openMenu()

    expect(screen.getByText('Видаткова накладна')).toBeTruthy()
    expect(screen.queryByText('PZ')).toBeNull()
  })

  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
  ])('gates the payment action by VAT=%s and VAT accounting=%s', async (isVatSale, withVatAccounting, isVisible) => {
    renderMenu(
      createSale({
        ClientAgreement: { Agreement: { WithVATAccounting: withVatAccounting } },
        IsVatSale: isVatSale,
      }),
    )
    await openMenu()

    const paymentAction = screen.queryByText('Рахунок на оплату')
    expect(Boolean(paymentAction)).toBe(isVisible)
  })

  it.each([false, true])('allows printing a payment invoice before the consignment note exists (VAT=%s)', async (isVatSale) => {
    renderMenu(
      createSale({
        BaseLifeCycleStatus: { SaleLifeCycleType: 'New' },
        IsVatSale: isVatSale,
        TransporterId: undefined,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Документи' }))
    const paymentAction = await screen.findByText('Рахунок на оплату')

    fireEvent.click(paymentAction)

    await waitFor(() => expect(mocks.getSalePaymentDocument).toHaveBeenCalledWith('sale-net-id', expect.any(Object)))
  })

  it('surfaces the API message when document generation fails', async () => {
    mocks.getSaleInvoiceDocument.mockRejectedValueOnce(new Error('Document generation rejected by server'))

    renderMenu()
    await openMenu()
    fireEvent.click(screen.getByText('Видаткова накладна'))

    await waitFor(() =>
      expect(mocks.notificationsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          message: 'Document generation rejected by server',
        }),
      ),
    )
  })

  it('prevents a second document request while the first one is still running', async () => {
    let resolveDocument!: (value: SaleDocumentResult) => void
    mocks.getSaleInvoiceDocument.mockReturnValueOnce(
      new Promise<SaleDocumentResult>((resolve) => {
        resolveDocument = resolve
      }),
    )

    renderMenu()
    await openMenu()

    const action = screen.getByText('Видаткова накладна')
    fireEvent.click(action)
    fireEvent.click(action)

    expect(mocks.getSaleInvoiceDocument).toHaveBeenCalledTimes(1)

    resolveDocument(documentResult)
    await waitFor(() =>
      expect(mocks.notificationsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'green',
          message: 'Документ готовий',
        }),
      ),
    )
  })

  it('reuses the payment-document operation id after a failed attempt', async () => {
    mocks.getSalePaymentDocument
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(documentResult)

    const firstView = renderMenu(
      createSale({
        ClientAgreement: { Agreement: { WithVATAccounting: true } },
        IsVatSale: true,
      }),
    )
    await openMenu()
    fireEvent.click(screen.getByText('Рахунок на оплату'))

    await waitFor(() => expect(mocks.getSalePaymentDocument).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(mocks.notificationsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Temporary failure' }),
      ),
    )

    firstView.unmount()
    renderMenu(
      createSale({
        ClientAgreement: { Agreement: { WithVATAccounting: true } },
        IsVatSale: true,
      }),
    )
    await openMenu()
    fireEvent.click(screen.getByText('Рахунок на оплату'))

    await waitFor(() => expect(mocks.getSalePaymentDocument).toHaveBeenCalledTimes(2))

    const firstOperation = mocks.getSalePaymentDocument.mock.calls[0]?.[1]
    const secondOperation = mocks.getSalePaymentDocument.mock.calls[1]?.[1]

    expect(firstOperation?.operationId).toBeTruthy()
    expect(secondOperation).toEqual(firstOperation)
  })
})
