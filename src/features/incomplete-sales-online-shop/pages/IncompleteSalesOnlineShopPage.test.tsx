import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IncompleteSalesOnlineShopPage } from './IncompleteSalesOnlineShopPage'

const mocks = vi.hoisted(() => ({
  getIncompleteSales: vi.fn(),
  updateIncompleteSale: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { Id: 7 } }),
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
  DataTable: ({ data, emptyText }: { data: Array<{ RetailClient?: { FullName?: string } }>; emptyText: string }) => (
    <div>
      {data.length > 0
        ? data.map((sale, index) => <div key={index}>{sale.RetailClient?.FullName}</div>)
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
})
