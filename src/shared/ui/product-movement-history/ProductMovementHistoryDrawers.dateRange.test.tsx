import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const product = { Id: 42, NetUid: 'product-42', NameUA: 'Товар з історією', VendorCode: 'CARD-42' } as Product
const rows = {
  income: { IncomeToStorageNumber: 'INCOME-2020', IncomeToStorageDate: '2020-07-13T09:00:00', IncomeQty: 2, RemainingQty: 2 },
  outcome: { DocumentNumber: 'OUTCOME-2020', FromDate: '2020-07-13T10:00:00', Qty: 2 },
  movement: { DocumentNumber: 'MOVEMENT-2020', DocumentFromDate: '2020-07-13T09:00:00', DocumentType: 'Прихід', IncomeQty: 2 },
}
beforeEach(() => { vi.mocked(apiRequest).mockReset().mockResolvedValue([]) })
afterEach(cleanup)

describe('product movement panels applied date ranges', () => {
  it.each(['income', 'outcome', 'movement', 'detail'] as const)('%s keeps drafts local and requests/displays the applied same-day pre-2025 interval', async panel => {
    const kind = panel === 'detail' ? 'movement' : panel
    const path = assortmentMovementRequestPaths[kind]
    vi.mocked(apiRequest).mockImplementation(async (requestPath, options) =>
      requestPath === path && options?.query?.from === '2020-07-13' ? [rows[kind]] : [])
    render(<MemoryRouter><MantineProvider env="test"><I18nProvider>
      {panel === 'detail'
        ? <ProductActionDrawer activePanel="movement" product={product} onClose={vi.fn()} onProductSaved={vi.fn()} onReload={vi.fn()} />
        : <ProductMovementHistoryDrawer opened initialTab={panel} product={product} requestPaths={assortmentMovementRequestPaths} onClose={vi.fn()} />}
    </I18nProvider></MantineProvider></MemoryRouter>)
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(path, expect.anything()))
    vi.mocked(apiRequest).mockClear()
    const open = () => fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: /^Період:/ }))
    open()
    const date = (label: string) => within(screen.getByRole('dialog', { name: 'Період' })).getByLabelText(label) as HTMLInputElement
    const firstFrom = (date('З') as HTMLInputElement).value
    const firstTo = (date('По') as HTMLInputElement).value
    expect((date('З') as HTMLInputElement).min).toBe('1900-01-01')
    expect((date('По') as HTMLInputElement).max).toBe('9999-12-30')
    fireEvent.change(date('З'), { target: { value: '' } })
    expect((screen.getByRole('button', { name: 'Застосувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(date('З'), { target: { value: '2099-01-01' } })
    expect((screen.getByRole('button', { name: 'Застосувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(date('З'), { target: { value: '2020-07-13' } })
    fireEvent.change(date('По'), { target: { value: '2020-07-13' } })
    expect(apiRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    expect(apiRequest).not.toHaveBeenCalled()
    open()
    expect((date('З') as HTMLInputElement).value).toBe(firstFrom)
    expect((date('По') as HTMLInputElement).value).toBe(firstTo)
    fireEvent.change(date('З'), { target: { value: '2020-07-13' } })
    fireEvent.change(date('По'), { target: { value: '2020-07-13' } })
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledExactlyOnceWith(path, expect.objectContaining({
      query: expect.objectContaining({ productNetId: 'product-42', from: '2020-07-13', to: '2020-07-13' }),
    })))
    expect(await screen.findByText(`${kind.toUpperCase()}-2020`)).toBeTruthy()
  })
})
