import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../api/apiClient'
import { I18nProvider } from '../../i18n/I18nProvider'
import { ProductActionDrawer } from '../../../features/products/pages/ProductDetailPage'
import type { Product } from '../../../features/products/types'
import { ProductMovementHistoryDrawer } from './ProductMovementHistoryDrawers'
import { assortmentMovementRequestPaths } from './productMovementHistoryRequestPaths'

vi.mock('../../api/apiClient', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/apiClient')>(), apiRequest: vi.fn(),
}))
vi.mock('../../../features/auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

const product = { Id: 42, NetUid: 'product-42', NameUA: 'Товар', VendorCode: 'CARD-42' } as Product
const physicalSource = {
  PublicationId: 'private-publication-1', World: 'Fenix', RecorderType: 288, RecorderId: 'private-recorder-1',
  LineNumber: 1, BatchValueType: '08', BatchTable: '00000115', BatchId: 'private-batch-1',
}
const base = {
  Id: null, NetUid: null, PhysicalSource: physicalSource, ValuationKnown: false,
  DocumentNumber: 'PHYSICAL-42', IncomeToStorageNumber: 'PHYSICAL-42', DocumentType: 'Видатковий ордер',
  DocumentTypeName: 'Видатковий ордер', DocumentFromDate: '2026-10-19T09:00:00Z',
  FromDate: '2026-10-19T09:00:00Z', IncomeToStorageDate: '2026-10-19T09:00:00Z',
  StorageName: 'СКЛАД -3', IncomeQty: -0.00000001, OutcomeQty: -0.00000001, Qty: -0.00000001,
  Price: 99999, AccountingPrice: 99999, AccountingGrossPrice: 99999, GrossPrice: 99999,
  ManagementEurUnitPrice: 99999, AccountingEurUnitPrice: 99999, NetPrice: 99999,
  TotalNetPrice: 99999, ExchangeRate: 99999, UnitPriceLocal: 99999, ReturnPrice: 99999,
  PriceDifference: 99999, Discount: 99999, Currency: 'UNCONFIRMED', RemainingQty: 0,
  PhysicalSourceCostEur: null, PhysicalSourceVatEur: null,
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
  vi.mocked(apiRequest).mockReset().mockResolvedValue([])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function show(panel: 'income' | 'outcome' | 'movement' | 'detail', row: object) {
  const path = assortmentMovementRequestPaths[panel === 'detail' ? 'movement' : panel]
  vi.mocked(apiRequest).mockImplementation(async requestPath => requestPath === path ? [row] : [])
  return render(<MemoryRouter><MantineProvider env="test"><I18nProvider>
    {panel === 'detail'
      ? <ProductActionDrawer activePanel="movement" product={product} onClose={vi.fn()} onProductSaved={vi.fn()} onReload={vi.fn()} />
      : <ProductMovementHistoryDrawer opened initialTab={panel} product={product} requestPaths={assortmentMovementRequestPaths} onClose={vi.fn()} />}
  </I18nProvider></MantineProvider></MemoryRouter>)
}

async function physicalRow() {
  const caption = await screen.findByText('PHYSICAL-42')
  const row = caption.closest('tr')!
  const table = row.closest('table')!
  expect(row).toBeTruthy()
  await waitFor(() => expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(0))
  const cell = (label: string) => {
    const index = within(table).getAllByRole('columnheader').findIndex(header => header.textContent?.trim() === label)
    expect(index, `column ${label}`).toBeGreaterThanOrEqual(0)
    // Expand controls have an aria-hidden header; use native cellIndex to keep alignment.
    const header = within(table).getAllByRole('columnheader')[index] as HTMLTableCellElement
    return (row as HTMLTableRowElement).cells[header.cellIndex]!
  }
  return { row, cell }
}

describe('physical movements in real product tables', () => {
  it.each(['income', 'outcome', 'movement', 'detail'] as const)('%s preserves quantities but hides unconfirmed money, source metadata and native document navigation', async panel => {
    show(panel, base)
    const { row, cell } = await physicalRow()
    expect(cell('Собівартість руху, EUR').textContent).toBe('—')
    expect(cell('ПДВ руху, EUR').textContent).toBe('—')
    expect(within(row).getAllByText('Складський рух').length).toBeGreaterThan(0)
    expect(within(row).getAllByText('-0,00000001').length).toBeGreaterThan(0)
    expect(row.textContent).not.toMatch(/999|UNCONFIRMED|private-publication|private-recorder|private-batch/)
    expect(within(row).queryByRole('link')).toBeNull()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it.each(['income', 'outcome', 'movement', 'detail'] as const)('%s distinguishes an explicitly confirmed zero cost from unavailable VAT', async panel => {
    show(panel, { ...base, ValuationKnown: true, PhysicalSourceCostEur: 0 })
    const { row, cell } = await physicalRow()
    expect(cell('Собівартість руху, EUR').textContent).toBe('0')
    expect(cell('ПДВ руху, EUR').textContent).toBe('—')
    expect(row.textContent).not.toMatch(/999|UNCONFIRMED/)
  })
})
