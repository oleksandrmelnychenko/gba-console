import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductPlacements,
  getProductPlacements,
  getProductPlacementStorages,
  uploadProductPlacementFile,
} from '../api/productPlacementsApi'
import { ProductPlacementsPage } from './ProductPlacementsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productPlacementsApi', () => ({
  exportProductPlacements: vi.fn(),
  exportReturnedProductPlacements: vi.fn(),
  getProductPlacements: vi.fn(),
  getProductPlacementStorages: vi.fn(),
  submitReturnedProductPlacements: vi.fn(),
  uploadProductPlacementFile: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div>Таблиця розміщень</div>,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: () => null,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductPlacementsPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProductPlacementsPage canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductPlacementStorages).mockResolvedValue([{ Id: 7, Name: 'Основний склад' }])
    vi.mocked(getProductPlacements).mockResolvedValue({ Items: [], Total: 0 })
    vi.mocked(exportProductPlacements).mockResolvedValue({ DocumentURL: '/placements.xlsx' })
    vi.mocked(uploadProductPlacementFile).mockResolvedValue({ ReturnedProducts: [] })
  })

  it('does not mount the page model without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductPlacementStorages).not.toHaveBeenCalled()
    expect(getProductPlacements).not.toHaveBeenCalled()
  })

  it('loads the page but exposes neither import nor export with page access alone', async () => {
    allowedPermissions.add(PermissionKeys.ProductPlacements.Page.View)
    renderPage()

    await screen.findByText('Таблиця розміщень')
    await waitFor(() => expect(getProductPlacementStorages).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Імпорт' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Експорт' })).toBeNull()
  })

  it('exports independently without exposing import', async () => {
    allowedPermissions.add(PermissionKeys.ProductPlacements.Page.View)
    allowedPermissions.add(PermissionKeys.ProductPlacements.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Експорт' }))

    await waitFor(() => expect(exportProductPlacements).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Імпорт' })).toBeNull()
  })

  it('opens the import only with the import right', async () => {
    allowedPermissions.add(PermissionKeys.ProductPlacements.Page.View)
    allowedPermissions.add(PermissionKeys.ProductPlacements.File.Import)
    renderPage()

    const importButton = await screen.findByRole('button', { name: 'Імпорт' })
    await waitFor(() => expect((importButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(importButton)

    expect(await screen.findByText('Імпорт розміщень')).toBeTruthy()
    expect(uploadProductPlacementFile).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Експорт' })).toBeNull()
  })
})
