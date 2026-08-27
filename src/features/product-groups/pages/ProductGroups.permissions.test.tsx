import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createProductGroup,
  getProductGroupCreateRootGroups,
  getProductGroupDetailsRootGroups,
  getProductGroupWithRoot,
  getProductGroups,
  updateProductGroup,
} from '../api/productGroupsApi'
import type { ProductGroup } from '../types'
import { ProductGroupDetailPage } from './ProductGroupDetailPage'
import { ProductGroupsPage } from './ProductGroupsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productGroupsApi', () => ({
  createProductGroup: vi.fn(),
  getProductGroupCreateRootGroups: vi.fn(),
  getProductGroupDetailsRootGroups: vi.fn(),
  getProductGroupWithRoot: vi.fn(),
  getProductGroups: vi.fn(),
  updateProductGroup: vi.fn(),
}))

vi.mock('../components/ProductGroupForm', () => ({
  ProductGroupForm: ({
    disabled,
    onFieldChange,
  }: {
    disabled: boolean
    onFieldChange: (key: keyof ProductGroup, value: ProductGroup[keyof ProductGroup]) => void
  }) => (
    <div>
      <output data-testid="product-group-form-disabled">{String(disabled)}</output>
      <button
        disabled={disabled}
        type="button"
        onClick={() => onFieldChange('Name', 'Updated group')}
      >
        change-group
      </button>
    </div>
  ),
}))

vi.mock('../components/ProductGroupProductsPanel', () => ({
  ProductGroupProductsPanel: ({ canOpenProduct }: { canOpenProduct: boolean }) => (
    <output data-testid="can-open-product">{String(canOpenProduct)}</output>
  ),
}))

vi.mock('../components/ProductGroupSubGroupsPanel', () => ({
  ProductGroupSubGroupsPanel: () => <div>sub-groups-panel</div>,
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

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: ProductGroup[]
    onRowClick?: (row: ProductGroup) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <button
          disabled={!onRowClick}
          key={row.NetUid || index}
          type="button"
          onClick={() => onRowClick?.(row)}
        >
          {row.Name || row.NetUid || `row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

const PRODUCT_GROUP: ProductGroup = {
  Description: 'Brake parts',
  FullName: 'Brake system',
  IsActive: true,
  Name: 'Brakes',
  NetUid: 'group-1',
  ProductProductGroups: [],
  RootProductGroups: [],
  SubProductGroups: [],
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderRoute(element: ReactNode, path: string, routePath: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('product-group canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductGroups).mockResolvedValue({
      ProductGroups: [PRODUCT_GROUP],
      TotalFilteredQty: 1,
      TotalQty: 1,
    })
    vi.mocked(getProductGroupWithRoot).mockResolvedValue(PRODUCT_GROUP)
    vi.mocked(getProductGroupDetailsRootGroups).mockResolvedValue([])
    vi.mocked(getProductGroupCreateRootGroups).mockResolvedValue([])
    vi.mocked(createProductGroup).mockResolvedValue(PRODUCT_GROUP)
    vi.mocked(updateProductGroup).mockResolvedValue({
      ...PRODUCT_GROUP,
      Name: 'Updated group',
    })
  })

  it('does not mount the registry without page access', () => {
    renderRoute(<ProductGroupsPage />, '/product-groups', '/product-groups')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductGroups).not.toHaveBeenCalled()
  })

  it('keeps create and open-details independent', async () => {
    allowedPermissions.add(PermissionKeys.ProductGroups.Page.View)
    allowedPermissions.add(PermissionKeys.ProductGroups.Group.OpenDetails)
    renderRoute(<ProductGroupsPage />, '/product-groups', '/product-groups')

    const row = await screen.findByRole('button', { name: 'Brakes' })
    expect((row as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'Нова група' })).toBeNull()
    fireEvent.click(row)

    expect(screen.getByTestId('location').textContent).toBe('/product-groups/group-1')
  })

  it('does not load a direct card without both page and open-details access', () => {
    allowedPermissions.add(PermissionKeys.ProductGroups.Page.View)
    renderRoute(<ProductGroupDetailPage />, '/product-groups/group-1', '/product-groups/:id')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductGroupWithRoot).not.toHaveBeenCalled()
  })

  it('loads an open-details-only card as read-only', async () => {
    allowedPermissions.add(PermissionKeys.ProductGroups.Page.View)
    allowedPermissions.add(PermissionKeys.ProductGroups.Group.OpenDetails)
    renderRoute(<ProductGroupDetailPage />, '/product-groups/group-1', '/product-groups/:id')

    expect((await screen.findByTestId('product-group-form-disabled')).textContent).toBe('true')
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(getProductGroupWithRoot).toHaveBeenCalledWith('group-1')
    expect(getProductGroupDetailsRootGroups).toHaveBeenCalledWith('group-1')
  })

  it('uses edit only for the final save and assortment view only for product opening', async () => {
    allowedPermissions.add(PermissionKeys.ProductGroups.Page.View)
    allowedPermissions.add(PermissionKeys.ProductGroups.Group.OpenDetails)
    allowedPermissions.add(PermissionKeys.ProductGroups.Group.Edit)
    allowedPermissions.add(PermissionKeys.ProductsAssortment.Page.View)
    renderRoute(<ProductGroupDetailPage />, '/product-groups/group-1', '/product-groups/:id')

    fireEvent.click(await screen.findByRole('button', { name: 'change-group' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateProductGroup).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('tab', { name: 'Товари' }))
    expect(screen.getByTestId('can-open-product').textContent).toBe('true')
  })
})
