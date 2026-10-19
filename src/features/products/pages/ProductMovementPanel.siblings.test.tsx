import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductMovements } from '../api/productsApi'
import type { Product, ProductMovement, ProductSiblingCard, ProductSiblingCardRef } from '../types'

vi.mock('../api/productsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productsApi')>()

  return {
    ...actual,
    exportProductMovementsDocument: vi.fn(),
    getProductMovements: vi.fn(),
  }
})

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

import { ProductActionDrawer, ProductStockSummary } from './ProductDetailPage'

const currentNetId = '37d7acb3-ad54-4d86-8f94-d5c2aff6ad6a'
const siblingNetId = 'f43233de-1889-4a52-923e-fca071adcfa3'

const product: Product = {
  Id: 38060322,
  NameUA: 'Ступица колеса',
  NetUid: currentNetId,
  VendorCode: '0701000260-MG',
}

const fenixCardRef: ProductSiblingCardRef = {
  IsCurrent: true,
  ProductId: 38060322,
  ProductNetId: currentNetId,
  SourceAmgCode: 382707,
  SourceFenixCode: 382707,
  VendorCode: '0701000260-MG',
}

const amgCardRef: ProductSiblingCardRef = {
  IsCurrent: false,
  ProductId: 38286393,
  ProductNetId: siblingNetId,
  SourceAmgCode: 464929,
  SourceFenixCode: null,
  VendorCode: '0701000260-MG',
}

const siblingCards: ProductSiblingCard[] = [
  { ...fenixCardRef, Availabilities: [], SoldQty: 0, StockQty: 6 },
  { ...amgCardRef, Availabilities: [], SoldQty: 4, StockQty: 0 },
]

const getProductMovementsMock = vi.mocked(getProductMovements)

beforeEach(() => {
  getProductMovementsMock.mockReset().mockImplementation(async (params) => (params.includeSiblings
    ? [
        { Card: fenixCardRef, DocumentNumber: 'FX-IN', IncomeQty: 6, NetUid: 'movement-fenix' },
        { Card: amgCardRef, DocumentNumber: 'AMG-SALE', NetUid: 'movement-amg', OutcomeQty: 4 },
      ]
    : [{ DocumentNumber: 'FX-IN', IncomeQty: 6, NetUid: 'movement-fenix' }]) satisfies ProductMovement[])
})

function renderWithProviders(children: ReactNode) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>{children}</I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

function renderMovementDrawer(cards?: ProductSiblingCard[]) {
  return renderWithProviders(
    <ProductActionDrawer
      activePanel="movement"
      product={product}
      siblingCards={cards}
      onClose={vi.fn()}
      onProductSaved={vi.fn()}
      onReload={vi.fn()}
    />,
  )
}

function movementHeaders(): string[] {
  const table = document.querySelector('.product-movement-sheet table')

  return Array.from(table?.querySelectorAll('thead th') ?? []).map((header) => header.textContent?.trim() || '')
}

describe('product movement drawer with sibling cards', () => {
  it('reloads the movement with all sibling cards and names the card of each row', async () => {
    renderMovementDrawer(siblingCards)

    await screen.findByText('FX-IN')
    expect(getProductMovementsMock).toHaveBeenCalledTimes(1)
    expect(getProductMovementsMock.mock.calls[0][0]).not.toHaveProperty('includeSiblings')
    expect(movementHeaders()).not.toContain('Картка')

    const scope = screen.getByRole('radiogroup', { name: 'Картки' })
    fireEvent.click(within(scope).getByRole('radio', { name: 'Разом' }))

    await waitFor(() => expect(getProductMovementsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      includeSiblings: true,
      productNetId: currentNetId,
    })))
    await screen.findByText('AMG-SALE')

    expect(movementHeaders()).toContain('Картка')
    expect(screen.getByText('0701000260-MG · AMG 464929').closest('.product-sibling-card-cell')?.getAttribute('data-current')).toBeNull()
    expect(screen.getByText('0701000260-MG · AMG 382707 · Fenix 382707').closest('.product-sibling-card-cell')?.getAttribute('data-current')).toBe('true')
    expect((screen.getByRole('button', { name: 'Друк PDF' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it.each([
    ['without sibling cards', undefined],
    ['with only the current card', [siblingCards[0]]],
  ])('keeps the movement unchanged %s', async (_label, cards) => {
    renderMovementDrawer(cards)

    await screen.findByText('FX-IN')

    expect(screen.queryByRole('radiogroup', { name: 'Картки' })).toBeNull()
    expect(movementHeaders()).not.toContain('Картка')
    expect(getProductMovementsMock).toHaveBeenCalledTimes(1)
    expect(getProductMovementsMock.mock.calls[0][0]).toEqual({
      from: expect.any(String),
      movementType: 0,
      productNetId: currentNetId,
      to: expect.any(String),
      types: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    })
    expect((screen.getByRole('button', { name: 'Друк PDF' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('product stock summary with sibling cards', () => {
  const stockProduct: Product = {
    ...product,
    ProductAvailabilities: [{ Amount: 6, ProductId: 38060322, Storage: { Id: 2968, Name: 'СКЛАД -3' }, StorageId: 2968 }],
  }

  it('adds the combined stock of all cards next to the warehouse total', () => {
    renderWithProviders(<ProductStockSummary combinedStockQty={6} product={stockProduct} reservation={{}} reservationError={null} />)

    expect((screen.getByText('Всього').parentElement as HTMLElement).textContent).toContain('6')
    expect((screen.getByText('Разом на складах').parentElement as HTMLElement).textContent).toContain('6')
  })

  it('does not show the combined stock without sibling cards', () => {
    renderWithProviders(<ProductStockSummary product={stockProduct} reservation={{}} reservationError={null} />)

    expect(screen.getByText('Всього')).toBeTruthy()
    expect(screen.queryByText('Разом на складах')).toBeNull()
  })
})
