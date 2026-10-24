import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductByNetId, updateProductPlacements } from '../api/productsApi'
import type { Product } from '../types'
import { ProductStockSummary } from './ProductDetailPage'

const permission = vi.hoisted(() => ({ edit: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => permission.edit }) }))
vi.mock('../api/productsApi', async importOriginal => ({
  ...await importOriginal<typeof import('../api/productsApi')>(),
  getProductByNetId: vi.fn(), updateProductPlacements: vi.fn(),
}))
const netId = '11111111-1111-4111-8111-111111111445'
function product(free = 50, qty = 195, identity = netId): Product {
  return { Id: 1445, NetUid: identity, ProductAvailabilities: [{ StorageId: 2968, ProductId: 1445, Amount: free, Storage: {
    Id: 2968, Name: 'Test warehouse', ProductPlacements: [{ Id: 1, StorageId: 2968, ProductId: 1445, StorageNumber: '4', RowNumber: '4', CellNumber: '4', Qty: qty }],
  } }] }
}
function ui(value = product()) {
  return <MemoryRouter><MantineProvider env="test"><I18nProvider><ProductStockSummary product={value} reservation={{ TotalReservedUK: 145 }} reservationError={null} /></I18nProvider></MantineProvider></MemoryRouter>
}
const entry = () => screen.getByRole('button', { name: 'Test warehouse: Місця зберігання' })
async function open() { fireEvent.click(entry()); return screen.findByRole('button', { name: 'Оновити розміщення' }) }
beforeEach(() => { vi.clearAllMocks(); permission.edit = true; vi.mocked(getProductByNetId).mockResolvedValue(product()); vi.mocked(updateProductPlacements).mockResolvedValue([]) })

describe('fresh product placements', () => {
  it('distinguishes available stock from recorded placements and fetches on every opening', async () => {
    render(ui()); await open()
    expect(screen.getByText('Вільно на складі: 50')).toBeTruthy()
    expect(screen.getByText('Кількість за розміщеннями: 195')).toBeTruthy()
    expect(getProductByNetId).toHaveBeenCalledWith(netId, expect.any(AbortSignal))
    fireEvent.click(entry())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Оновити розміщення' })).toBeNull())
    vi.mocked(getProductByNetId).mockResolvedValue(product(30, 175))
    await open()
    expect(screen.getByText('Вільно на складі: 30')).toBeTruthy()
    expect(screen.getByText('Кількість за розміщеннями: 175')).toBeTruthy()
    expect(getProductByNetId).toHaveBeenCalledTimes(2)
  })
  it('hides editing until a fresh request succeeds and retries failures', async () => {
    vi.mocked(getProductByNetId).mockRejectedValueOnce(new Error('Unavailable'))
    render(ui()); fireEvent.click(entry())
    await screen.findByText(/Редагування недоступне/)
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    await screen.findByRole('button', { name: 'Редагувати' })
    expect(getProductByNetId).toHaveBeenCalledTimes(2)
  })
  it('ignores and aborts a late response after closing and reopening', async () => {
    let resolve!: (value: Product | null) => void
    const promise = new Promise<Product | null>(done => { resolve = done })
    const old = { promise, resolve }
    vi.mocked(getProductByNetId).mockReturnValueOnce(old.promise)
    render(ui()); fireEvent.click(entry())
    expect(screen.getByRole('status').textContent).toContain('Оновлення розміщень')
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    const signal = vi.mocked(getProductByNetId).mock.calls[0][1]
    fireEvent.click(entry()); await open()
    await act(async () => { old.resolve(product(999, 999)); await old.promise })
    expect(signal?.aborted).toBe(true)
    expect(screen.getByText('Кількість за розміщеннями: 195')).toBeTruthy()
    expect(screen.queryByText(/999/)).toBeNull()
  })
  it('supports keyboard opening and an empty fresh placement list', async () => {
    const empty = product(); empty.ProductAvailabilities![0].Storage!.ProductPlacements = []
    vi.mocked(getProductByNetId).mockResolvedValue(empty)
    render(ui(empty)); fireEvent.keyDown(entry(), { key: 'Enter' })
    await screen.findByText('Розміщення не записані')
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.getByText('Кількість за розміщеннями: 0')).toBeTruthy()
  })
  it('does not replace a missing warehouse with zero or allow stale edits', async () => {
    vi.mocked(getProductByNetId).mockResolvedValue({ NetUid: netId, ProductAvailabilities: [] })
    render(ui()); fireEvent.click(entry())
    await screen.findByText(/Склад більше не доступний/)
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByText('Кількість за розміщеннями: 0')).toBeNull()
  })
  it('preserves permission checks after successful refresh', async () => {
    permission.edit = false; render(ui()); await open()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.getByText('Кількість за розміщеннями: 195')).toBeTruthy()
  })
  it('keeps the placed quantity invariant rather than reducing it to free stock', async () => {
    render(ui()); await open(); fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    expect(screen.queryByRole('button', { name: 'Оновити розміщення' })).toBeNull()
    const dialog = screen.getByRole('dialog', { name: /Місця зберігання$/ })
    fireEvent.change(within(dialog).getByDisplayValue('195'), { target: { value: '50' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    expect(await screen.findByText('Сума кількості по місцях має збігатися з кількістю за розміщеннями до редагування')).toBeTruthy()
    expect(updateProductPlacements).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByDisplayValue('50'), { target: { value: '195' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateProductPlacements).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateProductPlacements).mock.calls[0][0].reduce((sum, p) => sum + (p.Qty ?? 0), 0)).toBe(195)
  })
  it('unmounts the previous product request before showing another product', async () => {
    let resolve!: (value: Product | null) => void
    const pending = new Promise<Product | null>(done => { resolve = done })
    vi.mocked(getProductByNetId).mockReturnValueOnce(pending)
    const view = render(ui()); fireEvent.click(entry())
    const signal = vi.mocked(getProductByNetId).mock.calls[0][1]
    const next = product(20, 40, '22222222-2222-4222-8222-222222221445')
    view.rerender(ui(next))
    vi.mocked(getProductByNetId).mockResolvedValue(next)
    await open()
    await act(async () => { resolve(product(999, 999)); await pending })
    expect(signal?.aborted).toBe(true)
    expect(screen.getByText('Кількість за розміщеннями: 40')).toBeTruthy()
    expect(screen.queryByText(/999/)).toBeNull()
  })
  it('blocks editing when an explicit refresh fails after a successful read', async () => {
    render(ui()); await open()
    vi.mocked(getProductByNetId).mockRejectedValueOnce(new Error('Unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити розміщення' }))
    await screen.findByText(/Редагування недоступне/)
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByText('Кількість за розміщеннями: 195')).toBeNull()
  })

})
