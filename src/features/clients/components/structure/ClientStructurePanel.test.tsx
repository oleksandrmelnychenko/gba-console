import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getClientGroups, getClientWorkplaces } from '../../api/clientLookupsApi'
import type { Client } from '../../types'
import { ClientStructurePanel } from './ClientStructurePanel'

vi.mock('../../api/clientLookupsApi', () => ({
  getClientGroups: vi.fn(),
  getClientWorkplaces: vi.fn(),
}))

vi.mock('../../api/clientCabinetApi', () => ({
  createClientWorkplace: vi.fn(),
  getClientSubClients: vi.fn().mockResolvedValue([]),
  removeClientWorkplace: vi.fn(),
  updateClientWorkplace: vi.fn(),
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('./SubClientsPanel', () => ({
  SubClientsPanel: ({ relationKind }: { relationKind: string }) => (
    <div data-testid={`relationship-panel-${relationKind}`}>{relationKind}</div>
  ),
}))

vi.mock('./WorkplacesPanel', () => ({ WorkplacesPanel: () => <div>workplaces</div> }))
vi.mock('./DeliveryRecipientsPanel', () => ({ DeliveryRecipientsPanel: () => <div>delivery recipients</div> }))
vi.mock('./GroupsModal', () => ({ GroupsModal: () => null }))
vi.mock('../pricing/ServicePayersPanel', () => ({ ServicePayersPanel: () => <div>service payers</div> }))

const getClientGroupsMock = vi.mocked(getClientGroups)
const getClientWorkplacesMock = vi.mocked(getClientWorkplaces)

describe('ClientStructurePanel', () => {
  beforeEach(() => {
    getClientGroupsMock.mockResolvedValue([])
    getClientWorkplacesMock.mockResolvedValue([])
  })

  it('offers separate structural-unit and subclient tabs on every client card', async () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <MemoryRouter>
            <ClientStructurePanel
              client={{ Id: 1, NetUid: 'client-1' } as Client}
              onChange={vi.fn()}
            />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('tab', { name: 'Структурні підрозділи' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Сабклієнти' })).toBeTruthy()
    expect(screen.getByTestId('relationship-panel-structural-unit')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Сабклієнти' }))

    expect(await screen.findByTestId('relationship-panel-subclient')).toBeTruthy()
  })
})
