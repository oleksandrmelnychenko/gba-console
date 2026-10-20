// @ts-expect-error The app build excludes Node types; Vitest runs this test in Node.
import { readFileSync } from 'node:fs'
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
import type { Product, ProductIncomeMovement, ProductOutcomeMovement } from '../types'

const productStyles = readFileSync('src/features/products/pages/products.css', 'utf8')
const tableStyles = readFileSync('src/shared/ui/data-table/data-table.css', 'utf8')

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
  it('loads the whole receipt history by default so old lots that hold stock are listed', async () => {
    await openIncomeTab()

    expect(getProductIncomeMovementsMock).toHaveBeenCalledWith(expect.objectContaining({ from: '2000-01-01' }))
  })

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

describe('ProductsPage income receipt number', () => {
  it('shows the stored 1C receipt number when the AMG data is not resolved', async () => {
    getProductIncomeMovementsMock.mockResolvedValue([
      {
        ...incomeMovement,
        ExchangeRate: 0,
        ImportedSourceMetadataResolved: false,
        IncomeToStorageNumber: '00000000532',
        NetPrice: 6.79,
      },
      {
        ...incomeMovement,
        ExchangeRate: 0,
        ImportedSourceMetadataResolved: false,
        IncomeToStorageNumber: undefined,
        NetPrice: 7.01,
      },
    ])

    await openIncomeTab()

    const table = screen.getByText('Ціна нетто за одиницю, EUR').closest('table')
    const headers = Array.from(table?.querySelectorAll('thead th') ?? [])
    const numberColumn = headers.findIndex((header) => header.textContent?.includes('Номер приходу'))
    const rateColumn = headers.findIndex((header) => header.textContent?.includes('Курс'))
    const rows = Array.from(table?.querySelectorAll('tbody tr') ?? [])
    const storedRow = rows.find((row) => row.textContent?.includes('6,79'))
    const missingRow = rows.find((row) => row.textContent?.includes('7,01'))

    expect(numberColumn).toBeGreaterThanOrEqual(0)
    expect(storedRow?.querySelectorAll('td')[numberColumn]?.textContent).toBe('00000000532')
    expect(storedRow?.querySelectorAll('td')[rateColumn]?.textContent).toBe('')
    expect(missingRow?.querySelectorAll('td')[numberColumn]?.textContent).toBe('Дані AMG не визначені')
  })
})

describe('ProductsPage inline movement table width', () => {
  it.each(['Прихід', 'Розхід'] as const)('keeps the %s table inside a bounded horizontal scroll area', async (tab) => {
    await openIncomeTab()
    if (tab === 'Розхід') {
      fireEvent.click(screen.getByRole('button', { name: tab }))
      await waitFor(() => expect(vi.mocked(getProductOutcomeMovements)).toHaveBeenCalled())
    }

    const table = document.querySelector('.product-inline-tab-pane .data-table-table')
    const scrollArea = table?.closest('.data-table-scroll') as HTMLElement | null
    const pane = table?.closest('.product-inline-tab-pane') as HTMLElement | null
    const movements = table?.closest('.product-inline-movements') as HTMLElement | null
    const body = table?.closest('.product-inline-movement-body') as HTMLElement | null

    expect(table).not.toBeNull()
    expect(scrollArea).not.toBeNull()
    expect(scrollArea?.style.maxHeight).toBe('360px')
    expect(pane).not.toBeNull()
    expect(movements).not.toBeNull()
    expect(body).not.toBeNull()
    expect(productStyles).toMatch(/\.product-inline-tab-pane\s*\{[^}]*min-width:\s*0\s*;/)
    expect(productStyles).toMatch(/\.product-inline-movements\s*\{[^}]*max-width:\s*100%\s*;/)
    expect(productStyles).toMatch(/\.product-inline-movement-body\s*\{[^}]*max-width:\s*100%\s*;/)
    expect(table?.textContent).toContain(tab === 'Прихід' ? 'Ціна нетто за одиницю, EUR' : 'Кількість')
    expect(scrollArea?.parentElement?.querySelector(':scope > .data-table-sticky-scrollbar')).not.toBeNull()
  })

  it.each([
    { viewportWidth: 1560, shouldScroll: true },
    { viewportWidth: 2200, shouldScroll: false },
  ])('renders the Розхід columns with horizontal overflow=$shouldScroll at $viewportWidth px', async ({ viewportWidth, shouldScroll }) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table-scroll') ? viewportWidth : 0
    })
    vi.mocked(getProductOutcomeMovements).mockResolvedValue([{
      DocumentNumber: 'CH0000001',
      DocumentTypeName: 'Видаткова накладна',
      Price: 90.20,
      Qty: 1,
    }])

    await openIncomeTab()
    fireEvent.click(screen.getByRole('button', { name: 'Розхід' }))
    await screen.findByText('CH0000001')

    const scrollArea = document.querySelector('.product-inline-tab-pane .data-table-scroll') as HTMLElement
    const table = scrollArea.querySelector('table') as HTMLTableElement

    await waitFor(() => expect(table.style.width).not.toBe(''))
    expect(Number.parseInt(table.style.width, 10) > scrollArea.clientWidth).toBe(shouldScroll)
    expect(table.textContent).toContain('Кількість')

    expect(scrollArea.closest('.product-outcome-scroll-frame')).toBeNull()
    expect(scrollArea.closest('.product-inline-movement-body')?.classList.contains('is-outcome')).toBe(true)
    expect(table.querySelector('tbody tr td:last-child')?.textContent).toBe('1')
  })
})

describe('BUG-1276 product outcome bottom control', () => {
  const netId = '4dbbcd95-ac69-441e-9150-611d842bdef7'
  const movementRows: ProductOutcomeMovement[] = [
    { DocumentNumber: 'КОк00001761', FromDate: '2026-10-20T18:00:36.5666667', Price: 16.13924, Qty: 25 },
    { DocumentNumber: 'КОк00000635', FromDate: '2026-10-07T13:17:03', Price: 16.00857699805068, Qty: 1 },
    { DocumentNumber: 'КСн00003079', FromDate: '2026-09-30T11:09:17', Price: 16.39941860465116, Qty: 1 },
    { DocumentNumber: 'КСн00002327', FromDate: '2026-09-23T10:20:54', Price: 15.13998082454458, Qty: 1 },
    { DocumentNumber: 'КСн00002248', FromDate: '2026-09-22T15:03:17', Price: 15.53365292425695, Qty: 1 },
  ].map((row) => ({
    ...row,
    DocumentTypeName: 'Видаткова накладна',
    OrganizationName: 'ТОВ «АМГ «КОНКОРД»',
    StorageName: 'СКЛАД -3',
  }))

  it.each([1, 5])('keeps a larger control for %i visible rows and reaches the last quantity', async (rowCount) => {
    const positions = new WeakMap<Element, number>()
    const tableHeight = 34 + rowCount * 45 + 18
    const scrollWidth = (element: HTMLElement) => Number.parseFloat(element.querySelector('table')?.style.width || '1900')
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table-scroll') ? 1610 : 1919
    })
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table-scroll') ? tableHeight - 18 : 950
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table-scroll') ? tableHeight : 950
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table-scroll') ? scrollWidth(this) : 1919
    })
    vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockImplementation(function (this: Element) {
      return positions.get(this) ?? 0
    })
    vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(function (this: Element, value: number) {
      const max = this.classList.contains('data-table-scroll') ? scrollWidth(this as HTMLElement) - 1610 : Infinity
      positions.set(this, Math.min(Math.max(0, value), max))
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('data-table-scroll')) return new DOMRect(263, 400, 1610, tableHeight)
      if (this.classList.contains('data-table-sticky-scrollbar')) {
        return new DOMRect(Number.parseFloat(this.style.left) || 0, Number.parseFloat(this.style.top) || 0, 0, 0)
      }
      return new DOMRect(0, 0, 1919, 950)
    })
    getProductByNetIdMock.mockResolvedValue({ ...product, NetUid: netId, VendorCode: '0106040-VDN', NameUA: 'Патрубок компресора' })
    vi.mocked(getProductOutcomeMovements).mockResolvedValue(movementRows.slice(0, rowCount))

    await openIncomeTab(netId)
    fireEvent.click(screen.getByRole('button', { name: 'Розхід' }))
    fireEvent.change(screen.getByLabelText('З'), { target: { value: '2026-09-20' } })
    fireEvent.change(screen.getByLabelText('По'), { target: { value: '2026-10-20' } })
    await screen.findByText('КОк00001761')
    expect(getProductOutcomeMovements).toHaveBeenLastCalledWith({ from: '2026-09-20', to: '2026-10-20', productNetId: netId })

    const scroll = document.querySelector<HTMLElement>('.product-inline-tab-pane .data-table-scroll')!
    const table = scroll.querySelector('table')!
    const bar = screen.getByRole('region', { name: 'Горизонтальна прокрутка таблиці' })
    await waitFor(() => expect(bar.dataset.visible).toBe('true'))
    expect(bar.style.height).toBe('18px')
    expect(scroll.parentElement?.dataset.stickyHorizontalScrollbar).toBe('true')
    expect(tableStyles).toMatch(/\.data-table\[data-sticky-horizontal-scrollbar\] > \.data-table-scroll\s*\{[^}]*scrollbar-width:\s*auto\s*;/)
    expect(tableStyles).toMatch(/\.data-table\[data-sticky-horizontal-scrollbar\] > \.data-table-scroll\s*\{[^}]*scrollbar-gutter:\s*auto\s*;/)
    expect(tableStyles).toMatch(/\.data-table-sticky-scrollbar::-webkit-scrollbar\s*\{[^}]*height:\s*18px\s*;/)
    expect(table.querySelectorAll('thead th')).toHaveLength(9)
    expect(table.querySelectorAll('tbody tr')).toHaveLength(rowCount)
    const firstRow = table.querySelector('tbody tr')!
    expect(firstRow.querySelector('td:nth-last-child(2)')?.textContent).toBe('16,14')
    expect(firstRow.querySelector('td:last-child')?.textContent).toBe('25')

    fireEvent.keyDown(bar, { key: 'End' })
    expect(scroll.scrollLeft).toBe(scroll.scrollWidth - scroll.clientWidth)
    expect(scroll.scrollLeft).toBeGreaterThan(0)
    const columnsWidth = Array.from(table.querySelectorAll('col')).reduce((sum, column) => sum + Number.parseFloat(column.style.width), 0)
    expect(columnsWidth - scroll.scrollLeft).toBe(scroll.clientWidth)
    expect(bar.scrollLeft).toBe(scroll.scrollLeft)
    fireEvent.keyDown(bar, { key: 'Home' })
    expect(scroll.scrollLeft).toBe(0)
    expect(bar.scrollLeft).toBe(0)
    expect(getProductByNetIdMock).toHaveBeenLastCalledWith(netId, expect.any(AbortSignal))
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
    fireEvent.change(within(toolbar).getByLabelText('З'), { target: { value: '2026-08-01' } })
    await waitFor(() => expect(getProductIncomeMovementsMock).toHaveBeenCalledTimes(2))
    expect(within(toolbar).getByRole('button', { name: 'Колонки' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Друк PDF' }))

    await act(async () => resolveRows([incomeMovement]))
    const dialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(within(dialog).getByText('Зачекайте, файл формується')).toBeTruthy()

    await act(async () => resolveExport({ PdfDocumentURL: 'https://example.com/movement.pdf' }))
    expect(await within(dialog).findByRole('link', { name: /PDF/ })).toBeTruthy()
    expect(window.open).not.toHaveBeenCalled()
  })
})

async function openIncomeTab(netId = product.NetUid!) {
  render(
    <MemoryRouter initialEntries={[`/products?netId=${netId}`]}>
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
