import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import type { PreOrder } from './types'
import { ProductInterestModal } from './components/ProductInterestModal'
import { PreordersInterestPage } from './pages/PreordersInterestPage'

const allowedPermissions = new Set<string>()
const api = vi.hoisted(() => ({
  createPreorder: vi.fn(),
  getPreorders: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
    isPermissionsLoading: false,
    permissions: [...allowedPermissions],
  }),
}))

vi.mock('./api/salesPreordersApi', () => ({
  createPreorder: api.createPreorder,
  getPreorders: api.getPreorders,
}))

vi.mock('../sales-ukraine/persistentCreateMutation', () => ({
  usePersistentCreateMutation: () => (
    payload: unknown,
    action: (request: unknown, operation: { operationId: string }) => Promise<unknown>,
  ) => action(payload, { operationId: '00000000-0000-4000-8000-000000000001' }),
}))

vi.mock('../products/components/ProductCardModal', () => ({
  ProductCardModal: ({ productNetId }: { productNetId: string | null }) =>
    productNetId ? <div data-testid="product-card">{productNetId}</div> : null,
}))

vi.mock('../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
  }: {
    columns: Array<{ cell?: (row: PreOrder) => ReactNode; id: string }>
    data: PreOrder[]
  }) => (
    <div data-testid="preorders-table">
      {data.map((row, rowIndex) => (
        <div key={String(row.NetUid || row.Id || rowIndex)}>
          {columns.map((column) => (
            <div key={column.id}>{column.cell?.(row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

function renderUi(ui: ReactNode) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>{ui}</I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

const preorder: PreOrder = {
  NetUid: 'preorder-1',
  Product: {
    Name: 'Тестовий товар',
    NetUid: 'product-1',
    VendorCode: 'V-1',
  },
} as PreOrder

describe('sales preorder permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    api.getPreorders.mockResolvedValue([preorder])
    api.createPreorder.mockResolvedValue('Створено')
  })

  it('does not mount the interest registry without page.view', async () => {
    renderUi(<PreordersInterestPage />)

    expect(await screen.findByText('Доступ заборонено')).toBeTruthy()
    expect(api.getPreorders).not.toHaveBeenCalled()
  })

  it('keeps product details independent and uses the existing assortment right', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SalesUkraineInterest.View)
    const first = renderUi(<PreordersInterestPage />)

    expect(await screen.findByText('V-1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'V-1' })).toBeNull()
    expect(screen.queryByTestId('product-card')).toBeNull()

    first.unmount()
    allowedPermissions.add(PermissionKeys.ProductsAssortment.Page.View)
    renderUi(<PreordersInterestPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'V-1' }))
    expect((await screen.findByTestId('product-card')).textContent).toBe('product-1')
  })

  it('fails closed at the final preorder submit boundary', async () => {
    const denied = renderUi(
      <ProductInterestModal
        clientAgreementNetId="d98f586d-d49c-4af9-9375-b8520679b1ef"
        opened
        productNetId="1108deb9-c47d-45f4-ab9e-86c08cb7a797"
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull()
    expect(api.createPreorder).not.toHaveBeenCalled()

    denied.unmount()
    allowedPermissions.add(PermissionKeys.SalesUkraineInterest.Preorder.Create)
    renderUi(
      <ProductInterestModal
        clientAgreementNetId="d98f586d-d49c-4af9-9375-b8520679b1ef"
        opened
        productNetId="1108deb9-c47d-45f4-ab9e-86c08cb7a797"
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Кількість' }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(api.createPreorder).toHaveBeenCalledTimes(1))
  })
})
