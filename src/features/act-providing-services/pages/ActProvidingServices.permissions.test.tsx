import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ActProvidingService } from '../types'
import {
  getProvidingServiceActLogisticWayDetails,
  getProvidingServiceActOverviewDetails,
  getProvidingServiceActsRegistry,
  updateActProvidingService,
} from '../api/actProvidingServicesApi'
import { ActProvidingServiceDetailPage } from './ActProvidingServiceDetailPage'
import { ActProvidingServicesPage } from './ActProvidingServicesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/actProvidingServicesApi', () => ({
  getProvidingServiceActLogisticWayDetails: vi.fn(),
  getProvidingServiceActOverviewDetails: vi.fn(),
  getProvidingServiceActsRegistry: vi.fn(),
  updateActProvidingService: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => (
    opened ? <section>{children}{footer}</section> : null
  ),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: Array<{ act: ActProvidingService }>
    onRowClick?: (row: { act: ActProvidingService }) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <button key={row.act.NetUid || index} type="button" onClick={() => onRowClick?.(row)}>
          {row.act.Number || row.act.NetUid || `row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

const ACT: ActProvidingService = {
  BillOfLadingService: {
    DeliveryProductProtocol: { NetUid: 'protocol-1' },
    Number: 'INV-1',
  },
  NetUid: 'act-1',
  Number: 'ACT-1',
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/act-providing-services" element={<ActProvidingServicesPage />} />
            <Route path="/act-providing-services/:id" element={<ActProvidingServiceDetailPage />} />
            <Route path="/product-delivery-protocols/:id" element={<div>Логістичний шлях відкрито</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Providing Service Acts canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProvidingServiceActsRegistry).mockResolvedValue({ Items: [ACT] })
    vi.mocked(getProvidingServiceActOverviewDetails).mockResolvedValue(ACT)
    vi.mocked(getProvidingServiceActLogisticWayDetails).mockResolvedValue(ACT)
    vi.mocked(updateActProvidingService).mockResolvedValue(ACT)
  })

  it('does not mount the registry model without the page permission', () => {
    renderRoute('/act-providing-services')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProvidingServiceActsRegistry).not.toHaveBeenCalled()
  })

  it('keeps overview and logistic-way controls independently guarded', async () => {
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Page.View)
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Overview.Open)
    renderRoute('/act-providing-services')

    fireEvent.click(await screen.findByRole('button', { name: 'ACT-1' }))

    expect(screen.getByRole('button', { name: 'Огляд' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Логістичний шлях' })).toBeNull()
  })

  it('revalidates logistic-way navigation through its scoped details route', async () => {
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Page.View)
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.LogisticWay.Open)
    renderRoute('/act-providing-services')

    fireEvent.click(await screen.findByRole('button', { name: 'ACT-1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Логістичний шлях' }))

    await waitFor(() => expect(getProvidingServiceActLogisticWayDetails).toHaveBeenCalledWith('act-1'))
    expect(await screen.findByText('Логістичний шлях відкрито')).toBeTruthy()
  })

  it('does not mount the overview detail model on a denied deep link', () => {
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Page.View)
    renderRoute('/act-providing-services/act-1')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProvidingServiceActOverviewDetails).not.toHaveBeenCalled()
  })

  it('loads a permitted deep link through the overview-scoped route', async () => {
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Page.View)
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Overview.Open)
    renderRoute('/act-providing-services/act-1')

    await waitFor(() => expect(getProvidingServiceActOverviewDetails).toHaveBeenCalledWith('act-1'))
    expect((await screen.findByLabelText('Коментар') as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })

  it('requires the independent edit permission for fields and save', async () => {
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Page.View)
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Overview.Open)
    allowedPermissions.add(PermissionKeys.ProvidingServiceActs.Act.Edit)
    renderRoute('/act-providing-services/act-1')

    const comment = await screen.findByLabelText('Коментар')
    expect((comment as HTMLTextAreaElement).disabled).toBe(false)

    fireEvent.change(comment, { target: { value: 'Оновлений коментар' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateActProvidingService).toHaveBeenCalledWith(expect.objectContaining({
      Comment: 'Оновлений коментар',
      NetUid: 'act-1',
    })))
  })
})
