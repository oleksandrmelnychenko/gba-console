import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import {
  createClientWorkplace,
  removeClientWorkplace,
  updateClientWorkplace,
} from '../../api/clientCabinetApi'
import { getClientGroups, getClientWorkplaces } from '../../api/clientLookupsApi'
import { ClientStructurePanel } from './ClientStructurePanel'

const authState = vi.hoisted(() => ({
  permissions: new Set<string>(),
  t: (value: string) => value,
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (key: string) => authState.permissions.has(key),
  }),
}))

vi.mock('../../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: authState.t }),
}))

vi.mock('../../api/clientLookupsApi', () => ({
  getClientGroups: vi.fn(),
  getClientWorkplaces: vi.fn(),
}))

vi.mock('../../api/clientCabinetApi', () => ({
  createClientWorkplace: vi.fn(),
  removeClientWorkplace: vi.fn(),
  updateClientWorkplace: vi.fn(),
}))

vi.mock('../pricing/ServicePayersPanel', () => ({
  ServicePayersPanel: ({ disabled }: { disabled?: boolean }) => (
    <div>service-payers:{disabled ? 'disabled' : 'enabled'}</div>
  ),
}))

vi.mock('./GroupsModal', () => ({
  GroupsModal: ({ canManage }: { canManage: boolean }) => (
    <div data-allowed={canManage} data-testid="groups-permission" />
  ),
}))

vi.mock('./DeliveryRecipientsPanel', () => ({
  DeliveryRecipientsPanel: ({ canCreate, canDelete }: { canCreate: boolean; canDelete: boolean }) => (
    <div data-create={canCreate} data-delete={canDelete} data-testid="recipients-permission" />
  ),
}))

vi.mock('./SubClientsPanel', () => ({
  SubClientsPanel: ({ canCreateClient, canOpenDetails }: { canCreateClient: boolean; canOpenDetails: boolean }) => (
    <div data-create={canCreateClient} data-open={canOpenDetails} data-testid="subclients-permission" />
  ),
}))

vi.mock('./WorkplacesPanel', () => ({
  WorkplacesPanel: ({
    canDelete,
    canManage,
    onCreate,
    onRemove,
    onUpdate,
  }: {
    canDelete: boolean
    canManage: boolean
    onCreate: (value: { NetUid: string }) => void
    onRemove: (value: { NetUid: string }) => void
    onUpdate: (value: { NetUid: string }) => void
  }) => (
    <div data-delete={canDelete} data-manage={canManage} data-testid="workplaces-permission">
      <button onClick={() => onCreate({ NetUid: 'workplace-1' })}>mock-create-workplace</button>
      <button onClick={() => onUpdate({ NetUid: 'workplace-1' })}>mock-update-workplace</button>
      <button onClick={() => onRemove({ NetUid: 'workplace-1' })}>mock-remove-workplace</button>
    </div>
  ),
}))

const createClientWorkplaceMock = vi.mocked(createClientWorkplace)
const removeClientWorkplaceMock = vi.mocked(removeClientWorkplace)
const updateClientWorkplaceMock = vi.mocked(updateClientWorkplace)

describe('ClientStructurePanel permissions', () => {
  beforeEach(() => {
    authState.permissions = new Set()
    vi.mocked(getClientGroups).mockReset().mockResolvedValue([])
    vi.mocked(getClientWorkplaces).mockReset().mockResolvedValue([])
    createClientWorkplaceMock.mockReset().mockResolvedValue(null)
    removeClientWorkplaceMock.mockReset().mockResolvedValue(null)
    updateClientWorkplaceMock.mockReset().mockResolvedValue(null)
  })

  it('does not load the structure model without structure.open', () => {
    renderPanel()

    expect(getClientGroups).not.toHaveBeenCalled()
    expect(getClientWorkplaces).not.toHaveBeenCalled()
  })

  it('fails closed for every independent structure mutation', async () => {
    authState.permissions = new Set([PermissionKeys.Clients.Structure.Open])
    renderPanel()

    await waitFor(() => expect(getClientGroups).toHaveBeenCalled())

    expect(screen.queryByLabelText('Підгрупи')).toBeNull()
    expect(screen.queryByLabelText('Новий користувач')).toBeNull()
    expect(screen.getByTestId('groups-permission').getAttribute('data-allowed')).toBe('false')
    expect(screen.getByTestId('recipients-permission').getAttribute('data-create')).toBe('false')
    expect(screen.getByTestId('recipients-permission').getAttribute('data-delete')).toBe('false')
    expect(screen.getByTestId('subclients-permission').getAttribute('data-create')).toBe('false')
    expect(screen.getByTestId('subclients-permission').getAttribute('data-open')).toBe('false')
    expect(screen.getByText('service-payers:disabled')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Робочі місця' }))
    expect(screen.getByTestId('workplaces-permission').getAttribute('data-manage')).toBe('false')
    expect(screen.getByTestId('workplaces-permission').getAttribute('data-delete')).toBe('false')

    fireEvent.click(screen.getByText('mock-create-workplace'))
    fireEvent.click(screen.getByText('mock-update-workplace'))
    fireEvent.click(screen.getByText('mock-remove-workplace'))

    expect(createClientWorkplaceMock).not.toHaveBeenCalled()
    expect(updateClientWorkplaceMock).not.toHaveBeenCalled()
    expect(removeClientWorkplaceMock).not.toHaveBeenCalled()
  })

  it('maps each granted permission to only its matching control and API action', async () => {
    authState.permissions = new Set([
      PermissionKeys.Clients.Client.Create,
      PermissionKeys.Clients.Client.Edit,
      PermissionKeys.Clients.Details.Open,
      PermissionKeys.Clients.Structure.Open,
      PermissionKeys.Clients.Structure.ManageGroups,
      PermissionKeys.Clients.Structure.ManageWorkplaces,
      PermissionKeys.Clients.Structure.DeleteWorkplace,
      PermissionKeys.Clients.Structure.CreateDeliveryRecipient,
      PermissionKeys.Clients.Structure.DeleteDeliveryRecipient,
    ])
    renderPanel()

    await waitFor(() => expect(getClientGroups).toHaveBeenCalled())

    expect(screen.getByLabelText('Підгрупи')).toBeTruthy()
    expect(screen.getByLabelText('Новий користувач')).toBeTruthy()
    expect(screen.getByTestId('groups-permission').getAttribute('data-allowed')).toBe('true')
    expect(screen.getByTestId('recipients-permission').getAttribute('data-create')).toBe('true')
    expect(screen.getByTestId('recipients-permission').getAttribute('data-delete')).toBe('true')
    expect(screen.getByTestId('subclients-permission').getAttribute('data-create')).toBe('true')
    expect(screen.getByTestId('subclients-permission').getAttribute('data-open')).toBe('true')
    expect(screen.getByText('service-payers:enabled')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Робочі місця' }))
    expect(screen.getByTestId('workplaces-permission').getAttribute('data-manage')).toBe('true')
    expect(screen.getByTestId('workplaces-permission').getAttribute('data-delete')).toBe('true')

    fireEvent.click(screen.getByText('mock-create-workplace'))
    fireEvent.click(screen.getByText('mock-update-workplace'))
    fireEvent.click(screen.getByText('mock-remove-workplace'))

    await waitFor(() => {
      expect(createClientWorkplaceMock).toHaveBeenCalledTimes(1)
      expect(updateClientWorkplaceMock).toHaveBeenCalledTimes(1)
      expect(removeClientWorkplaceMock).toHaveBeenCalledWith('workplace-1')
    })
  })
})

function renderPanel() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/clients/edit/client-1']}>
        <ClientStructurePanel
          client={{ Id: 1, NetUid: 'client-1', ServicePayers: [] }}
          onChange={vi.fn()}
        />
      </MemoryRouter>
    </MantineProvider>,
  )
}
