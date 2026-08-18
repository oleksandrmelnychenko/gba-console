import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getActReconciliationByNetId,
  getActReconciliations,
  getAppliedActions,
  getDispositionHistory,
} from '../api/actReconciliationsApi'
import type { ActReconciliation, ActReconciliationItem } from '../types'
import { ActReconciliationsPage } from './ActReconciliationsPage'
import { ActReconciliationViewPage } from './ActReconciliationViewPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/actReconciliationsApi', () => ({
  getActReconciliationByNetId: vi.fn(),
  getActReconciliations: vi.fn(),
  getAppliedActions: vi.fn(),
  getDispositionHistory: vi.fn(),
}))

vi.mock('../components/ActReconciliationActionsModal', () => ({
  ActReconciliationActionsModal: ({
    canCreateProductIncome,
    canCreateProductTransfer,
    canCreateWriteOff,
    opened,
  }: {
    canCreateProductIncome: boolean
    canCreateProductTransfer: boolean
    canCreateWriteOff: boolean
    opened: boolean
  }) => opened ? (
    <output data-testid="action-permissions">
      {String(canCreateProductIncome)}:{String(canCreateProductTransfer)}:{String(canCreateWriteOff)}
    </output>
  ) : null,
}))

vi.mock('../components/ActReconciliationDispositionModal', () => ({
  ActReconciliationDispositionModal: ({ opened, permitted }: { opened: boolean; permitted: boolean }) => (
    opened ? <output data-testid="disposition-permitted">{String(permitted)}</output> : null
  ),
}))

vi.mock('../components/AppliedActionsHistoryDrawer', () => ({
  AppliedActionsHistoryDrawer: ({ opened }: { opened: boolean }) => (
    opened ? <div>history-drawer</div> : null
  ),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section>{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/data-table/useDataTableDensity', () => ({
  useDataTableDensity: () => ({ density: 'normal', toggleDensity: vi.fn() }),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
    tableId,
  }: {
    data: Array<ActReconciliation | ActReconciliationItem>
    onRowClick?: (row: ActReconciliation & ActReconciliationItem) => void
    tableId: string
  }) => (
    <div>
      {data.map((row, index) => (
        <button
          disabled={!onRowClick}
          key={row.NetUid || index}
          type="button"
          onClick={() => onRowClick?.(row as ActReconciliation & ActReconciliationItem)}
        >
          {tableId}-row-{index}
        </button>
      ))}
    </div>
  ),
}))

const ITEM: ActReconciliationItem = {
  HasDifference: true,
  NegativeDifference: true,
  NetUid: 'item-1',
  QtyDifference: 2,
}

const ACT: ActReconciliation = {
  ActReconciliationItems: [ITEM],
  NetUid: 'act-1',
  Number: 'AR-1',
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

describe('act-reconciliation canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getActReconciliations).mockResolvedValue([ACT])
    vi.mocked(getActReconciliationByNetId).mockResolvedValue(ACT)
    vi.mocked(getAppliedActions).mockResolvedValue([])
    vi.mocked(getDispositionHistory).mockResolvedValue([])
  })

  it('does not mount the registry without page access', () => {
    renderRoute(<ActReconciliationsPage />, '/ukraine/act/reconcoliation', '/ukraine/act/reconcoliation')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getActReconciliations).not.toHaveBeenCalled()
  })

  it('keeps registry access independent from opening a detail', async () => {
    allowedPermissions.add(PermissionKeys.ActReconciliations.Page.View)
    renderRoute(<ActReconciliationsPage />, '/ukraine/act/reconcoliation', '/ukraine/act/reconcoliation')

    const row = await screen.findByRole('button', { name: 'act-reconciliations-row-0' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('location').textContent).toBe('/ukraine/act/reconcoliation')
  })

  it('does not hydrate a direct act without open-details access', () => {
    allowedPermissions.add(PermissionKeys.ActReconciliations.Page.View)
    renderRoute(
      <ActReconciliationViewPage />,
      '/ukraine/act/reconcoliation/act-1',
      '/ukraine/act/reconcoliation/:netid',
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getActReconciliationByNetId).not.toHaveBeenCalled()
  })

  it('keeps history, warehouse actions and disposition independent', async () => {
    allowedPermissions.add(PermissionKeys.ActReconciliations.Page.View)
    allowedPermissions.add(PermissionKeys.ActReconciliations.Act.OpenDetails)
    allowedPermissions.add(PermissionKeys.ActReconciliations.History.View)
    allowedPermissions.add(PermissionKeys.ActReconciliations.Action.CreateProductIncome)
    renderRoute(
      <ActReconciliationViewPage />,
      '/ukraine/act/reconcoliation/act-1',
      '/ukraine/act/reconcoliation/:netid',
    )

    fireEvent.click(await screen.findByRole('button', { name: 'act-reconciliation-items-row-0' }))
    fireEvent.click(screen.getByRole('button', { name: /Створити складську дію/ }))
    expect(screen.getByTestId('action-permissions').textContent).toBe('true:false:false')
    expect(screen.queryByRole('button', { name: /Закрити без руху/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Історія змін' }))
    await waitFor(() => {
      expect(getAppliedActions).toHaveBeenCalledWith('act-1')
      expect(getDispositionHistory).toHaveBeenCalledWith('act-1')
    })
    expect(screen.getByText('history-drawer')).toBeTruthy()
  })

  it('opens disposition without granting a warehouse mutation', async () => {
    allowedPermissions.add(PermissionKeys.ActReconciliations.Page.View)
    allowedPermissions.add(PermissionKeys.ActReconciliations.Act.OpenDetails)
    allowedPermissions.add(PermissionKeys.ActReconciliations.Disposition.Change)
    renderRoute(
      <ActReconciliationViewPage />,
      '/ukraine/act/reconcoliation/act-1',
      '/ukraine/act/reconcoliation/:netid',
    )

    fireEvent.click(await screen.findByRole('button', { name: 'act-reconciliation-items-row-0' }))
    fireEvent.click(screen.getByRole('button', { name: /Закрити без руху/ }))

    expect(screen.getByTestId('disposition-permitted').textContent).toBe('true')
    expect(screen.queryByRole('button', { name: /Створити складську дію/ })).toBeNull()
  })
})
