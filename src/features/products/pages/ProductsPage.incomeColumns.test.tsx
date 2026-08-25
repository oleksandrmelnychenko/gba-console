import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getProductByNetId,
  getProductIncomeMovements,
  getProductReservationByNetId,
  getProducts,
} from '../api/productsApi'
import type { Product, ProductIncomeMovement } from '../types'

vi.mock('../api/productsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productsApi')>()

  return {
    ...actual,
    getProductByNetId: vi.fn(),
    getProductIncomeMovements: vi.fn(),
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
  getProductByNetIdMock.mockReset()
  getProductIncomeMovementsMock.mockReset()
  getProductReservationByNetIdMock.mockReset()
  getProductsMock.mockReset()

  getProductByNetIdMock.mockResolvedValue(product)
  getProductIncomeMovementsMock.mockResolvedValue([incomeMovement])
  getProductReservationByNetIdMock.mockResolvedValue({})
  getProductsMock.mockResolvedValue([])
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
