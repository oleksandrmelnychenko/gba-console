import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { CounterpartyGroupsPage } from './CounterpartyGroupsPage'

const mocks = vi.hoisted(() => ({
  can: vi.fn<(permissionKey: string) => boolean>(),
  tree: vi.fn(),
  members: vi.fn(),
  move: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: mocks.can,
    cannot: (permissionKey: string) => !mocks.can(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ permissionKey, children, fallback }: { permissionKey: string, children: React.ReactNode, fallback?: React.ReactNode }) =>
    mocks.can(permissionKey) ? children : fallback ?? null,
}))

vi.mock('../api/counterpartyGroupsApi', () => ({
  getCounterpartyGroupTree: mocks.tree,
  getCounterpartyGroupMembers: mocks.members,
  moveClientsToCounterpartyGroup: mocks.move,
  createCounterpartyGroup: mocks.create,
  updateCounterpartyGroup: mocks.update,
  deleteCounterpartyGroup: mocks.remove,
}))

const buyers = '00000000-0000-0000-0000-000000000001'
const kharkiv = '00000000-0000-0000-0000-000000000003'
const kyiv = '00000000-0000-0000-0000-000000000004'
const client = '00000000-0000-0000-0000-000000000099'

function node(netUid: string, name: string, parent: string | null, overrides: Record<string, unknown> = {}) {
  return { NetUid: netUid, ParentNetUid: parent, Key: netUid.replace(/-/g, '').toUpperCase(), Name: name, Code: null,
    RegionCode: null, IsSystem: false, IsUngrouped: false, IsFromOneC: true, IsManuallyEdited: false, ClientCount: 1, ...overrides }
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/clients/groups']}>
          <CounterpartyGroupsPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('CounterpartyGroupsPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.tree.mockResolvedValue([
      node(buyers, 'Покупці', null, { IsSystem: true, Key: '8AB2005056C0000811DEFC4535BB4D40' }),
      node(kharkiv, 'Харків', buyers, { RegionCode: 'KH00' }),
      node(kyiv, 'Київ', buyers),
    ])
    mocks.members.mockResolvedValue({ Items: [{ ClientNetUid: client, Name: 'ФОП Скляр', RegionCode: 'KH01', Usreou: '123',
      IsPlaced: true, IsManuallyPlaced: false }], HasMore: false })
    mocks.move.mockResolvedValue(1)
  })

  it('refuses the page without the clients page permission', () => {
    mocks.can.mockReturnValue(false)
    renderPage()
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(mocks.tree).not.toHaveBeenCalled()
  })

  it('shows the tree and lets an editor move a checked client to another group', async () => {
    mocks.can.mockReturnValue(true)
    renderPage()
    fireEvent.click(await screen.findByText('Харків'))
    await screen.findByText('ФОП Скляр')
    expect(mocks.members).toHaveBeenLastCalledWith(kharkiv, '', 0, 50, expect.anything())
    fireEvent.click(screen.getByLabelText('Вибрати ФОП Скляр'))
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити (1)' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Група контрагентів' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Покупці / Київ', hidden: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити', hidden: true }))
    await waitFor(() => expect(mocks.move).toHaveBeenCalledWith([client], kyiv))
  })

  it('hides editing for a reader without the client edit permission', async () => {
    mocks.can.mockImplementation((permissionKey) => permissionKey === PermissionKeys.Clients.Page.View)
    renderPage()
    await screen.findByText('ФОП Скляр')
    expect(screen.queryByRole('button', { name: /Перемістити/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Підгрупа' })).toBeNull()
  })
})
