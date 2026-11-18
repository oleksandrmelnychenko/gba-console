import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupplyUkraineOrdersPage } from './SupplyUkraineOrdersPage'

const {
  canMock,
  getDirectSupplyUkraineOrdersMock,
  getSupplyOrderCurrenciesMock,
  getSupplyUkraineOrdersMock,
  hasPermissionMock,
  translateMock,
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getDirectSupplyUkraineOrdersMock: vi.fn(),
  getSupplyOrderCurrenciesMock: vi.fn(),
  getSupplyUkraineOrdersMock: vi.fn(),
  hasPermissionMock: vi.fn<(permissionKey: string) => boolean>(),
  translateMock: (value: string) => value,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: hasPermissionMock }),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: translateMock }),
}))

vi.mock('../../../shared/realtime/events', () => ({
  realtimeEvents: {
    supplyOrderAdded: 'supply-order-added',
    supplyOrderNotification: 'supply-order-notification',
  },
  useRealtimeEvent: vi.fn(),
}))

vi.mock('../api/supplyUkraineOrdersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/supplyUkraineOrdersApi')>()),
  getDirectSupplyUkraineOrders: getDirectSupplyUkraineOrdersMock,
  getSupplyOrderCurrencies: getSupplyOrderCurrenciesMock,
  getSupplyUkraineOrders: getSupplyUkraineOrdersMock,
}))

describe('SupplyUkraineOrdersPage search', () => {
  beforeEach(() => {
    window.localStorage.clear()
    canMock.mockReset()
    hasPermissionMock.mockReset()
    getSupplyUkraineOrdersMock.mockReset()
    getDirectSupplyUkraineOrdersMock.mockReset()
    getSupplyOrderCurrenciesMock.mockReset()
    canMock.mockReturnValue(true)
    hasPermissionMock.mockReturnValue(true)
    getSupplyUkraineOrdersMock.mockResolvedValue({ items: [], totalQty: 0 })
    getDirectSupplyUkraineOrdersMock.mockResolvedValue({
      items: [
        {
          Client: { FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "ПЛА-ТАН І К"', Id: 635333, Name: 'ПЛА-ТАН І К ТОВ (MARS+AYFAR)' },
          DateFrom: '2026-10-02T10:52:27',
          NetUid: 'order-1',
          SupplyInvoices: [],
          SupplyOrderNumber: { Number: 'К0000000392' },
        },
        {
          Client: { FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "ПЛА-ТАН І К"', Id: 631634, Name: 'ПЛА-ТАН І К ТОВ' },
          DateFrom: '2026-10-01T10:52:27',
          NetUid: 'order-2',
          SupplyInvoices: [],
          SupplyOrderNumber: { Number: 'К0000000391' },
        },
      ],
      totalQty: 2,
    })
    getSupplyOrderCurrenciesMock.mockResolvedValue([])
  })

  it('searches both order sources by number, invoice or article while typing', async () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <SupplyUkraineOrdersPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    await waitFor(() => expect(getDirectSupplyUkraineOrdersMock).toHaveBeenCalledTimes(1))
    expect(getDirectSupplyUkraineOrdersMock.mock.calls[0][0]).toMatchObject({ value: '' })

    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук' }), { target: { value: 'ONLY-B' } })

    await waitFor(() => expect(getDirectSupplyUkraineOrdersMock).toHaveBeenCalledTimes(2), { timeout: 2000 })
    expect(getDirectSupplyUkraineOrdersMock.mock.calls[1][0]).toMatchObject({ value: 'ONLY-B' })
    expect(getSupplyUkraineOrdersMock.mock.calls.at(-1)?.[0]).toMatchObject({ value: 'ONLY-B' })
  })

  it('shows the 1C card name of each supplier instead of the shared legal name', async () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <SupplyUkraineOrdersPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(await screen.findByText('ПЛА-ТАН І К ТОВ (MARS+AYFAR)')).toBeTruthy()
    expect(screen.getByText('ПЛА-ТАН І К ТОВ')).toBeTruthy()
    expect(screen.queryByText('ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "ПЛА-ТАН І К"')).toBeNull()
  })
})
