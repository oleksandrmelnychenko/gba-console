import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ClientActionsButton } from './ClientActionsButton'
import { getClientForRegistryById } from '../api/clientFormApi'
import { updateClientOrderExpireDaysForRegistry } from '../api/clientsApi'

const permissions = new Set<string>()
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: (key: string) => permissions.has(key) }) }))
vi.mock('../api/clientFormApi', () => ({ getClientForRegistryById: vi.fn() }))
vi.mock('../api/clientsApi', () => ({
  updateClientOrderExpireDaysForRegistry: vi.fn(),
  switchClientActiveStateForRegistry: vi.fn(),
  getClientCommercialStructureForRegistry: vi.fn(),
  mutateClientIdentityForStructure: vi.fn(),
}))

function LocationProof() {
  const location = useLocation()
  return <output data-testid="location">{JSON.stringify({ path: location.pathname, state: location.state })}</output>
}
function mount() {
  return render(<MemoryRouter initialEntries={['/clients/accounting-cash-flow/client-1']}>
    <MantineProvider><I18nProvider><ClientActionsButton netUid="client-1" onChanged={vi.fn()} /><LocationProof /></I18nProvider></MantineProvider>
  </MemoryRouter>)
}

describe('client actions from a report', () => {
  beforeEach(() => {
    permissions.clear()
    vi.clearAllMocks()
    vi.mocked(getClientForRegistryById).mockResolvedValue({ NetUid: 'client-1', FullName: 'Клієнт звіту', OrderExpireDays: 3, SourceFenixId: '12' })
  })
  it('does not offer actions or fetch client details without permissions', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Дії клієнта' })).toBeNull()
    expect(getClientForRegistryById).not.toHaveBeenCalled()
  })
  it('opens the registry menu and preserves the report as the card return location', async () => {
    permissions.add(PermissionKeys.Clients.Details.Open)
    permissions.add(PermissionKeys.Clients.Status.ToggleActive)
    mount()
    expect(getClientForRegistryById).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Дії клієнта' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити картку' }))
    expect(getClientForRegistryById).toHaveBeenCalledWith('client-1')
    expect(screen.queryByRole('button', { name: 'Позначити неактивним' })).toBeNull()
    const location = JSON.parse(screen.getByTestId('location').textContent || '{}')
    expect(location.path).toBe('/clients/edit/client-1/general-information')
    expect(location.state.returnPath).toBe('/clients/accounting-cash-flow/client-1')
    expect(location.state.backgroundLocation.pathname).toBe('/clients/accounting-cash-flow/client-1')
  })
  it('opens existing reservation days without mutating them and allows returning to actions', async () => {
    permissions.add(PermissionKeys.Clients.ReservationDays.Edit)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Дії клієнта' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Дні резерву' }))
    const field = await screen.findByRole('textbox', { name: 'Днів резерву' })
    expect((field as HTMLInputElement).value).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Дні резерву' })).toBeTruthy())
    expect(updateClientOrderExpireDaysForRegistry).not.toHaveBeenCalled()
  })
})
