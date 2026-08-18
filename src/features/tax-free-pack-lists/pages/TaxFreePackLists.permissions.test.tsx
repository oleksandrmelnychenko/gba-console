import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  deleteTaxFreePackList,
  exportTaxFreePackLists,
  getOrganizations,
  getSupplierClients,
  getTaxFreePackLists,
} from '../api/taxFreePackListsApi'
import type { TaxFreePackList } from '../types'
import { TaxFreePackListsPage } from './TaxFreePackListsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/taxFreePackListsApi', () => ({
  createSupplyOrderFromPackList: vi.fn(),
  deleteTaxFreePackList: vi.fn(),
  exportTaxFreePackLists: vi.fn(),
  getOrganizations: vi.fn(),
  getSupplierClients: vi.fn(),
  getTaxFreePackLists: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../components/TaxFreePrintDocumentModal', () => ({
  TaxFreePrintDocumentModal: () => null,
}))

type TestColumn = {
  cell?: (row: TaxFreePackList) => ReactNode
  id: string
}

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, onRowClick }: {
    columns: TestColumn[]
    data: TaxFreePackList[]
    onRowClick?: (row: TaxFreePackList) => void
  }) => (
    <div>
      {data.map((row) => (
        <div key={row.NetUid}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(row)}>{row.Number}</button>
          {columns.filter((column) => column.id === 'actions').map((column) => (
            <div key={column.id}>{column.cell?.(row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const PACK_LIST: TaxFreePackList = {
  IsSent: true,
  NetUid: 'pack-list-1',
  Number: 'PL-1',
  TaxFrees: [],
}

function LocationProbe() {
  return <div>PATH:{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/tax-free/pack-list/all']}>
          <Routes>
            <Route path="/tax-free/pack-list/all" element={<TaxFreePackListsPage />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Tax Free pack-list canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getTaxFreePackLists).mockResolvedValue({ items: [PACK_LIST], totalQty: 1 })
    vi.mocked(getOrganizations).mockResolvedValue([])
    vi.mocked(getSupplierClients).mockResolvedValue([])
    vi.mocked(exportTaxFreePackLists).mockResolvedValue({ PdfDocumentURL: '/pack-lists.pdf' })
  })

  it('keeps row actions, export and create dictionaries inactive without rights', async () => {
    renderPage()

    const row = await screen.findByRole('button', { name: 'PL-1' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Переглянути' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завантажити' })).toBeNull()
    expect(getOrganizations).not.toHaveBeenCalled()
    expect(getSupplierClients).not.toHaveBeenCalled()
  })

  it('opens details only with open-details permission', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreePackLists.PackList.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'PL-1' }))
    const viewButtons = screen.getAllByRole('button', { name: 'Переглянути' })
    fireEvent.click(viewButtons[viewButtons.length - 1])
    expect(screen.getByText('PATH:/tax-free/pack-list/edit/pack-list-1')).toBeTruthy()
  })

  it('deletes only after independent delete confirmation', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreePackLists.PackList.Delete)
    vi.mocked(getTaxFreePackLists).mockResolvedValue({
      items: [{ ...PACK_LIST, IsSent: false }],
      totalQty: 1,
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Видалити' })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(deleteTaxFreePackList).toHaveBeenCalledWith('pack-list-1'))
  })

  it('exports only with independent export permission', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreePackLists.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Завантажити' }))
    await waitFor(() => expect(exportTaxFreePackLists).toHaveBeenCalledOnce())
  })

  it('loads create dictionaries only after create permission and modal open', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreePackLists.SupplyOrder.Create)
    renderPage()

    expect(getOrganizations).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'PL-1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити замовлення в Україну' }))

    await waitFor(() => expect(getOrganizations).toHaveBeenCalledOnce())
    expect(getSupplierClients).toHaveBeenCalledOnce()
  })
})
