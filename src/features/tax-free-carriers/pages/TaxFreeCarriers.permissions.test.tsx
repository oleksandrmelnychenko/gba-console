import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  deleteTaxFreeCarrier,
  exportTaxFreeCarriersDocument,
  getTaxFreeCarrier,
  getTaxFreeCarriers,
} from '../api/taxFreeCarriersApi'
import type { TaxFreeCarrier } from '../types'
import { TaxFreeCarrierFormPage } from './TaxFreeCarrierFormPage'
import { TaxFreeCarriersPage } from './TaxFreeCarriersPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/taxFreeCarriersApi', () => ({
  createTaxFreeCarrier: vi.fn(),
  deleteTaxFreeCarrier: vi.fn(),
  exportTaxFreeCarriersDocument: vi.fn(),
  getTaxFreeCarrier: vi.fn(),
  getTaxFreeCarriers: vi.fn(),
  searchTaxFreeCarriers: vi.fn(),
  updateTaxFreeCarrier: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => (
    opened ? <section>{children}{footer}</section> : null
  ),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section>{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

type TestColumn = {
  cell?: (row: TaxFreeCarrier) => ReactNode
  id: string
}

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    onRowClick,
  }: {
    columns: TestColumn[]
    data: TaxFreeCarrier[]
    onRowClick?: (row: TaxFreeCarrier) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <div key={row.NetUid || index}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(row)}>
            {row.LastName || row.NetUid}
          </button>
          {columns.filter((column) => column.id === 'actions').map((column) => (
            <div key={column.id}>{column.cell?.(row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const CARRIER: TaxFreeCarrier = {
  FirstName: 'Іван',
  LastName: 'Коваль',
  NetUid: 'carrier-1',
  StathamCars: [{ Number: 'AA 0001 AA', Volume: 10 }],
  StathamPassports: [],
}

function LocationProbe() {
  return <div>PATH:{useLocation().pathname}</div>
}

function renderRegistry() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/tax-free/carriers/all']}>
          <Routes>
            <Route path="/tax-free/carriers/all" element={<TaxFreeCarriersPage />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

function renderForm(path: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/tax-free/carriers/new" element={<TaxFreeCarrierFormPage />} />
            <Route path="/tax-free/carriers/edit/:id" element={<TaxFreeCarrierFormPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Tax Free carrier canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getTaxFreeCarriers).mockResolvedValue([CARRIER])
    vi.mocked(getTaxFreeCarrier).mockResolvedValue(CARRIER)
    vi.mocked(exportTaxFreeCarriersDocument).mockResolvedValue({ PdfDocumentURL: '/carriers.pdf' })
  })

  it('keeps create, edit, delete and export hidden with page access alone', async () => {
    renderRegistry()

    const row = await screen.findByRole('button', { name: 'Коваль' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редагування Перевізника' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завантажити' })).toBeNull()
  })

  it('opens create and edit routes only with their independent rights', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeCarriers.Carrier.Create)
    renderRegistry()
    fireEvent.click(await screen.findByRole('button', { name: 'Додати' }))
    expect(screen.getByText('PATH:/tax-free/carriers/new')).toBeTruthy()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.TaxFreeCarriers.Carrier.Edit)
    renderRegistry()
    fireEvent.click(await screen.findByRole('button', { name: 'Коваль' }))
    expect(screen.getByText('PATH:/tax-free/carriers/edit/carrier-1')).toBeTruthy()
  })

  it('deletes only through the independent confirmed delete right', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeCarriers.Carrier.Delete)
    renderRegistry()

    fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Видалити' })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(deleteTaxFreeCarrier).toHaveBeenCalledWith('carrier-1'))
  })

  it('exports only with the independent export right', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeCarriers.Document.Export)
    renderRegistry()

    fireEvent.click(await screen.findByRole('button', { name: 'Завантажити' }))

    await waitFor(() => expect(exportTaxFreeCarriersDocument).toHaveBeenCalledOnce())
  })

  it('does not hydrate create or edit forms without the matching action right', () => {
    const editRender = renderForm('/tax-free/carriers/edit/carrier-1')
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getTaxFreeCarrier).not.toHaveBeenCalled()
    editRender.unmount()

    renderForm('/tax-free/carriers/new')
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getTaxFreeCarrier).not.toHaveBeenCalled()
  })

  it('hydrates edit only after the edit right is assigned', async () => {
    allowedPermissions.add(PermissionKeys.TaxFreeCarriers.Carrier.Edit)
    renderForm('/tax-free/carriers/edit/carrier-1')

    await waitFor(() => expect(getTaxFreeCarrier).toHaveBeenCalledWith('carrier-1'))
    expect(await screen.findByDisplayValue('Коваль')).toBeTruthy()
  })
})
