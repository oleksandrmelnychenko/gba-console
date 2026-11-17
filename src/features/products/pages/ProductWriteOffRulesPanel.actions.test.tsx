import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  addOrUpdateProductWriteOffRule,
  deleteProductWriteOffRule,
  getProductGroupsByProductNetId,
  getProductWriteOffRulesByProductNetId,
} from '../api/productsApi'
import { ProductActionDrawer } from './ProductDetailPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data }: { columns: Array<{ id: string; cell?: (row: unknown) => ReactNode }>; data: unknown[] }) => (
    <div>{data.map((row, index) => <div key={index}>{columns.find((column) => column.id === 'actions')?.cell?.(row)}</div>)}</div>
  ),
}))
vi.mock('../api/productsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productsApi')>(),
  addOrUpdateProductWriteOffRule: vi.fn(),
  deleteProductWriteOffRule: vi.fn(),
  getProductGroupsByProductNetId: vi.fn(),
  getProductWriteOffRulesByProductGroupNetId: vi.fn(),
  getProductWriteOffRulesByProductNetId: vi.fn(),
}))

function renderPanel() {
  render(<MemoryRouter><MantineProvider><I18nProvider>
    <ProductActionDrawer activePanel="writeoff" product={{ Id: 101, NetUid: 'product-101', VendorCode: 'V-1' }}
      onClose={vi.fn()} onProductSaved={vi.fn()} onReload={vi.fn()} />
  </I18nProvider></MantineProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.mocked(getProductGroupsByProductNetId).mockResolvedValue([])
  vi.mocked(getProductWriteOffRulesByProductNetId).mockResolvedValue([{ NetUid: 'rule-1', RuleLocale: 'uk', RuleType: 0 }])
  vi.mocked(deleteProductWriteOffRule).mockReset().mockResolvedValue(undefined)
  vi.mocked(addOrUpdateProductWriteOffRule).mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

it('asks in the console dialog (not window.confirm) and deletes nothing when the user declines', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  renderPanel()
  fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))

  expect(await screen.findByText('Видалити правило списання «Списати по вазі»?')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(deleteProductWriteOffRule).not.toHaveBeenCalled()

  // The app-wide click guard releases the button once the first handler settles.
  await act(async () => {})
  fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[0])
  await screen.findByText('Видалити правило списання «Списати по вазі»?')
  const dialogButtons = screen.getAllByRole('button', { name: 'Видалити' })
  fireEvent.click(dialogButtons[dialogButtons.length - 1])

  await waitFor(() => expect(deleteProductWriteOffRule).toHaveBeenCalledWith('rule-1'))
  expect(confirm).not.toHaveBeenCalled()
})

it('sends one rule for a double click on Додати', async () => {
  vi.mocked(addOrUpdateProductWriteOffRule).mockImplementation(() => new Promise(() => {}))
  renderPanel()
  await screen.findByRole('button', { name: 'Видалити' })
  const add = screen.getByRole('button', { name: 'Додати' })
  fireEvent.click(add)
  fireEvent.click(add)
  expect(addOrUpdateProductWriteOffRule).toHaveBeenCalledTimes(1)
})
