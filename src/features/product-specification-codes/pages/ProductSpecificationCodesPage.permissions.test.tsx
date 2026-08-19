import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getProductSpecifications,
  uploadSpecificationCodesFile,
} from '../api/productSpecificationCodesApi'
import type { ProductSpecification } from '../types'
import { ProductSpecificationCodesPage } from './ProductSpecificationCodesPage'

const allowedPermissions = new Set<string>()
const specification = {
  Id: 1,
  NetUid: '11111111-1111-4111-8111-111111111111',
  SpecificationCode: '8708',
  Product: { VendorCode: 'A-1' },
} satisfies ProductSpecification

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null, permissionKey }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/productSpecificationCodesApi', () => ({
  changeProductSpecification: vi.fn(),
  getProductSpecifications: vi.fn(),
  uploadSpecificationCodesFile: vi.fn(),
}))

vi.mock('../components/ChangeProductSpecificationPanel', () => ({
  ChangeProductSpecificationPanel: ({ productSpecification }: {
    productSpecification: ProductSpecification | null
  }) => productSpecification ? <div>change-panel-{productSpecification.NetUid}</div> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, onRowClick }: {
    data: ProductSpecification[]
    onRowClick?: (row: ProductSpecification) => void
  }) => data[0] && onRowClick
    ? <button type="button" onClick={() => onRowClick(data[0])}>open-code</button>
    : <div>codes-table</div>,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductSpecificationCodesPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Product specification codes canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductSpecifications).mockResolvedValue([specification])
    vi.mocked(uploadSpecificationCodesFile).mockResolvedValue({
      InvalidVendorCodes: [],
      ParsedCount: 1,
      SuccessfullyUpdatedCount: 1,
      UpdateWasNotRequiredCount: 0,
    })
  })

  it('does not mount the registry without page.view', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductSpecifications).not.toHaveBeenCalled()
  })

  it('keeps page access independent from edit and import', async () => {
    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Page.View)
    renderPage()

    await waitFor(() => expect(getProductSpecifications).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'open-code' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завантажити Excel' })).toBeNull()
  })

  it('opens the change workflow only with code.edit and closes it after revocation', async () => {
    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Page.View)
    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Code.Edit)
    const view = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'open-code' }))
    expect(screen.getByText(`change-panel-${specification.NetUid}`)).toBeTruthy()

    allowedPermissions.delete(PermissionKeys.ProductSpecificationCodes.Code.Edit)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <ProductSpecificationCodesPage />
        </I18nProvider>
      </MantineProvider>,
    )
    await waitFor(() => expect(screen.queryByText(`change-panel-${specification.NetUid}`)).toBeNull())
  })

  it('rechecks code.import in the final file handler', async () => {
    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Page.View)
    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Code.Import)
    renderPage()

    const upload = await screen.findByRole('button', { name: 'Завантажити Excel' })
    fireEvent.click(upload)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).toBeTruthy()

    allowedPermissions.delete(PermissionKeys.ProductSpecificationCodes.Code.Import)
    fireEvent.change(input!, { target: { files: [new File(['a'], 'codes.xlsx')] } })
    expect(uploadSpecificationCodesFile).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductSpecificationCodes.Code.Import)
    fireEvent.change(input!, { target: { files: [new File(['b'], 'codes.xlsx')] } })
    await waitFor(() => expect(uploadSpecificationCodesFile).toHaveBeenCalledTimes(1))
  })
})
