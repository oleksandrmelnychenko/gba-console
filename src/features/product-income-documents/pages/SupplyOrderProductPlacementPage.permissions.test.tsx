import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductIncomeDocument,
  getSupplyOrderProductIncomeByNetId,
  getSupplyOrderUkraineProductIncomeByNetId,
} from '../api/productIncomeDocumentsApi'
import {
  SupplyOrderProductPlacementPage,
  SupplyOrderUkraineProductPlacementPage,
} from './SupplyOrderProductPlacementPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productIncomeDocumentsApi', () => ({
  exportProductIncomeDocument: vi.fn(),
  getSupplyOrderProductIncomeByNetId: vi.fn(),
  getSupplyOrderUkraineProductIncomeByNetId: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <div>{title}{children}</div> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div>Таблиця розміщення</div>,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

const ukraineIncome = {
  NetUid: 'income-1',
  ProductIncomeItems: [{
    SupplyOrderUkraineItem: {
      Product: { Name: 'Тестовий товар' },
    },
  }],
}

function renderUkrainePage() {
  return renderRoute(
    '/orders/ukraine/income-1/product-income',
    '/orders/ukraine/:id/product-income',
    <SupplyOrderUkraineProductPlacementPage />,
  )
}

function renderSupplyOrderPage() {
  return renderRoute(
    '/supply-orders/product-placement/income-2',
    '/supply-orders/product-placement/:id',
    <SupplyOrderProductPlacementPage />,
  )
}

function renderRoute(initialEntry: string, path: string, element: ReactNode) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={element} path={path} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SupplyOrderProductPlacementPage canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getSupplyOrderUkraineProductIncomeByNetId).mockResolvedValue(ukraineIncome)
    vi.mocked(getSupplyOrderProductIncomeByNetId).mockResolvedValue({
      NetUid: 'income-2',
      ProductIncomeItems: [],
    })
    vi.mocked(exportProductIncomeDocument).mockResolvedValue({ DocumentURL: '/income.pdf' })
  })

  it('does not load the Ukraine drawer without open-product-placement', () => {
    renderUkrainePage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSupplyOrderUkraineProductIncomeByNetId).not.toHaveBeenCalled()
  })

  it('loads Ukraine details independently and hides export without document.export', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Placement.OpenProductPlacement)
    renderUkrainePage()

    await waitFor(() => expect(getSupplyOrderUkraineProductIncomeByNetId).toHaveBeenCalledWith('income-1'))
    expect(await screen.findByText('Таблиця розміщення')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Експорт' })).toBeNull()
  })

  it('rechecks document.export in the final handler', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Placement.OpenProductPlacement)
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.Export)
    renderUkrainePage()

    const exportButton = await screen.findByRole('button', { name: 'Експорт' })
    allowedPermissions.delete(PermissionKeys.ProductIncomeDocuments.Document.Export)
    fireEvent.click(exportButton)
    expect(exportProductIncomeDocument).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.Export)
    fireEvent.click(exportButton)
    await waitFor(() => expect(exportProductIncomeDocument).toHaveBeenCalledWith('income-1'))
  })

  it('uses income-document open-details for a supplier-order source drawer', async () => {
    renderSupplyOrderPage()
    expect(getSupplyOrderProductIncomeByNetId).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.OpenDetails)
    renderSupplyOrderPage()
    await waitFor(() => expect(getSupplyOrderProductIncomeByNetId).toHaveBeenCalledWith('income-2'))
  })
})
