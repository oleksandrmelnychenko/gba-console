import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../api/apiClient'
import { I18nProvider } from '../../i18n/I18nProvider'
import { InformationalMovementPanel } from './ProductMovementHistoryDrawers'
import type { InformationalMovement } from './informationalMovements'

vi.mock('../../api/apiClient', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/apiClient')>(), apiRequest: vi.fn(),
}))
vi.mock('../data-table/DataTable', () => ({
  DataTable: ({ data, emptyText, isLoading }: { data: InformationalMovement[]; emptyText: string; isLoading: boolean }) =>
    <div>{isLoading ? 'loading' : data.length ? data.map(row => <div key={row.InfoKey}>{row.DocumentNumber}</div>) : emptyText}</div>,
}))
const product = { NetUid: 'product-42', VendorCode: 'CARD-42', NameUA: 'Товар 42' }
const nextProduct = { NetUid: 'product-43', VendorCode: 'CARD-43', NameUA: 'Товар 43' }
const path = '/consignments/info/assortment/movement/informational/filtered'
function row(overrides: Partial<InformationalMovement> = {}): InformationalMovement {
  return {
    AffectsAvailability: false, CanMutate: false, IsLedgerMovement: false,
    StateCode: 'InformationalOnly', SourceItemId: 1, InfoKey: 'SHIFT_INFO:1',
    KindCode: 'ShiftWithoutPhysicalSource', ReasonCode: 'NoPhysicalSource',
    MissingEvidenceCode: 'SourceSaleMovement', QueueCode: 'ActionRequired', SeverityCode: 'Error',
    Qty: 2, TotalRows: 1, DocumentType: 'Продаж', DocumentNumber: 'SALE-1', IsKnownFixture: false,
    ProductNetUid: product.NetUid, ...overrides,
  }
}
function panel(currentProduct = product) {
  return <MemoryRouter><MantineProvider env="test"><I18nProvider>
    <InformationalMovementPanel active allowAllProducts product={currentProduct} requestPath={path} />
  </I18nProvider></MantineProvider></MemoryRouter>
}
async function select(label: string, value: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  fireEvent.click(await screen.findByRole('option', { name: value }))
}
beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue([])
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('warehouse source diagnostics', () => {
  it('defaults to the selected product, identifies it and preserves explicit all-products mode', async () => {
    render(panel())
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(path, expect.objectContaining({ query: expect.objectContaining({ productNetId: product.NetUid, offset: 0 }) })))
    expect(screen.getByText('Товар: CARD-42 · Товар 42')).toBeTruthy()
    await select('Область перевірки', 'Усі товари')
    await waitFor(() => expect(vi.mocked(apiRequest).mock.lastCall?.[1]?.query).not.toHaveProperty('productNetId'))
    expect(screen.getByText('Область перевірки: усі товари')).toBeTruthy()
  })

  it.each([null, {}, { Data: {} }, [null], [row({ CanMutate: true })], [row({ TotalRows: NaN })], [row({ ProductNetUid: 'different-product' })]])(
    'shows a failed check instead of an all-clear for malformed/wrong-scope data: %j', async response => {
      vi.mocked(apiRequest).mockResolvedValue(response)
      render(panel())
      expect(await screen.findByText(/Некоректна відповідь контролю/)).toBeTruthy()
      expect(screen.queryByText(/за вибраний період записів не знайдено/)).toBeNull()
    },
  )

  it('starts the next product at page one without requesting the old offset', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_path, options) => [row({
      TotalRows: options?.query?.productNetId === product.NetUid ? 201 : 1,
      ProductNetUid: String(options?.query?.productNetId),
      DocumentNumber: options?.query?.offset ? 'LAST-PAGE' : 'FIRST-PAGE',
    })])
    const view = render(panel())
    await screen.findByText('FIRST-PAGE')
    fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
    await screen.findByText('LAST-PAGE')
    vi.mocked(apiRequest).mockClear()
    view.rerender(panel(nextProduct))
    await screen.findByText('FIRST-PAGE')
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(path, expect.objectContaining({ query: expect.objectContaining({ productNetId: nextProduct.NetUid, offset: 0 }) }))
    expect(screen.queryByText('LAST-PAGE')).toBeNull()
  })

  it('resets pagination when switching from a selected product to all products', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_path, options) => [row({
      TotalRows: options?.query?.productNetId ? 201 : 1,
      DocumentNumber: options?.query?.offset ? 'LAST-PAGE' : 'FIRST-PAGE',
    })])
    render(panel())
    await screen.findByText('FIRST-PAGE')
    fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
    await screen.findByText('LAST-PAGE')
    vi.mocked(apiRequest).mockClear()
    await select('Область перевірки', 'Усі товари')
    await screen.findByText('FIRST-PAGE')
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(vi.mocked(apiRequest).mock.lastCall?.[1]?.query?.offset).toBe(0)
    expect(vi.mocked(apiRequest).mock.lastCall?.[1]?.query).not.toHaveProperty('productNetId')
  })

  it('recovers the first page if the last page became empty after a refresh', async () => {
    let lastPageRemoved = false
    vi.mocked(apiRequest).mockImplementation(async (_path, options) => options?.query?.offset && lastPageRemoved
      ? [] : [row({ TotalRows: 201, DocumentNumber: options?.query?.offset ? 'LAST-PAGE' : 'FIRST-PAGE' })])
    render(panel())
    await screen.findByText('FIRST-PAGE')
    fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
    await screen.findByText('LAST-PAGE')
    lastPageRemoved = true
    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
    await screen.findByText('FIRST-PAGE')
    expect(vi.mocked(apiRequest).mock.lastCall?.[1]?.query?.offset).toBe(0)
  })

  it('shows pending rows separately and describes the limited coverage even when Problems is empty', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_path, options) => options?.query?.queue === 'BusinessPending'
      ? [row({ QueueCode: 'BusinessPending', ReasonCode: 'PendingReconciliation', KindCode: 'PendingReconciliation', SeverityCode: 'Warning', DocumentNumber: 'ACT-PENDING' })] : [])
    render(panel())
    expect(await screen.findByText('У черзі «Проблеми» за вибраний період записів не знайдено')).toBeTruthy()
    expect(screen.getByText(/Це не повна звірка залишків/)).toBeTruthy()
    await select('Черга', 'Очікують дії')
    expect(await screen.findByText('ACT-PENDING')).toBeTruthy()
    expect(vi.mocked(apiRequest).mock.lastCall?.[1]?.query?.offset).toBe(0)
  })
})
