import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'

const mocks = vi.hoisted(() => ({
  acceptSaleForPacking: vi.fn(),
  getSalesUkraineSaleDetails: vi.fn(),
  getSalesUkraine: vi.fn(),
  getSalesUkraineOrganizations: vi.fn(),
  unlockSale: vi.fn(),
}))

vi.mock('../api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/salesUkraineApi')>(),
  acceptSaleForPacking: mocks.acceptSaleForPacking,
  getSalesUkraineSaleDetails: mocks.getSalesUkraineSaleDetails,
  getSalesUkraine: mocks.getSalesUkraine,
  getSalesUkraineOrganizations: mocks.getSalesUkraineOrganizations,
  unlockSale: mocks.unlockSale,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    session: { userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    user: { FirstName: 'Тест', LastName: 'Користувач', NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  }),
}))

vi.mock('../../../shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))

vi.mock('../usePersistentSaleJsonMutation', () => ({
  usePersistentSaleJsonMutationRunner: () => async (
    _context: string,
    payload: object,
    request: (payload: object, operation: { operationId: string }) => Promise<unknown>,
  ) => {
    try {
      const result = await request(payload, { operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })

      return { completed: true, result }
    } catch (error) {
      return { completed: false, error }
    }
  },
}))

import { SalesUkrainePage } from './SalesUkrainePage'

const saleNetUid = 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae'

function createSale(isLocked: boolean): SalesUkraineSale {
  return {
    BaseLifeCycleStatus: { Name: 'Received', SaleLifeCycleType: 4 },
    BaseSalePaymentStatus: { Name: 'Paid' },
    ClientAgreement: {
      Agreement: { Currency: { Code: 'EUR' }, Name: 'Тестовий договір' },
      Client: { FullName: 'Тестовий клієнт', RegionCode: { Value: 'КИЇ001' } },
    },
    Created: '2026-08-06T10:00:00Z',
    HasDetails: false,
    Id: 1016,
    IsAcceptedToPacking: isLocked ? false : true,
    IsLocked: isLocked,
    IsVatSale: false,
    NetUid: saleNetUid,
    Order: { OrderItems: [] },
    SaleNumber: { Value: 'КИЛ001016' },
    TotalAmount: 100,
    TotalAmountLocal: 100,
    TotalPositions: 0,
    TotalRowsQty: 1,
  }
}

describe('SalesUkrainePage unlock state', () => {
  beforeEach(() => {
    mocks.acceptSaleForPacking.mockReset()
    mocks.getSalesUkraineSaleDetails.mockReset()
    mocks.getSalesUkraine.mockReset()
    mocks.getSalesUkraineOrganizations.mockReset().mockResolvedValue([])
    mocks.unlockSale.mockReset()
  })

  it('removes the locked icon when unlock is acknowledged without a sale payload', async () => {
    const lockedSale = createSale(true)

    mocks.getSalesUkraine.mockResolvedValueOnce([lockedSale])
    mocks.unlockSale.mockResolvedValueOnce(null)

    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <Notifications />
        <I18nProvider>
          <MemoryRouter>
            <SalesUkrainePage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Тестовий клієнт')
    expect(container.querySelector('svg.lucide-lock')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Дії' }))
    fireEvent.click(await screen.findByText('Розблокувати'))
    await screen.findByText('Розблокувати рахунок?')
    fireEvent.click(screen.getByRole('button', { name: 'Розблокувати' }))

    await waitFor(() => expect(mocks.unlockSale).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(container.querySelector('svg.lucide-lock')).toBeNull())
    expect(mocks.getSalesUkraine).toHaveBeenCalledTimes(1)
  })

  it('removes the shipment-blocked icon when packing acceptance is acknowledged without a sale payload', async () => {
    const blockedSale = {
      ...createSale(false),
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ChangedToInvoice: '2026-08-06T11:00:00Z',
      IsAcceptedToPacking: false,
      IsVatSale: true,
    }
    mocks.getSalesUkraine.mockResolvedValueOnce([blockedSale])
    mocks.acceptSaleForPacking.mockResolvedValueOnce(null)

    render(
      <MantineProvider env="test" theme={theme}>
        <Notifications />
        <I18nProvider>
          <MemoryRouter>
            <SalesUkrainePage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Тестовий клієнт')
    fireEvent.click(screen.getByRole('button', { name: 'Розблокувати для відвантаження' }))
    await screen.findByText('Розблокувати продаж для відвантаження?')
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))

    await waitFor(() => expect(mocks.acceptSaleForPacking).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', {
      name: 'Розблокувати для відвантаження',
    })).toBeNull())
    expect(mocks.getSalesUkraine).toHaveBeenCalledTimes(1)
  })

  it('keeps one packing request in flight when confirmation is clicked repeatedly', async () => {
    const blockedSale = {
      ...createSale(false),
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ChangedToInvoice: '2026-08-06T11:00:00Z',
      IsAcceptedToPacking: false,
      IsVatSale: true,
    }
    let acknowledgePacking!: (sale: SalesUkraineSale | null) => void

    mocks.getSalesUkraine.mockResolvedValueOnce([blockedSale])
    mocks.acceptSaleForPacking.mockImplementationOnce(() => new Promise((resolve) => {
      acknowledgePacking = resolve
    }))

    render(
      <MantineProvider env="test" theme={theme}>
        <Notifications />
        <I18nProvider>
          <MemoryRouter initialEntries={['/sales/ukraine/all']}>
            <SalesUkrainePage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Тестовий клієнт')
    fireEvent.click(screen.getByRole('button', { name: 'Розблокувати для відвантаження' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Підтвердити' }))

    const pendingConfirmation = screen.getByRole('button', { name: 'Підтвердити' })
    expect(pendingConfirmation).toHaveProperty('disabled', true)
    fireEvent.click(pendingConfirmation)
    expect(mocks.acceptSaleForPacking).toHaveBeenCalledTimes(1)

    acknowledgePacking(null)

    await waitFor(() => expect(screen.queryByText('Розблокувати продаж для відвантаження?')).toBeNull())
    expect(mocks.acceptSaleForPacking).toHaveBeenCalledTimes(1)
  })

  it('closes or cancels packing confirmation without sending a request', async () => {
    const blockedSale = {
      ...createSale(false),
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ChangedToInvoice: '2026-08-06T11:00:00Z',
      IsAcceptedToPacking: false,
      IsVatSale: true,
    }

    mocks.getSalesUkraine.mockResolvedValueOnce([blockedSale])

    render(
      <MantineProvider env="test" theme={theme}>
        <Notifications />
        <I18nProvider>
          <MemoryRouter initialEntries={['/sales/ukraine/all']}>
            <SalesUkrainePage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Тестовий клієнт')
    fireEvent.click(screen.getByRole('button', { name: 'Розблокувати для відвантаження' }))
    await screen.findByText('Розблокувати продаж для відвантаження?')

    const closeConfirmation = document.querySelector<HTMLButtonElement>('.mantine-Modal-close')
    expect(closeConfirmation).not.toBeNull()
    fireEvent.click(closeConfirmation as HTMLButtonElement)

    await waitFor(() => expect(screen.queryByText('Розблокувати продаж для відвантаження?')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Розблокувати для відвантаження' }))
    await screen.findByText('Розблокувати продаж для відвантаження?')
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

    await waitFor(() => expect(screen.queryByText('Розблокувати продаж для відвантаження?')).toBeNull())
    expect(mocks.acceptSaleForPacking).not.toHaveBeenCalled()
  })
})
