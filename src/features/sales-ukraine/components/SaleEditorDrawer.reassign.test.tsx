import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineClientOption, SalesUkraineSale } from '../types'
import { OnlineShopSaleReassignModal } from './SaleEditorDrawer'

const mocks = vi.hoisted(() => ({
  getOnlineShopReassignmentAgreements: vi.fn(),
  onReassigned: vi.fn(),
  searchOnlineShopReassignmentClients: vi.fn(),
  switchSale: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: React.ReactNode; opened: boolean; title: React.ReactNode }) => (
    opened ? <div aria-label={String(title)} role="dialog">{children}</div> : null
  ),
}))

vi.mock('../api/salesUkraineApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/salesUkraineApi')>()),
  getOnlineShopReassignmentAgreements: mocks.getOnlineShopReassignmentAgreements,
  searchOnlineShopReassignmentClients: mocks.searchOnlineShopReassignmentClients,
  switchSale: mocks.switchSale,
}))

vi.mock('../usePersistentSaleJsonMutation', () => ({
  usePersistentSaleJsonMutationRunner: () => async (
    _context: string,
    payload: object,
    request: (payload: object, operation: { operationId: string }) => Promise<unknown>,
  ) => ({
    completed: true,
    result: await request(payload, { operationId: '11111111-1111-4111-8111-111111111111' }),
  }),
}))

const currentShopClient = {
  FullName: 'ShopClient',
  NetUid: 'client-shop',
  RegionCode: { Value: 'SHOP' },
} as SalesUkraineClientOption

const targetClient = {
  FullName: 'Клієнт 4',
  NetUid: 'client-4',
  RegionCode: { Value: '4' },
} as SalesUkraineClientOption

const sale = {
  ClientAgreement: {
    Client: currentShopClient,
    NetUid: 'agreement-shop',
  },
  NetUid: 'sale-1',
  Order: { OrderSource: 0 },
  RetailClient: { NetUid: 'retail-client-1' },
  SaleNumber: { Value: 'KAВ00002721' },
} as SalesUkraineSale

function renderModal() {
  return render(
    <MantineProvider theme={theme}>
      <OnlineShopSaleReassignModal
        opened
        sale={sale}
        onClose={vi.fn()}
        onReassigned={mocks.onReassigned}
      />
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.searchOnlineShopReassignmentClients.mockResolvedValue([currentShopClient, targetClient])
  mocks.getOnlineShopReassignmentAgreements.mockResolvedValue([
    { Agreement: { Name: 'Цільовий договір' }, NetUid: 'agreement-4' },
  ])
  mocks.switchSale.mockResolvedValue(sale)
})

describe('online-shop post-create sale reassignment', () => {
  it('loads a compact target-client list on open instead of the ShopClient details from Screenshot_286.png', async () => {
    renderModal()

    await waitFor(() => expect(mocks.searchOnlineShopReassignmentClients).toHaveBeenCalledWith(
      '',
      expect.any(AbortSignal),
    ))

    const clientSelect = screen.getByRole('combobox', { name: 'Клієнт' })
    fireEvent.click(clientSelect)

    expect(await screen.findByText('4 · Клієнт 4')).toBeTruthy()
    expect(screen.queryByText('SHOP · ShopClient')).toBeNull()
    expect(screen.queryByText('Доступний аванс')).toBeNull()
    expect(screen.queryByText('Кредитний ліміт')).toBeNull()
  })

  it('searches by the one-character client code from Screenshot_274.png and reassigns to its agreement', async () => {
    renderModal()

    const clientSelect = screen.getByRole('combobox', { name: 'Клієнт' })
    fireEvent.change(clientSelect, { target: { value: '4' } })

    await waitFor(() => expect(mocks.searchOnlineShopReassignmentClients).toHaveBeenCalledWith(
      '4',
      expect.any(AbortSignal),
    ))
    fireEvent.click(await screen.findByText('4 · Клієнт 4'))

    await waitFor(() => expect(mocks.getOnlineShopReassignmentAgreements).toHaveBeenCalledWith('client-4'))
    const agreementSelect = screen.getByRole('combobox', { name: 'Договір' })
    fireEvent.click(agreementSelect)
    fireEvent.click(await screen.findByText('Цільовий договір'))
    fireEvent.click(screen.getByRole('button', { name: 'Переназначити' }))

    await waitFor(() => expect(mocks.switchSale).toHaveBeenCalledWith(
      'sale-1',
      'agreement-4',
      { operationId: '11111111-1111-4111-8111-111111111111' },
    ))
    expect(mocks.onReassigned).toHaveBeenCalledOnce()
  })
})
