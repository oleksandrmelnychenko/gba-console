import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleNav } from '../../../app/layout/components/ConsoleNav'
import { NavigationRouteGuard } from '../../../app/layout/components/NavigationRouteGuard'
import { consoleRoutes } from '../../../app/routes/consoleRoutes'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PagePermissionBoundary } from '../../auth/components/PagePermissionBoundary'
import { NavigationContext } from '../../navigation/NavigationContext'
import { getNavigationNodePath, normalizeNavigation } from '../../navigation/navigationUtils'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'

const allowedPermissions = new Set<string>()

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { NetUid: 'reports-user' },
    session: { userNetUid: 'reports-user' },
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))
vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => allowedPermissions.has(permission), isLoading: false }),
}))
vi.mock('../api/reportWorkspaceApi', async importOriginal => ({
  ...await importOriginal<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(),
  getServerReportTemplates: vi.fn(),
}))

function CurrentPath() {
  return <output aria-label="Поточний маршрут">{useLocation().pathname}</output>
}

function renderReports(path: string) {
  const modules = normalizeNavigation([{
    Id: 28,
    Module: 'Аналітика',
    Children: [
      { Id: 70132, Module: 'Конструктор', Route: '/reports/stocks' },
      { Id: 70133, Module: 'Перегляд звіту з файла', Route: '/reports/sale' },
    ],
  }])
  const routes = consoleRoutes.filter(route => route.path.startsWith('/reports/'))
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider env="test">
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
            <ConsoleNav /><CurrentPath />
            <NavigationRouteGuard>
              <Routes>
                {routes.map(route => <Route key={route.path} path={route.path} element={
                  <PagePermissionBoundary permissionKey={route.permissionKey!}>{route.element}</PagePermissionBoundary>
                } />)}
                <Route path="*" element={null} />
              </Routes>
            </NavigationRouteGuard>
          </NavigationContext.Provider>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('BUG-1274-only report surface routes', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.ReportsStocks.Page.View)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
  })

  it.each(['/reports/constructor', '/reports/sale', '/reports/sales'])(
    'opens the BUG-1274 reports page instead of %s',
    async path => {
      renderReports(path)
      await waitFor(() => expect(screen.getByLabelText('Поточний маршрут').textContent).toBe('/reports/stocks'))
      expect(await screen.findByRole('heading', { name: 'Звіти 1С' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Конструктор звітів' })).toBeNull()
    },
  )

  it('shows one reports menu entry without the sale-file screen', async () => {
    renderReports('/dashboard')
    expect(screen.queryByRole('button', { name: 'Перегляд звіту з файла' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Конструктор звітів' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Звіти' }))
    expect(screen.getByLabelText('Поточний маршрут').textContent).toBe('/reports/stocks')
    expect(await screen.findByRole('heading', { name: 'Звіти 1С' })).toBeTruthy()
  })
})
