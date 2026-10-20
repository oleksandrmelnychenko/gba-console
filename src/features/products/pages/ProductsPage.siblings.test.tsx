import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getProductByNetId,
  getProductIncomeMovements,
  getProductOutcomeMovements,
  getProductReservationByNetId,
  getProductSiblingCounts,
  getProductSiblings,
  getProducts,
} from '../api/productsApi'
import type {
  Product,
  ProductIncomeMovement,
  ProductOutcomeMovement,
  ProductSiblingCard,
  ProductSiblingCardRef,
  ProductSiblingGroup,
} from '../types'

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
    getProductSiblingCounts: vi.fn(),
    getProductSiblings: vi.fn(),
    getProducts: vi.fn(),
  }
})

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('./ProductDetailPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ProductDetailPage')>()

  return {
    ...actual,
    ProductActionDrawer: ({ activePanel, siblingCards }: { activePanel: string | null; siblingCards?: ProductSiblingCard[] }) => (
      activePanel ? <output data-testid="active-product-panel">{`${activePanel}:${siblingCards?.length ?? 0}`}</output> : null
    ),
  }
})

import { ProductsPage } from './ProductsPage'

const currentNetId = '37d7acb3-ad54-4d86-8f94-d5c2aff6ad6a'
const siblingNetId = 'f43233de-1889-4a52-923e-fca071adcfa3'

const currentProduct: Product = {
  Id: 38060322,
  NameUA: 'Ступица колеса',
  NetUid: currentNetId,
  ProductAvailabilities: [{ Amount: 6, ProductId: 38060322, Storage: { Id: 2968, Name: 'СКЛАД -3' }, StorageId: 2968 }],
  SourceAmgCode: 382707,
  SourceFenixCode: 382707,
  VendorCode: '0701000260-MG',
}

const siblingProduct: Product = {
  Id: 38286393,
  NameUA: 'Ступица колеса',
  NetUid: siblingNetId,
  ProductAvailabilities: [],
  SourceAmgCode: 464929,
  SourceFenixCode: null,
  VendorCode: '0701000260-MG',
}

function cardRef(productNetId: string, currentProductNetId: string): ProductSiblingCardRef {
  const isFenixCard = productNetId === currentNetId

  return {
    IsCurrent: productNetId === currentProductNetId,
    Name: 'Ступица колеса',
    ProductId: isFenixCard ? 38060322 : 38286393,
    ProductNetId: productNetId,
    SourceAmgCode: isFenixCard ? 382707 : 464929,
    SourceFenixCode: isFenixCard ? 382707 : null,
    VendorCode: '0701000260-MG',
  }
}

function siblingGroup(productNetId: string): ProductSiblingGroup {
  return {
    Cards: [
      {
        ...cardRef(currentNetId, productNetId),
        Availabilities: [{ Amount: 6, OrganizationName: 'ТОВ «АМГ «КОНКОРД»', StorageId: 2968, StorageName: 'СКЛАД -3' }],
        LastActivityAt: '2026-08-06T10:04:41',
        SalesCount: 0,
        SoldQty: 0,
        StockQty: 6,
      },
      {
        ...cardRef(siblingNetId, productNetId),
        Availabilities: [],
        LastActivityAt: null,
        SalesCount: 3,
        SoldQty: 4,
        StockQty: 0,
      },
    ],
    ProductNetId: productNetId,
  }
}

const getProductByNetIdMock = vi.mocked(getProductByNetId)
const getProductIncomeMovementsMock = vi.mocked(getProductIncomeMovements)
const getProductOutcomeMovementsMock = vi.mocked(getProductOutcomeMovements)
const getProductSiblingCountsMock = vi.mocked(getProductSiblingCounts)
const getProductSiblingsMock = vi.mocked(getProductSiblings)
const getProductsMock = vi.mocked(getProducts)

beforeEach(() => {
  getProductByNetIdMock.mockReset().mockImplementation(async (netId) => (netId === siblingNetId ? siblingProduct : currentProduct))
  vi.mocked(getProductReservationByNetId).mockReset().mockResolvedValue({})
  getProductSiblingsMock.mockReset().mockImplementation(async (netId) => siblingGroup(netId))
  getProductSiblingCountsMock.mockReset().mockResolvedValue([])
  getProductsMock.mockReset().mockResolvedValue([])
  getProductIncomeMovementsMock.mockReset().mockImplementation(async (params) => (params.includeSiblings
    ? [
        { Card: cardRef(currentNetId, currentNetId), IncomeQty: 6, IncomeToStorageNumber: 'FX-6', NetUid: 'income-fenix' },
        { Card: cardRef(siblingNetId, currentNetId), IncomeQty: 4, IncomeToStorageNumber: 'AMG-4', NetUid: 'income-amg' },
      ]
    : [{ IncomeQty: 6, IncomeToStorageNumber: 'FX-6', NetUid: 'income-fenix' }]) as ProductIncomeMovement[])
  getProductOutcomeMovementsMock.mockReset().mockImplementation(async (params) => (params.includeSiblings
    ? [{ Card: cardRef(siblingNetId, currentNetId), DocumentNumber: 'AMG-SALE-1', NetUid: 'outcome-amg', Qty: 4 }]
    : []) as ProductOutcomeMovement[])
})

function LocationProbe() {
  const location = useLocation()

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderProductsPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MantineProvider>
        <I18nProvider>
          <ProductsPage />
          <LocationProbe />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

function tableHeaders(): string[] {
  const table = document.querySelector('.product-inline-tab-pane table')

  return Array.from(table?.querySelectorAll('thead th') ?? []).map((header) => header.textContent?.trim() || '')
}

describe('ProductsPage sibling cards', () => {
  it('shows the other card of the acceptance article with combined stock and sold quantity', async () => {
    renderProductsPage(`/products?netId=${currentNetId}`)

    const notice = await screen.findByRole('group', { name: 'Картки артикула' })

    expect(within(notice).getByText('Цей артикул має ще 1 картку')).toBeTruthy()
    expect(notice.textContent).toContain('Разом: залишок 6 · продано 4')

    const currentOption = within(notice).getByRole('radio', { name: /AMG 382707 · Fenix 382707/ }) as HTMLInputElement
    const siblingOption = within(notice).getByRole('radio', { name: /AMG 464929/ }) as HTMLInputElement

    expect(currentOption.checked).toBe(true)
    expect(siblingOption.checked).toBe(false)
    expect(within(notice).getByText('AMG 382707 · Fenix 382707').closest('.product-sibling-card-option')?.textContent).toContain('залишок 6 · продано 0')
    expect(within(notice).getByText('AMG 464929').closest('.product-sibling-card-option')?.textContent).toContain('залишок 0 · продано 4')

    const combinedTile = screen.getByText('Разом на складах').parentElement as HTMLElement
    const warehouseTotalTile = screen.getByText('Всього').parentElement as HTMLElement

    expect(combinedTile.textContent).toContain('6')
    expect(warehouseTotalTile.textContent).toContain('6')
    expect(getProductSiblingsMock).toHaveBeenCalledWith(currentNetId, expect.any(AbortSignal))
  })

  it('opens the selected sibling card through the product route', async () => {
    renderProductsPage(`/products?netId=${currentNetId}`)

    const notice = await screen.findByRole('group', { name: 'Картки артикула' })

    fireEvent.click(within(notice).getByRole('radio', { name: /AMG 464929/ }))

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/products?netId=${siblingNetId}`))
    await waitFor(() => expect(getProductByNetIdMock.mock.calls.some(([netId]) => netId === siblingNetId)).toBe(true))
    await waitFor(() => {
      const nextNotice = screen.getByRole('group', { name: 'Картки артикула' })
      expect((within(nextNotice).getByRole('radio', { name: /AMG 464929/ }) as HTMLInputElement).checked).toBe(true)
    })
  })

  it('passes the sibling cards to the product movement drawer', async () => {
    renderProductsPage(`/products?netId=${currentNetId}`)

    await screen.findByRole('group', { name: 'Картки артикула' })
    fireEvent.click(screen.getByRole('button', { name: 'Ще' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Рух товару' }))

    expect((await screen.findByTestId('active-product-panel')).textContent).toBe('movement:2')
  })

  it('keeps the card without siblings unchanged', async () => {
    getProductSiblingsMock.mockImplementation(async (netId) => ({ Cards: [], ProductNetId: netId }))

    renderProductsPage(`/products?netId=${currentNetId}`)

    await screen.findByText('Всього')
    await waitFor(() => expect(getProductSiblingsMock).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Прихід' }))
    await screen.findByText('FX-6')

    expect(screen.queryByRole('group', { name: 'Картки артикула' })).toBeNull()
    expect(screen.queryByText('Разом на складах')).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Картки' })).toBeNull()
    expect(tableHeaders()).not.toContain('Картка')
    expect(getProductIncomeMovementsMock).toHaveBeenCalledTimes(1)
    expect(getProductIncomeMovementsMock.mock.calls[0][0]).not.toHaveProperty('includeSiblings')
  })

  it('hides the sibling notice when the siblings request fails', async () => {
    getProductSiblingsMock.mockRejectedValue(new Error('offline'))

    renderProductsPage(`/products?netId=${currentNetId}`)

    await screen.findByText('Всього')
    await waitFor(() => expect(getProductSiblingsMock).toHaveBeenCalled())

    expect(screen.queryByRole('group', { name: 'Картки артикула' })).toBeNull()
    expect(screen.queryByText('Разом на складах')).toBeNull()
  })

  it.each([
    {
      expectedSiblingText: '0701000260-MG · AMG 464929',
      load: getProductIncomeMovementsMock,
      tab: 'Прихід',
      waitForCardRows: 'AMG-4',
    },
    {
      expectedSiblingText: '0701000260-MG · AMG 464929',
      load: getProductOutcomeMovementsMock,
      tab: 'Розхід',
      waitForCardRows: 'AMG-SALE-1',
    },
  ])('loads all cards in the $tab tab with the «Разом» toggle and names each row card', async ({ expectedSiblingText, load, tab, waitForCardRows }) => {
    renderProductsPage(`/products?netId=${currentNetId}`)

    await screen.findByRole('group', { name: 'Картки артикула' })
    fireEvent.click(screen.getByRole('button', { name: tab }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    expect(load.mock.calls[0][0]).toEqual({ from: expect.any(String), productNetId: currentNetId, to: expect.any(String) })
    expect(load.mock.calls[0][0]).not.toHaveProperty('includeSiblings')

    const scope = screen.getByRole('radiogroup', { name: 'Картки' })

    expect((within(scope).getByRole('radio', { name: 'Ця картка' }) as HTMLInputElement).checked).toBe(true)
    expect(tableHeaders()).not.toContain('Картка')

    fireEvent.click(within(scope).getByRole('radio', { name: 'Разом' }))

    await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({
      includeSiblings: true,
      productNetId: currentNetId,
    })))
    await screen.findByText(waitForCardRows)

    expect(tableHeaders()[0]).toBe('Картка')
    expect(screen.getByText(expectedSiblingText).closest('.product-sibling-card-cell')?.getAttribute('data-current')).toBeNull()
    expect((screen.getByRole('button', { name: 'Друк PDF' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(within(scope).getByRole('radio', { name: 'Ця картка' }))

    await waitFor(() => expect(load).toHaveBeenCalledTimes(3))
    expect(load.mock.calls[2][0]).not.toHaveProperty('includeSiblings')
    await waitFor(() => expect(tableHeaders()).not.toContain('Картка'))
    expect((screen.getByRole('button', { name: 'Друк PDF' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('marks the current card distinctly in merged income rows', async () => {
    renderProductsPage(`/products?netId=${currentNetId}`)

    await screen.findByRole('group', { name: 'Картки артикула' })
    fireEvent.click(screen.getByRole('button', { name: 'Прихід' }))
    fireEvent.click(within(await screen.findByRole('radiogroup', { name: 'Картки' })).getByRole('radio', { name: 'Разом' }))

    const currentCell = (await screen.findByText('0701000260-MG · AMG 382707 · Fenix 382707')).closest('.product-sibling-card-cell') as HTMLElement
    const siblingCell = screen.getByText('0701000260-MG · AMG 464929').closest('.product-sibling-card-cell') as HTMLElement

    expect(currentCell.dataset.current).toBe('true')
    expect(within(currentCell).getByText('ця картка')).toBeTruthy()
    expect(currentCell.querySelector('.app-table-chip')?.classList.contains('is-product')).toBe(true)
    expect(siblingCell.dataset.current).toBeUndefined()
    expect(siblingCell.querySelector('.app-table-chip')?.classList.contains('is-neutral')).toBe(true)
  })
})

describe('ProductsPage search sibling markers', () => {
  const searchProducts: Product[] = [
    { Id: 38060322, NameUA: 'Ступица колеса', NetUid: currentNetId, VendorCode: '0701000260-MG' },
    { Id: 2, NameUA: 'Підшипник', NetUid: 'aaaaaaaa-0000-4000-8000-000000000002', VendorCode: 'BRG-2' },
    { Id: 3, NameUA: 'Сальник', NetUid: 'aaaaaaaa-0000-4000-8000-000000000003', VendorCode: 'SEAL-3' },
  ]

  async function searchFor(value: string) {
    renderProductsPage('/products')
    fireEvent.change(screen.getByLabelText('Введіть товар'), { target: { value } })
    await screen.findByText('BRG-2')
  }

  it('returns to focused search with Escape and accepts pasted text', async () => {
    getProductsMock.mockResolvedValue(searchProducts)
    const user = userEvent.setup()
    renderProductsPage(`/products?netId=${currentNetId}`)
    await screen.findByRole('group', { name: 'Картки артикула' })
    expect(screen.queryByLabelText('Введіть товар')).toBeNull()

    await user.keyboard('{Escape}')
    const input = screen.getByLabelText('Введіть товар') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    await user.paste('BRG-2')

    expect(input.value).toBe('BRG-2')
    await waitFor(() => expect(getProductsMock).toHaveBeenLastCalledWith(expect.objectContaining({ value: 'BRG-2' })))
  })

  it('keeps pasted search text focused when the previous query resolves during debounce', async () => {
    let resolvePrevious!: (products: Product[]) => void
    const previousRequest = new Promise<Product[]>((resolve) => { resolvePrevious = resolve })
    getProductsMock.mockReturnValueOnce(previousRequest)
    getProductsMock.mockResolvedValue(searchProducts)
    const user = userEvent.setup()
    renderProductsPage('/products')
    const input = screen.getByLabelText('Введіть товар') as HTMLInputElement

    await user.click(input)
    await user.paste('0701000260')
    await waitFor(() => expect(getProductsMock).toHaveBeenCalledTimes(1))
    await user.clear(input)
    await user.paste('BRG-2')

    await act(async () => { resolvePrevious([currentProduct]) })

    expect(screen.getByLabelText('Введіть товар')).toBe(input)
    expect(input.value).toBe('BRG-2')
    expect(document.activeElement).toBe(input)
    await waitFor(() => expect(getProductsMock).toHaveBeenLastCalledWith(expect.objectContaining({ value: 'BRG-2' })))
  })

  it('completes search when the draft returns to the previous query before debounce', async () => {
    let resolveSearch!: (products: Product[]) => void
    getProductsMock.mockReturnValueOnce(new Promise<Product[]>((resolve) => { resolveSearch = resolve }))
    getProductsMock.mockResolvedValue(searchProducts)
    renderProductsPage('/products')
    const input = screen.getByLabelText('Введіть товар')
    fireEvent.change(input, { target: { value: 'BRG-2' } })
    await waitFor(() => expect(getProductsMock).toHaveBeenCalledTimes(1))

    act(() => {
      fireEvent.change(input, { target: { value: 'SEAL-3' } })
      fireEvent.change(input, { target: { value: 'BRG-2' } })
    })
    await act(async () => { resolveSearch(searchProducts) })

    await screen.findByText('BRG-2')
    expect(getProductsMock.mock.calls.every(([params]) => params.value === 'BRG-2')).toBe(true)
  })

  it('keeps an in-flight result valid when editing only surrounding search whitespace', async () => {
    let resolveSearch!: (products: Product[]) => void
    getProductsMock.mockReturnValueOnce(new Promise<Product[]>((resolve) => { resolveSearch = resolve }))
    renderProductsPage('/products')
    const input = screen.getByLabelText('Введіть товар')
    fireEvent.change(input, { target: { value: 'BRG-2' } })
    await waitFor(() => expect(getProductsMock).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { value: 'BRG-2 ' } })

    await act(async () => { resolveSearch(searchProducts) })

    expect(screen.getByText('BRG-2')).toBeTruthy()
    expect(getProductsMock).toHaveBeenCalledTimes(1)
  })

  it('marks only the search results reported by the counts endpoint', async () => {
    getProductsMock.mockResolvedValue(searchProducts)
    getProductSiblingCountsMock.mockResolvedValue([{ ProductNetId: currentNetId.toUpperCase(), SiblingCount: 1 }])

    await searchFor('07010')

    const marker = await screen.findByText('2 картки')
    const markedRow = marker.closest('.product-carousel-row') as HTMLElement

    expect(markedRow.textContent).toContain('0701000260-MG')
    expect(marker.closest('.app-table-chip')?.getAttribute('title')).toBe('Є ще 1 картка')
    expect(document.querySelectorAll('.product-carousel-sibling-marker')).toHaveLength(1)
    expect(getProductSiblingCountsMock).toHaveBeenCalledTimes(1)
    expect(getProductSiblingCountsMock).toHaveBeenCalledWith(searchProducts.map((product) => product.NetUid))
  })

  it('hides the markers when the counts request fails without hiding the results', async () => {
    getProductsMock.mockResolvedValue(searchProducts)
    getProductSiblingCountsMock.mockRejectedValue(new Error('offline'))

    await searchFor('07010')
    await waitFor(() => expect(getProductSiblingCountsMock).toHaveBeenCalled())

    expect(screen.getByText('0701000260-MG')).toBeTruthy()
    expect(screen.getByText('SEAL-3')).toBeTruthy()
    expect(document.querySelectorAll('.product-carousel-sibling-marker')).toHaveLength(0)
  })
})
