import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductIncomeMovementsDocument,
  exportProductOutcomeMovementsDocument,
  getProductByNetId,
  getProductIncomeMovements,
  getProductOutcomeMovements,
  getProductReservationByNetId,
  getProducts,
} from '../api/productsApi'
import type { Product, ProductIncomeMovement } from '../types'

vi.mock('../api/productsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productsApi')>()

  return {
    ...actual,
    exportProductIncomeMovementsDocument: vi.fn(),
    exportProductOutcomeMovementsDocument: vi.fn(),
    getProductByNetId: vi.fn(),
    getProductIncomeMovements: vi.fn(),
    getProductOutcomeMovements: vi.fn(),
    getProductReservationByNetId: vi.fn(),
    getProducts: vi.fn(),
  }
})

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('./ProductDetailPage', () => ({
  PRODUCT_BALANCES_PERMISSION: 'balances',
  PRODUCT_EDIT_PERMISSION: 'edit',
  PRODUCT_MOVEMENT_PERMISSION: 'movement',
  PRODUCT_WRITE_OFF_PERMISSION: 'writeoff',
  ProductActionDrawer: () => null,
  ProductImageViewerModal: () => null,
  ProductStockSummary: () => null,
}))

import { ProductsPage } from './ProductsPage'

const product = {
  Id: 42,
  NameUA: 'Тестовий товар',
  NetUid: 'product-42',
  VendorCode: 'TEST-42',
} as Product

const incomeMovement = {
  AccountingGrossPrice: 142.04,
  GrossPrice: 22.04,
  IncomeQty: 6,
  NetPrice: 3.06,
  TotalNetPrice: 18.36,
} satisfies ProductIncomeMovement

const getProductByNetIdMock = vi.mocked(getProductByNetId)
const getProductIncomeMovementsMock = vi.mocked(getProductIncomeMovements)
const getProductReservationByNetIdMock = vi.mocked(getProductReservationByNetId)
const getProductsMock = vi.mocked(getProducts)

beforeEach(() => {
  vi.spyOn(window, 'open').mockReturnValue(null)
  vi.mocked(exportProductIncomeMovementsDocument).mockReset()
  vi.mocked(exportProductOutcomeMovementsDocument).mockReset()
  vi.mocked(getProductOutcomeMovements).mockReset().mockResolvedValue([])
  getProductByNetIdMock.mockReset()
  getProductIncomeMovementsMock.mockReset()
  getProductReservationByNetIdMock.mockReset()
  getProductsMock.mockReset()

  getProductByNetIdMock.mockResolvedValue(product)
  getProductIncomeMovementsMock.mockResolvedValue([incomeMovement])
  getProductReservationByNetIdMock.mockResolvedValue({})
  getProductsMock.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProductsPage income price columns', () => {
  it('replaces the English and mixed-language headings with Ukrainian terms', async () => {
    await openIncomeTab()

    expect(screen.getByText('Ціна нетто за одиницю, EUR')).toBeTruthy()
    expect(screen.getByText('Сума нетто приходу, EUR')).toBeTruthy()
    expect(screen.getByText('Управлінська собівартість приходу, EUR')).toBeTruthy()
    expect(screen.getByText('Бухгалтерська собівартість приходу, EUR')).toBeTruthy()

    expect(screen.queryByText('Net')).toBeNull()
    expect(screen.queryByText('Total Net')).toBeNull()
    expect(screen.queryByText('Gross')).toBeNull()
    expect(screen.queryByText('Бух. Gross')).toBeNull()
  })

  it('keeps every displayed amount under its explained Ukrainian heading', async () => {
    await openIncomeTab()

    const firstHeading = screen.getByText('Ціна нетто за одиницю, EUR')
    const table = firstHeading.closest('table')
    const headers = Array.from(table?.querySelectorAll('thead th') ?? [])
    const dataRow = Array.from(table?.querySelectorAll('tbody tr') ?? [])
      .find((row) => row.textContent?.includes('3,06'))

    expect(table).toBeTruthy()
    expect(dataRow).toBeDefined()

    const cells = Array.from(dataRow?.querySelectorAll('td') ?? [])
    const expectedColumns = [
      ['Ціна нетто за одиницю, EUR', '3,06'],
      ['Сума нетто приходу, EUR', '18,36'],
      ['Управлінська собівартість приходу, EUR', '22,04'],
      ['Бухгалтерська собівартість приходу, EUR', '142,04'],
    ] as const

    for (const [heading, value] of expectedColumns) {
      const columnIndex = headers.findIndex((header) => header.textContent?.includes(heading))

      expect(columnIndex).toBeGreaterThanOrEqual(0)
      expect(cells[columnIndex]?.textContent).toContain(value)
    }
  })
})

describe('ProductsPage movement exports', () => {
  it.each([
    ['Прихід', exportProductIncomeMovementsDocument],
    ['Розхід', exportProductOutcomeMovementsDocument],
  ] as const)('offers Excel and PDF in a modal for %s', async (tabLabel, exportDocument) => {
    vi.mocked(exportDocument).mockResolvedValue({
      DocumentURL: 'https://example.com/movement.xlsx',
      PdfDocumentURL: 'https://example.com/movement.pdf',
    })

    await openIncomeTab()
    if (tabLabel !== 'Прихід') {
      fireEvent.click(screen.getByRole('button', { name: tabLabel }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Друк PDF' }))

    const dialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(await within(dialog).findByRole('link', { name: /Excel/ })).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: /PDF/ })).toBeTruthy()
    expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ productNetId: 'product-42' }))
    expect(window.open).not.toHaveBeenCalled()
  })

  it('keeps the export modal loading when a movement refresh finishes', async () => {
    let resolveExport!: (document: { PdfDocumentURL: string }) => void
    let resolveRows!: (rows: ProductIncomeMovement[]) => void
    vi.mocked(exportProductIncomeMovementsDocument).mockReturnValue(new Promise((resolve) => {
      resolveExport = resolve
    }))

    await openIncomeTab()
    getProductIncomeMovementsMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveRows = resolve
    }))
    const toolbar = screen.getByRole('button', { name: 'Друк PDF' }).closest('.product-movement-toolbar') as HTMLElement
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Оновити' }))
    await waitFor(() => expect(getProductIncomeMovementsMock).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Друк PDF' }))

    await act(async () => resolveRows([incomeMovement]))
    const dialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(within(dialog).getByText('Зачекайте, файл формується')).toBeTruthy()

    await act(async () => resolveExport({ PdfDocumentURL: 'https://example.com/movement.pdf' }))
    expect(await within(dialog).findByRole('link', { name: /PDF/ })).toBeTruthy()
    expect(window.open).not.toHaveBeenCalled()
  })
})

async function openIncomeTab() {
  render(
    <MemoryRouter initialEntries={['/products?netId=product-42']}>
      <MantineProvider>
        <I18nProvider>
          <ProductsPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )

  fireEvent.click(await screen.findByRole('button', { name: 'Прихід' }))

  await screen.findByText('Ціна нетто за одиницю, EUR')
}
