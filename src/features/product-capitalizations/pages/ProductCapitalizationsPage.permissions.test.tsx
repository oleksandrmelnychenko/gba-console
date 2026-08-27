import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductCapitalization,
  getProductCapitalization,
  getProductCapitalizations,
} from '../api/productCapitalizationsApi'
import type { ProductCapitalization } from '../types'
import { ProductCapitalizationsPage } from './ProductCapitalizationsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productCapitalizationsApi', () => ({
  exportProductCapitalization: vi.fn(),
  getProductCapitalization: vi.fn(),
  getProductCapitalizations: vi.fn(),
}))

vi.mock('../components/NewProductCapitalizationPanel', () => ({
  NewProductCapitalizationPanel: ({ canCreate, opened }: { canCreate: boolean; opened: boolean }) => (
    opened && canCreate ? <section>Форма нового оприбуткування</section> : null
  ),
}))

vi.mock('../../../shared/documents/openExportDocument', () => ({
  closePendingExportDocumentWindow: vi.fn(),
  openExportDocumentInWindow: vi.fn(() => true),
  openPendingExportDocumentWindow: vi.fn(() => ({})),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section>{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

type TestColumn = {
  cell?: (row: ProductCapitalization) => ReactNode
  id: string
}

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    onRowClick,
  }: {
    columns: TestColumn[]
    data: ProductCapitalization[]
    onRowClick?: (row: ProductCapitalization) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <div key={row.NetUid || index}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(row)}>
            {row.Number || row.NetUid || `row-${index}`}
          </button>
          {columns.filter((column) => column.id === 'actions').map((column) => (
            <div key={column.id}>{column.cell?.(row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const CAPITALIZATION: ProductCapitalization = {
  NetUid: 'capitalization-1',
  Number: 'CAP-1',
  ProductCapitalizationItems: [],
}

function renderPage(initialEntry = '/products/capitalization') {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ProductCapitalizationsPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Product capitalization canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductCapitalizations).mockResolvedValue({ Items: [CAPITALIZATION], Total: 1 })
    vi.mocked(getProductCapitalization).mockResolvedValue(CAPITALIZATION)
    vi.mocked(exportProductCapitalization).mockResolvedValue({ PdfDocumentURL: '/capitalization.pdf' })
  })

  it('does not mount the data model without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductCapitalizations).not.toHaveBeenCalled()
  })

  it('does not expose create, details or export with page access alone', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Page.View)
    renderPage('/products/capitalization?netId=capitalization-1')

    const row = await screen.findByRole('button', { name: 'CAP-1' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Нове оприбуткування' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Деталі' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Друк PDF' })).toBeNull()
    expect(getProductCapitalization).not.toHaveBeenCalled()
  })

  it('opens details independently and keeps export hidden', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Capitalization.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'CAP-1' }))

    await waitFor(() => expect(getProductCapitalization).toHaveBeenCalledWith('capitalization-1'))
    expect(screen.queryByRole('button', { name: 'Друк PDF' })).toBeNull()
  })

  it('exports from its independent row action without details access', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Друк PDF' }))

    await waitFor(() => expect(exportProductCapitalization).toHaveBeenCalledWith('capitalization-1'))
    expect(getProductCapitalization).not.toHaveBeenCalled()
  })

  it('opens the create flow only with the create right', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Capitalization.Capitalization.Create)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Нове оприбуткування' }))

    expect(screen.getByText('Форма нового оприбуткування')).toBeTruthy()
  })
})
