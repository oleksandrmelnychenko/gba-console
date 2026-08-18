import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IncompleteSalesOnlineShopPage } from './IncompleteSalesOnlineShopPage'

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getIncompleteSales: vi.fn(),
  updateIncompleteSale: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { Id: 7 } }),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: mocks.can }),
}))

vi.mock('../../clients/api/onlineShopClientsApi', () => ({
  getIncompleteSales: mocks.getIncompleteSales,
  updateIncompleteSale: mocks.updateIncompleteSale,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    emptyText,
  }: {
    columns: Array<{ id: string; cell?: (item: never) => ReactNode }>
    data: Array<{ RetailClient?: { FullName?: string } }>
    emptyText: string
  }) => (
    <div>
      {data.length > 0
        ? data.map((sale, index) => (
            <div key={index}>
              {sale.RetailClient?.FullName}
              {columns.find((column) => column.id === 'actions')?.cell?.(sale as never)}
            </div>
          ))
        : emptyText}
    </div>
  ),
}))

function todayInputValue(): string {
  const today = new Date()

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

describe('IncompleteSalesOnlineShopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.getIncompleteSales.mockResolvedValue([
      {
        MisplacedSaleStatus: 0,
        NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        OrderItems: [],
        RetailClient: { FullName: 'Тестовий покупець' },
      },
    ])
  })

  it('loads and displays unfinished sales for the complete current business day', async () => {
    render(
      <MantineProvider>
        <IncompleteSalesOnlineShopPage />
      </MantineProvider>,
    )

    const today = todayInputValue()

    await waitFor(() => expect(mocks.getIncompleteSales).toHaveBeenCalledWith({
      from: today,
      isAccepted: false,
      number: undefined,
      to: today,
    }))
    expect(await screen.findByText('Тестовий покупець')).toBeTruthy()
  })

  it('does not render transition or client-navigation actions without their business permissions', async () => {
    mocks.can.mockReturnValue(false)
    mocks.getIncompleteSales.mockResolvedValueOnce([
      {
        MisplacedSaleStatus: 0,
        NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        OrderItems: [],
        RetailClient: {
          FullName: 'Клієнт без прав',
          NetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
        WithSales: true,
      },
    ])

    render(
      <MantineProvider>
        <IncompleteSalesOnlineShopPage />
      </MantineProvider>,
    )

    expect(await screen.findByText('Клієнт без прав')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Продажі клієнта' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Закріпити за собою' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Позначити виконаним' })).toBeNull()
  })

  it('renders only the permitted business transition for each sale state', async () => {
    mocks.can.mockImplementation((key: string) => (
      key === 'sales.incomplete_online_shop.sale.assign_to_self'
    ))
    mocks.getIncompleteSales.mockResolvedValueOnce([
      {
        MisplacedSaleStatus: 0,
        NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        OrderItems: [],
        RetailClient: { FullName: 'Вільний продаж' },
      },
      {
        MisplacedSaleStatus: 1,
        NetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        OrderItems: [],
        RetailClient: { FullName: 'Закріплений продаж' },
        UserId: 7,
      },
    ])

    render(
      <MantineProvider>
        <IncompleteSalesOnlineShopPage />
      </MantineProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Закріпити за собою' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Позначити виконаним' })).toBeNull()
  })
})
