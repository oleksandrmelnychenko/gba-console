import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductAvailabilities,
  getProductAvailabilities,
  getProductAvailabilityStorages,
} from '../api/productAvailabilitiesApi'
import { ProductAvailabilitiesPage } from './ProductAvailabilitiesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({
    children,
    fallback = null,
    permissionKey,
  }: {
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

vi.mock('../../../shared/documents/openExportDocument', () => ({
  closePendingExportDocumentWindow: vi.fn(),
  openExportDocumentInWindow: vi.fn(() => true),
  openPendingExportDocumentWindow: vi.fn(() => null),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div>availability-table</div>,
}))

vi.mock('../api/productAvailabilitiesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productAvailabilitiesApi')>(),
  exportProductAvailabilities: vi.fn(),
  getProductAvailabilities: vi.fn(),
  getProductAvailabilityStorages: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <MantineProvider env="test" theme={{ respectReducedMotion: true }}>
        <I18nProvider>
          <ProductAvailabilitiesPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('product availabilities permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductAvailabilityStorages).mockResolvedValue([{ Name: 'Основний', NetUid: 'storage-1' }])
    vi.mocked(getProductAvailabilities).mockResolvedValue({ Availabilities: [], Total: 0 })
    vi.mocked(exportProductAvailabilities).mockResolvedValue({ PdfDocumentURL: 'https://example.test/report.pdf' })
  })

  it('does not mount the page model without page.view', async () => {
    renderPage()

    expect(await screen.findByText('Доступ заборонено')).toBeTruthy()
    expect(getProductAvailabilityStorages).not.toHaveBeenCalled()
    expect(getProductAvailabilities).not.toHaveBeenCalled()
  })

  it('keeps page access independent from export and rechecks export after rendering', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.ProductAvailabilities.View)
    const first = renderPage()

    expect(await screen.findByText('availability-table')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Друк PDF' })).toBeNull()

    first.unmount()
    allowedPermissions.add(PermissionKeys.ProductAvailabilities.Document.Export)
    renderPage()
    const exportButton = await screen.findByRole('button', { name: 'Друк PDF' })
    await waitFor(() => expect((exportButton as HTMLButtonElement).disabled).toBe(false))

    allowedPermissions.delete(PermissionKeys.ProductAvailabilities.Document.Export)
    fireEvent.click(exportButton)
    expect(exportProductAvailabilities).not.toHaveBeenCalled()
  })
})
