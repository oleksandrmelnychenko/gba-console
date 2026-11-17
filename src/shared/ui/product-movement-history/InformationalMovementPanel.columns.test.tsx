import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../api/apiClient'
import { I18nProvider } from '../../i18n/I18nProvider'
import { InformationalMovementPanel } from './ProductMovementHistoryDrawers'

vi.mock('../../api/apiClient', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/apiClient')>(), apiRequest: vi.fn(),
}))
vi.mock('../data-table/DataTable', () => ({
  DataTable: ({ columns }: { columns: Array<{ id: string; header: ReactNode }> }) =>
    <div>{columns.map((column) => <span key={column.id} data-testid={`header-${column.id}`}>{column.header}</span>)}</div>,
}))

it('labels the source id column of «Контроль даних» in Ukrainian', async () => {
  vi.mocked(apiRequest).mockResolvedValue([])
  Element.prototype.scrollIntoView = vi.fn()
  render(<MemoryRouter><MantineProvider env="test"><I18nProvider>
    <InformationalMovementPanel active allowAllProducts product={{ NetUid: 'product-42', VendorCode: 'CARD-42', NameUA: 'Товар 42' }}
      requestPath="/consignments/info/assortment/movement/informational/filtered" />
  </I18nProvider></MantineProvider></MemoryRouter>)

  expect((await screen.findByTestId('header-sourceId')).textContent).toBe('ID джерела')
  expect(screen.queryByText('Source ID')).toBeNull()
})
