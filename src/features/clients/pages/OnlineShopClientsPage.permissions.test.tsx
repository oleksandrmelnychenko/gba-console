import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { OnlineShopClientsPage } from './OnlineShopClientsPage'

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getOnlineShopClientsPage: vi.fn(),
  getRetailClientCart: vi.fn(),
  searchOnlineShopClientsPage: vi.fn(),
  translate: (key: string) => key,
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.translate }),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: mocks.can, isLoading: false }),
}))

vi.mock('@mantine/hooks', () => ({
  useDebouncedValue: (value: string) => [value],
}))

vi.mock('../api/onlineShopClientsApi', () => ({
  getOnlineShopClientsPage: mocks.getOnlineShopClientsPage,
  getRetailClientCart: mocks.getRetailClientCart,
  searchOnlineShopClientsPage: mocks.searchOnlineShopClientsPage,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: Array<{ FullName?: string }>
    onRowClick?: (client: { FullName?: string }) => void
  }) => (
    <div>
      {data.map((client, index) => onRowClick ? (
        <button key={index} onClick={() => onRowClick(client)}>
          {client.FullName}
        </button>
      ) : (
        <span key={index}>{client.FullName}</span>
      ))}
    </div>
  ),
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <div>{children}</div> : null
  ),
}))

vi.mock('../components/OnlineShopSalesPanel', () => ({
  OnlineShopSalesPanel: ({ netUid }: { netUid: string }) => (
    <div>Продажі: {netUid}</div>
  ),
}))

function renderPage() {
  return render(
    <MantineProvider>
      <OnlineShopClientsPage />
    </MantineProvider>,
  )
}

describe('OnlineShopClientsPage permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOnlineShopClientsPage.mockResolvedValue({
      Items: [{ FullName: 'Онлайн клієнт', NetUid: 'client-net-id' }],
      Total: 1,
    })
    mocks.getRetailClientCart.mockResolvedValue([])
  })

  it('does not mount registry data without page view', () => {
    mocks.can.mockReturnValue(false)

    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(mocks.getOnlineShopClientsPage).not.toHaveBeenCalled()
  })

  it('opens sales independently without reading the cart', async () => {
    mocks.can.mockImplementation((key: string) => (
      key === PermissionKeys.OnlineShopClients.Page.View
      || key === PermissionKeys.OnlineShopClients.Sales.Open
    ))

    renderPage()

    const row = await screen.findByRole('button', { name: 'Онлайн клієнт' })
    fireEvent.click(row)
    expect(mocks.getRetailClientCart).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Продажі клієнта' }))
    expect(screen.getByText('Продажі: client-net-id')).toBeTruthy()
  })

  it('loads the cart without exposing sales when only cart access is granted', async () => {
    mocks.can.mockImplementation((key: string) => (
      key === PermissionKeys.OnlineShopClients.Page.View
      || key === PermissionKeys.OnlineShopClients.Cart.Open
    ))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Онлайн клієнт' }))
    await waitFor(() => expect(mocks.getRetailClientCart).toHaveBeenCalledWith('client-net-id'))
    expect(screen.queryByRole('button', { name: 'Продажі клієнта' })).toBeNull()
  })
})
