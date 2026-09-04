import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { SalesUkraineSale } from '../../sales-ukraine/types'
import { SalesTab } from './SalesTab'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../../shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))

vi.mock('../../sales-ukraine/usePersistentSaleJsonMutation', () => ({
  usePersistentSaleJsonMutationRunner: () => vi.fn(),
}))

vi.mock('../../sales-ukraine/components/SaleDetailsDrawer', () => ({
  SaleDetailsDrawer: ({ sale }: { sale: SalesUkraineSale | null }) => (
    sale ? <div data-testid="carrier-drawer">{sale.Transporter?.Name}</div> : null
  ),
}))

const apiRequestMock = vi.mocked(apiRequest)
const sale = {
  ChangedToInvoice: '2026-09-03T15:29:00Z',
  ClientAgreement: {
    Agreement: { Currency: { Code: 'UAH' } },
    Client: { FullName: 'Хмельницький - ГІЛЕЯ', RegionCode: { Value: 'ХМ01502' } },
  },
  Comment: '',
  Id: 2853,
  NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  Order: { OrderItems: [{ Id: 1, NetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', Qty: 1 }] },
  SaleNumber: { Value: 'КСН00002853' },
  TotalAmountLocal: 864.03,
  TotalRowsQty: 1,
  Transporter: { Id: 1, Name: 'Нова пошта' },
}

describe('SalesTab carrier details workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    apiRequestMock.mockReset().mockImplementation(async (path) => {
      if (path === '/sales/warehouse-ukraine/invoices/registry') {
        return { Items: [sale], TotalRowsQty: 1 }
      }

      if (path === '/sales/warehouse-ukraine/invoices/details') {
        return {
          LifeCycleLine: [],
          Sale: sale,
          SaleExchangeRates: [],
        }
      }

      throw new Error(`Unexpected API path: ${path}`)
    })
  })

  it('opens the carrier drawer from the invoices table when details arrive in the server envelope', async () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <SalesTab
            canCreateShipment={false}
            canPrintEditAct={false}
            canPrintInvoice={false}
            canUpdatePrintStatus={false}
            onCreateShipment={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith(
      '/sales/warehouse-ukraine/invoices/registry',
      expect.any(Object),
    ))
    fireEvent.click(await screen.findByText('Нова пошта'))

    expect((await screen.findByTestId('carrier-drawer')).textContent).toBe('Нова пошта')
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/invoices/details', {
        query: { netId: sale.NetUid },
      })
    })
    expect(screen.queryByText('Не вдалося завантажити повні дані продажу')).toBeNull()
  })
})
