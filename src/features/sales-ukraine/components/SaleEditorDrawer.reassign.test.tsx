import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { Client } from '../../clients/types'
import type { SalesUkraineSale } from '../types'
import { WizardReassignSaleModal } from './new-sale-wizard/WizardReassignSaleModal'

const mocks = vi.hoisted(() => ({
  getRootClientBySubClientNetId: vi.fn(),
  getWizardClientStructure: vi.fn(),
  getWizardHeaderClient: vi.fn(),
  onReassigned: vi.fn(),
  switchSale: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: React.ReactNode; opened: boolean; title: React.ReactNode }) => (
    opened ? <div aria-label={String(title)} role="dialog">{children}</div> : null
  ),
}))

vi.mock('../../clients/api/clientCabinetApi', () => ({
  getRootClientBySubClientNetId: mocks.getRootClientBySubClientNetId,
}))

vi.mock('../api/salesUkraineApi', () => ({
  switchSale: mocks.switchSale,
}))

vi.mock('./new-sale-wizard/wizardSaleHeaderApi', () => ({
  getWizardClientStructure: mocks.getWizardClientStructure,
  getWizardHeaderClient: mocks.getWizardHeaderClient,
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

const sale = {
  NetUid: 'sale-1',
  SaleNumber: { Value: 'ONLINE-1' },
} as SalesUkraineSale

const rootClient = {
  ClientAgreements: [{ Agreement: { Name: 'ShopClient VAT' }, NetUid: 'agreement-root' }],
  FullName: 'ShopClient',
  Id: 1,
  NetUid: 'client-root',
} as Client

const subClient = {
  ClientAgreements: [{ Agreement: { Name: 'Цільовий договір' }, NetUid: 'agreement-sub' }],
  FullName: 'Клієнт 4',
  Id: 2,
  IsSubClient: true,
  NetUid: 'client-sub',
} as Client

const tradePoint = {
  ClientAgreements: [{ Agreement: { Name: 'Договір торгової точки' }, NetUid: 'agreement-point' }],
  FullName: 'Торгова точка 4',
  Id: 3,
  IsTradePoint: true,
  NetUid: 'client-point',
} as Client

function renderModal(client: Client) {
  return render(
    <MantineProvider theme={theme}>
      <WizardReassignSaleModal
        client={client}
        opened
        permissionFlow="edit"
        sale={sale}
        onClose={vi.fn()}
        onReassigned={mocks.onReassigned}
      />
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRootClientBySubClientNetId.mockResolvedValue(null)
  mocks.getWizardClientStructure.mockResolvedValue([subClient, tradePoint])
  mocks.getWizardHeaderClient.mockResolvedValue(rootClient)
  mocks.switchSale.mockResolvedValue(sale)
})

describe('online-shop sale editor reassignment structure', () => {
  it('automatically loads the root, sub-client, and trade-point list instead of requiring the empty search from Screenshot_274.png', async () => {
    renderModal({ NetUid: 'client-root' } as Client)

    await waitFor(() => expect(mocks.getWizardHeaderClient).toHaveBeenCalledWith('client-root', 'edit'))
    expect(mocks.getWizardClientStructure).toHaveBeenCalledWith('client-root')
    expect(await screen.findByText('ShopClient')).toBeTruthy()
    expect(screen.getByText('Клієнт 4')).toBeTruthy()
    expect(screen.getByText('Торгова точка 4')).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Клієнт' })).toBeNull()
  })

  it('resolves a sub-client root and switches the sale to a selected agreement inside that structure', async () => {
    mocks.getRootClientBySubClientNetId.mockResolvedValueOnce({
      RootClient: { NetUid: 'client-root' },
    })
    renderModal({ IsSubClient: true, NetUid: 'current-sub-client' } as Client)

    await waitFor(() => expect(mocks.getRootClientBySubClientNetId).toHaveBeenCalledWith('current-sub-client'))
    expect(mocks.getWizardHeaderClient).toHaveBeenCalledWith('client-root', 'edit')

    const agreementLabel = await screen.findByText('Цільовий договір')
    const agreementButton = agreementLabel.closest('button')

    expect(agreementButton).not.toBeNull()
    fireEvent.click(agreementButton as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити' }))

    await waitFor(() => expect(mocks.switchSale).toHaveBeenCalledWith(
      'sale-1',
      'agreement-sub',
      { operationId: '11111111-1111-4111-8111-111111111111' },
    ))
    expect(mocks.onReassigned).toHaveBeenCalledWith(sale)
  })
})
