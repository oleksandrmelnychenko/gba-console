import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ClientActionsButton } from './ClientActionsButton'
import { parseReserveDays } from './reserveDays'
import { getClientForAccountingCashFlow } from '../api/clientFormApi'
import { updateClientOrderExpireDaysForRegistry } from '../api/clientsApi'

const permissions = new Set<string>()
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: (key: string) => permissions.has(key) }) }))
vi.mock('../api/clientFormApi', () => ({ getClientForAccountingCashFlow: vi.fn() }))
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
    vi.mocked(getClientForAccountingCashFlow).mockResolvedValue({ NetUid: 'client-1', FullName: 'Клієнт звіту', OrderExpireDays: 3, SourceFenixId: '12' })
  })
  it('does not offer actions or fetch client details without permissions', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Дії клієнта' })).toBeNull()
    expect(getClientForAccountingCashFlow).not.toHaveBeenCalled()
  })
  it('opens the registry menu and preserves the report as the card return location', async () => {
    permissions.add(PermissionKeys.Clients.Details.Open)
    permissions.add(PermissionKeys.Clients.Status.ToggleActive)
    mount()
    expect(getClientForAccountingCashFlow).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Дії клієнта' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити картку' }))
    expect(getClientForAccountingCashFlow).toHaveBeenCalledWith('client-1')
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
  it('rejects out-of-range or empty reservation days inline and sends only a valid value', async () => {
    permissions.add(PermissionKeys.Clients.ReservationDays.Edit)
    vi.mocked(updateClientOrderExpireDaysForRegistry).mockResolvedValue()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Дії клієнта' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Дні резерву' }))
    const field = await screen.findByRole('textbox', { name: 'Днів резерву' })
    for (const value of ['-5', '99999999', '']) {
      fireEvent.change(field, { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
      expect(await screen.findByText('Вкажіть ціле число днів від 0 до 365')).toBeTruthy()
    }
    expect(updateClientOrderExpireDaysForRegistry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Дні резерву' }))
    await screen.findByRole('textbox', { name: 'Днів резерву' })
    expect(screen.queryByText('Вкажіть ціле число днів від 0 до 365')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Днів резерву' }), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateClientOrderExpireDaysForRegistry).toHaveBeenCalledWith('client-1', 30))
  })
})

describe('parseReserveDays', () => {
  it('accepts whole days 0..365 only', () => {
    expect(parseReserveDays(0)).toBe(0)
    expect(parseReserveDays('365')).toBe(365)
    expect(parseReserveDays(-5)).toBeNull()
    expect(parseReserveDays(99999999)).toBeNull()
    expect(parseReserveDays('abc')).toBeNull()
    expect(parseReserveDays('')).toBeNull()
    expect(parseReserveDays(2.5)).toBeNull()
  })
})
