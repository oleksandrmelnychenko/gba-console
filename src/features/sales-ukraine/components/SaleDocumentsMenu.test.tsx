import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SaleDocumentResult, SalesUkraineSale } from '../types'
import { SaleDocumentsMenu } from './SaleDocumentsMenu'

const mocks = vi.hoisted(() => ({
  getApiLanguage: vi.fn(() => 'uk'),
  getSaleActForEditingHistoryDocument: vi.fn(),
  getSaleInvoiceDocument: vi.fn(),
  getSaleInvoiceHistoryDocument: vi.fn(),
  getSalePaymentDocument: vi.fn(),
  getSalePzDocument: vi.fn(),
  getSaleShipmentListDocument: vi.fn(),
  getSaleShipmentListHistoryDocument: vi.fn(),
  notificationsShow: vi.fn(),
  notificationsUpdate: vi.fn(),
}))

vi.mock('../../../shared/api/apiClient', () => ({
  getApiLanguage: mocks.getApiLanguage,
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: mocks.notificationsShow,
    update: mocks.notificationsUpdate,
  },
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: undefined }),
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
    mocks.getApiLanguage.mockReturnValue('uk')
    mocks.getSaleActForEditingHistoryDocument.mockResolvedValue(documentResult)
    mocks.getSaleInvoiceDocument.mockResolvedValue(documentResult)
    mocks.getSaleInvoiceHistoryDocument.mockResolvedValue(documentResult)
    mocks.getSalePaymentDocument.mockResolvedValue(documentResult)
    mocks.getSalePzDocument.mockResolvedValue(documentResult)
    mocks.getSaleShipmentListDocument.mockResolvedValue(documentResult)
    mocks.getSaleShipmentListHistoryDocument.mockResolvedValue(documentResult)
  })

  afterEach(() => {
    cleanup()
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
})
