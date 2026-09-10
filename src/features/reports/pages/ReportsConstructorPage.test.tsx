import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleNav } from '../../../app/layout/components/ConsoleNav'
import { NavigationRouteGuard } from '../../../app/layout/components/NavigationRouteGuard'
import { consoleRoutes } from '../../../app/routes/consoleRoutes'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PagePermissionBoundary } from '../../auth/components/PagePermissionBoundary'
import { NavigationContext } from '../../navigation/NavigationContext'
import { getNavigationNodePath, normalizeNavigation } from '../../navigation/navigationUtils'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { NetUid: 'constructor-user' },
    session: { userNetUid: 'constructor-user' },
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))
vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))
vi.mock('../api/reportsApi', async importOriginal => ({
  ...await importOriginal<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(),
}))
vi.mock('../api/reportWorkspaceApi', async importOriginal => ({
  ...await importOriginal<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(),
  getServerReportTemplates: vi.fn(),
}))

function CurrentPath() {
  return <output aria-label="Поточний маршрут">{useLocation().pathname}</output>
}

function renderConstructor(menuRoute: string | null = '/reports/stocks', showNavigation = false) {
  const route = consoleRoutes.find(candidate => candidate.path === '/reports/constructor')!
  const modules = normalizeNavigation(menuRoute ? [{
    Id: 1,
    Module: 'Звіти',
    Children: [{ Id: 12, Module: 'Звіт залишків', Route: menuRoute }],
  }] : [])

  return render(
    <MemoryRouter initialEntries={['/reports/constructor']}>
      <MantineProvider>
        <I18nProvider>
          <NavigationContext.Provider value={{
            error: null,
            isLoading: false,
            modules,
            selectedModule: modules[0] ?? null,
            selectedNode: modules[0]?.Children[0] ?? null,
            getNodePath: getNavigationNodePath,
            isNodeActive: () => false,
            selectModule: () => undefined,
          }}>
            {showNavigation && <><ConsoleNav /><CurrentPath /></>}
            <NavigationRouteGuard>
              <PagePermissionBoundary permissionKey={route.permissionKey!}>
                {route.element}
              </PagePermissionBoundary>
            </NavigationRouteGuard>
          </NavigationContext.Provider>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('report constructor entry', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
  })

  it.each([null, '/reports/sale', '/sales/ukraine/all'])(
    'does not mount the constructor through a missing or unrelated menu grant: %s',
    menuRoute => {
      allowedPermissions.add(PermissionKeys.ReportsStocks.Page.View)
      allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)
      renderConstructor(menuRoute)
      expect(screen.queryByRole('heading', { name: 'Конструктор звітів' })).toBeNull()
      expect(getReportDatasets).not.toHaveBeenCalled()
    },
  )

  it('requires page-view even when generation is permitted', () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)
    renderConstructor()
    expect(screen.queryByRole('heading', { name: 'Конструктор звітів' })).toBeNull()
    expect(getReportDatasets).not.toHaveBeenCalled()
  })

  it.each(['/reports/stocks', '/reports/constructor'])(
    'opens one existing workspace through %s without granting generation',
    async menuRoute => {
      allowedPermissions.add(PermissionKeys.ReportsStocks.Page.View)
      const { container } = renderConstructor(menuRoute)
      expect(await screen.findByRole('heading', { name: 'Конструктор звітів', level: 2 }, { timeout: 5000 })).not.toBeNull()
      expect(container.querySelectorAll('form')).toHaveLength(1)
      expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
      fireEvent.submit(container.querySelector('form')!)
      expect(getReportDatasets).not.toHaveBeenCalled()
      expect(createStockReport).not.toHaveBeenCalled()
    },
  )

  it('exposes the constructor in the existing reports menu', async () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Page.View)
    renderConstructor('/reports/stocks', true)
    await screen.findByRole('heading', { name: 'Конструктор звітів' })
    fireEvent.click(screen.getByRole('button', { name: 'Конструктор звітів' }))
    expect(screen.getByLabelText('Поточний маршрут').textContent).toBe('/reports/constructor')
  })

  it('uses the native dataset engine and waits for an explicit generate action', async () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Page.View)
    allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)
    vi.mocked(createStockReport).mockRejectedValue(new Error('test request'))
    const { container } = renderConstructor()
    await screen.findByRole('heading', { name: 'Конструктор звітів' })
    fireEvent.click(await screen.findByRole('button', { name: 'Продажі за днями' }))
    expect(createStockReport).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    await screen.findByText('Не вдалося сформувати звіт')
  })
})
