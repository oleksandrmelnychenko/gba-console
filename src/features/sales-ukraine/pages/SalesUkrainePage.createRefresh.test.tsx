import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'

const mocks = vi.hoisted(() => ({
  getSalesUkraine: vi.fn(),
  getSalesUkraineOrganizations: vi.fn(),
  saleAddedHandler: null as ((payload: unknown) => void) | null,
}))

vi.mock('../api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/salesUkraineApi')>(),
  getSalesUkraine: mocks.getSalesUkraine,
  getSalesUkraineOrganizations: mocks.getSalesUkraineOrganizations,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    session: { userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    user: {
      FirstName: 'Тест',
      LastName: 'Користувач',
      NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
  }),
}))

vi.mock('../../../shared/realtime/events', () => ({
  realtimeEvents: {
    saleAdded: 'sale-added',
    saleUpdated: 'sale-updated',
  },
  useRealtimeEvent: (event: string, handler: (payload: unknown) => void) => {
    if (event === 'sale-added') {
      mocks.saleAddedHandler = handler
    }
  },
}))

vi.mock('../components/new-sale-wizard/NewSaleWizard', () => ({
  NewSaleWizard: ({ onCreated }: { onCreated: () => void }) => (
    <button type="button" onClick={onCreated}>Завершити тестове створення</button>
  ),
}))

import { SalesUkrainePage } from './SalesUkrainePage'

function createSale(id: number, clientName: string): SalesUkraineSale {
  return {
    BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
    BaseSalePaymentStatus: { Name: 'NotPaid' },
    ClientAgreement: {
      Agreement: { Currency: { Code: 'EUR' }, Name: 'Тестовий договір' },
      Client: { FullName: clientName, RegionCode: { Value: `КИЇ${id}` } },
    },
    Created: '2026-08-20T08:00:00Z',
    HasDetails: false,
    Id: id,
    IsAcceptedToPacking: true,
    IsLocked: false,
    IsVatSale: false,
    NetUid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    Order: { OrderItems: [] },
    SaleNumber: { Value: `КАВ${String(id).padStart(7, '0')}` },
    TotalAmount: 100,
    TotalAmountLocal: 4_500,
    TotalPositions: 0,
    TotalRowsQty: 1,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function renderPage() {
  return render(
    <MantineProvider theme={theme}>
      <Notifications />
      <I18nProvider>
        <MemoryRouter>
          <SalesUkrainePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

async function completeTestSaleCreation() {
  fireEvent.click(screen.getByRole('button', { name: 'Новий продаж' }))
  const completeButton = await screen.findByRole('button', { name: 'Завершити тестове створення' })

  await act(async () => {
    fireEvent.click(completeButton)
  })
}

describe('SalesUkrainePage refresh after sale creation', () => {
  beforeEach(() => {
    mocks.getSalesUkraine.mockReset()
    mocks.getSalesUkraineOrganizations.mockReset().mockResolvedValue([])
    mocks.saleAddedHandler = null
  })

  it('clears the disabled loading state when realtime refresh supersedes the post-create refresh', async () => {
    const currentSale = createSale(1, 'Поточний клієнт')
    const createdSale = createSale(2, 'Новий клієнт')
    const foregroundRefresh = deferred<SalesUkraineSale[]>()
    const realtimeRefresh = deferred<SalesUkraineSale[]>()

    mocks.getSalesUkraine
      .mockResolvedValueOnce([currentSale])
      .mockImplementationOnce((_filters, signal: AbortSignal) => {
        signal.addEventListener('abort', () => foregroundRefresh.reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        })

        return foregroundRefresh.promise
      })
      .mockReturnValueOnce(realtimeRefresh.promise)

    const { container } = renderPage()

    await screen.findByText('Поточний клієнт')
    await completeTestSaleCreation()
    await waitFor(() => expect(mocks.getSalesUkraine).toHaveBeenCalledTimes(2))

    const grid = container.querySelector<HTMLElement>('.sales-grid')
    expect(grid?.getAttribute('aria-busy')).toBe('true')
    expect(grid?.classList.contains('is-reloading')).toBe(true)

    expect(mocks.saleAddedHandler).not.toBeNull()
    act(() => mocks.saleAddedHandler?.(createdSale))
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 850))
    })
    await waitFor(() => expect(mocks.getSalesUkraine).toHaveBeenCalledTimes(3))

    await act(async () => {
      realtimeRefresh.resolve([createdSale, currentSale])
      await realtimeRefresh.promise
    })

    await screen.findByText('Новий клієнт')
    await waitFor(() => expect(grid?.hasAttribute('aria-busy')).toBe(false))
    expect(grid?.classList.contains('is-reloading')).toBe(false)
  })

  it('refreshes the registry and re-enables it after an ordinary successful create', async () => {
    const currentSale = createSale(1, 'Поточний клієнт')
    const createdSale = createSale(2, 'Новий клієнт')

    mocks.getSalesUkraine
      .mockResolvedValueOnce([currentSale])
      .mockResolvedValueOnce([createdSale, currentSale])

    const { container } = renderPage()

    await screen.findByText('Поточний клієнт')
    await completeTestSaleCreation()

    await screen.findByText('Новий клієнт')
    expect(mocks.getSalesUkraine).toHaveBeenCalledTimes(2)
    const grid = container.querySelector<HTMLElement>('.sales-grid')
    expect(grid?.hasAttribute('aria-busy')).toBe(false)
    expect(grid?.classList.contains('is-reloading')).toBe(false)
  })
})
