import { MantineProvider } from '@mantine/core'
import { act, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ProductActionDrawer, type ProductDetailPanel } from './ProductDetailPage'
import { getProductAuditEntities, getProductConsignmentRemainings, getProductStorageLocationHistory, getProductMovements } from '../api/productsApi'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/productsApi', async original => ({ ...await original<typeof import('../api/productsApi')>(),
  getProductAuditEntities: vi.fn(), getProductConsignmentRemainings: vi.fn(), getProductStorageLocationHistory: vi.fn(), getProductMovements: vi.fn(),
}))
beforeEach(() => vi.resetAllMocks())

it.each([
  ['audit', getProductAuditEntities, 2], ['remains', getProductConsignmentRemainings, 1],
  ['storage-history', getProductStorageLocationHistory, 1], ['movement', getProductMovements, 1],
] as const)('retires the %s read on close and ignores a late result', async (panel, load, signalIndex) => {
  let finish!: (value: never[]) => void
  vi.mocked(load).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = (activePanel: ProductDetailPanel | null) => <MantineProvider><I18nProvider><MemoryRouter>
    <ProductActionDrawer activePanel={activePanel} product={{ NetUid: 'product', VendorCode: 'CODE' }} onClose={() => {}} onProductSaved={() => {}} onReload={() => {}} />
  </MemoryRouter></I18nProvider></MantineProvider>
  const { rerender } = render(view(panel))
  await waitFor(() => expect(load).toHaveBeenCalledOnce())
  const signal = vi.mocked(load).mock.calls[0][signalIndex] as AbortSignal
  rerender(view(null))
  expect(signal.aborted).toBe(true)
  await act(async () => finish([]))
})
