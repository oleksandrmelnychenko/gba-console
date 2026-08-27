import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductHistory,
  getProductHistory,
  getProductHistoryStorages,
} from '../api/productHistoryApi'
import { ProductHistoryPage } from './ProductHistoryPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productHistoryApi', () => ({
  exportProductHistory: vi.fn(),
  getProductHistory: vi.fn(),
  getProductHistoryStorages: vi.fn(),
}))

vi.mock('../../../shared/documents/openExportDocument', () => ({
  closePendingExportDocumentWindow: vi.fn(),
  openExportDocumentInWindow: vi.fn(() => false),
  openPendingExportDocumentWindow: vi.fn(() => null),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div>Таблиця історії</div>,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductHistoryPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProductHistoryPage canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductHistoryStorages).mockResolvedValue([
      { Id: 7, Name: 'Основний склад' },
    ])
    vi.mocked(getProductHistory).mockResolvedValue({ Items: [], Total: 0 })
    vi.mocked(exportProductHistory).mockResolvedValue({
      DocumentURL: '/history.xlsx',
    })
  })

  it('does not mount the page model without page.view', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductHistoryStorages).not.toHaveBeenCalled()
    expect(getProductHistory).not.toHaveBeenCalled()
  })

  it('loads the registry without exposing export on page.view alone', async () => {
    allowedPermissions.add(PermissionKeys.ProductHistory.Page.View)
    renderPage()

    await screen.findByText('Таблиця історії')
    await waitFor(() => expect(getProductHistoryStorages).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Друк PDF' })).toBeNull()
  })

  it('rechecks document.export in the final handler', async () => {
    allowedPermissions.add(PermissionKeys.ProductHistory.Page.View)
    allowedPermissions.add(PermissionKeys.ProductHistory.Document.Export)
    renderPage()

    const exportButton = await screen.findByRole('button', { name: 'Друк PDF' })
    allowedPermissions.delete(PermissionKeys.ProductHistory.Document.Export)
    fireEvent.click(exportButton)
    expect(exportProductHistory).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductHistory.Document.Export)
    fireEvent.click(exportButton)
    await waitFor(() => expect(exportProductHistory).toHaveBeenCalledTimes(1))
  })
})
