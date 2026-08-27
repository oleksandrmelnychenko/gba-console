import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'

const allowedPermissions = new Set<string>()
const printMock = vi.fn()

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

vi.mock('../utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils')>(),
  downloadTextFile: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reports/sale']}>
      <MantineProvider>
        <I18nProvider>
          <ReportsSalePage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Sale-file report canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: printMock,
    })
  })

  it('does not mount the file viewer without page.view', () => {
    renderPage()

    expect(screen.getByText('Немає права переглядати файл звіту продажів')).toBeTruthy()
    expect(screen.queryByLabelText('Завантажити файл')).toBeNull()
  })

  it('keeps export and print independent from page access', () => {
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    renderPage()

    expect(screen.getByLabelText('Завантажити файл')).toBeTruthy()
    expect(screen.queryByLabelText('Експорт CSV')).toBeNull()
    expect(screen.queryByLabelText('Друк')).toBeNull()
  })

  it('rechecks export and print after a rendered control becomes stale', async () => {
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Document.Export)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Document.Print)
    renderPage()

    fireEvent.change(screen.getByLabelText('Завантажити файл'), {
      target: {
        files: [new File(['Name,Value\nSale,100'], 'sales.csv', {
          type: 'text/csv',
        })],
      },
    })

    const exportButton = await screen.findByLabelText('Експорт CSV')
    const printButton = screen.getByLabelText('Друк')
    await waitFor(() =>
      expect((exportButton as HTMLButtonElement).disabled).toBe(false),
    )

    fireEvent.click(exportButton)
    fireEvent.click(printButton)
    expect(downloadTextFile).toHaveBeenCalledOnce()
    expect(printMock).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    allowedPermissions.delete(PermissionKeys.ReportsSaleFile.Document.Export)
    allowedPermissions.delete(PermissionKeys.ReportsSaleFile.Document.Print)
    fireEvent.click(exportButton)
    fireEvent.click(printButton)

    expect(downloadTextFile).not.toHaveBeenCalled()
    expect(printMock).not.toHaveBeenCalled()
  })
})
