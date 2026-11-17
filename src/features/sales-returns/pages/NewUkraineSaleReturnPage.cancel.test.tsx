import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { NewUkraineSaleReturnPage } from './NewUkraineSaleReturnPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
const granted = vi.hoisted(() => new Set<string>())
vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (key: string) => granted.has(key),
    cannot: (key: string) => !granted.has(key),
    isLoading: false,
    permissions: [],
  }),
}))
vi.mock('../../products/components/ProductCardModal', () => ({ ProductCardModal: () => null }))
vi.mock('../../sales-ukraine/persistentSalesMutation', () => ({
  usePersistentSalesMutation: () => vi.fn(),
  SalesPendingMutationRecoveredError: class extends Error {},
}))
// jsdom gives the real table no width, so it would not render the action column; render every cell.
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data }: { columns: Array<{ id: string; cell?: (row: unknown) => ReactNode }>; data: unknown[] }) => (
    <div>
      {data.map((row, index) => (
        <div key={index}>{columns.map((column) => <span key={column.id}>{column.cell?.(row)}</span>)}</div>
      ))}
    </div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  granted.clear()
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === '/sales/returns/all/filtered') {
      return [{ NetUid: '6c0e7b0e-5d33-4b8e-9a59-2f0d5a3c1a01', Number: 'QAU0000000007', IsCanceled: false }]
    }
    return []
  })
})

function renderPage() {
  render(<MantineProvider><I18nProvider><NewUkraineSaleReturnPage /></I18nProvider></MantineProvider>)
}

it('does not offer cancel to a role without the return-cancel key', async () => {
  renderPage()

  expect(await screen.findByRole('button', { name: 'Експорт' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull()
})

it('offers cancel with the key and asks on one line', async () => {
  granted.add(PermissionKeys.SalesUkraine.Sale.CancelReturn)
  renderPage()

  fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))
  expect(await screen.findByText('Скасувати повернення QAU0000000007?')).toBeTruthy()
})
