import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getClientCommercialStructureForRegistry, getClientsForRegistry } from '../api/clientsApi'
import type { Client, ClientCommercialStructure } from '../types'
import { ClientActionsModal, ClientsPage } from './ClientsPage'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/clientsApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/clientsApi')>()
  return {
    ...original,
    getClientsForRegistry: vi.fn().mockResolvedValue([]),
    getClientCount: vi.fn().mockResolvedValue(0),
    getClientTypes: vi.fn().mockResolvedValue([]),
    getClientFilterItems: vi.fn().mockResolvedValue([]),
    getClientCommercialStructureForRegistry: vi.fn(),
  }
})

const getClientCommercialStructureMock = vi.mocked(getClientCommercialStructureForRegistry)

describe('ClientsPage toolbar', () => {
  it('removes the client tree entry while keeping the registry and new-client action', async () => {
    render(
      <MemoryRouter initialEntries={['/clients?roleIds=1']}>
        <MantineProvider env="test" theme={theme}>
          <I18nProvider>
            <Routes>
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/new/role" element={<p>Створення клієнта</p>} />
            </Routes>
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Клієнтів не знайдено')).toBeTruthy()
    expect(getClientsForRegistry).toHaveBeenCalledWith(
      expect.objectContaining({ typeRoleFilter: '1' }),
      expect.any(AbortSignal),
    )
    expect(screen.queryByRole('button', { name: 'Дерево клієнтів' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Новий клієнт' }))
    expect(await screen.findByText('Створення клієнта')).toBeTruthy()
  })
})

describe('ClientActionsModal', () => {
  it('uses the commercial API card count instead of the direct subclient count', async () => {
    const client = {
      NetUid: '3a0ccabd-a781-45c3-a01c-6b50355c77ff',
      FullName: 'ТОВ МАГРОМ',
      IsActive: true,
      SubClients: [{}, {}, {}],
    } as Client
    getClientCommercialStructureMock.mockResolvedValueOnce({
      CardCount: 6,
    } as ClientCommercialStructure)

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientActionsModal
            canEditReservationDays={false}
            canOpenCashFlow={false}
            canOpenStructure={true}
            canToggleActive={true}
            canViewClient={true}
            client={client}
            isActiveLoading={false}
            onCashFlow={vi.fn()}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onReserveDays={vi.fn()}
            onStructure={vi.fn()}
            onSwitchActive={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Структура клієнта (6)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Структура клієнта (3)' })).toBeNull()
    expect(getClientCommercialStructureMock).toHaveBeenCalledWith(
      client.NetUid,
      expect.any(AbortSignal),
    )
  })

  it('does not offer a manual lifecycle transition for a source-managed card', async () => {
    const client = {
      NetUid: '3a0ccabd-a781-45c3-a01c-6b50355c77ff',
      FullName: 'ТОВ МАГРОМ',
      IsActive: true,
      SourceAmgCode: 0,
    } as Client
    getClientCommercialStructureMock.mockResolvedValueOnce({
      CardCount: 6,
    } as ClientCommercialStructure)

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientActionsModal
            canEditReservationDays={false}
            canOpenCashFlow={false}
            canOpenStructure={false}
            canToggleActive={true}
            canViewClient={true}
            client={client}
            isActiveLoading={false}
            onCashFlow={vi.fn()}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onReserveDays={vi.fn()}
            onStructure={vi.fn()}
            onSwitchActive={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Позначити неактивним' })).toBeNull()
    expect(screen.getByText('Статус керується синхронізацією з 1С')).toBeTruthy()
  })

  it('does not load or expose independent actions when their permissions are absent', () => {
    const client = {
      NetUid: '3a0ccabd-a781-45c3-a01c-6b50355c77ff',
      FullName: 'ТОВ МАГРОМ',
      IsActive: true,
    } as Client
    getClientCommercialStructureMock.mockClear()

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientActionsModal
            canEditReservationDays={false}
            canOpenCashFlow={false}
            canOpenStructure={false}
            canToggleActive={false}
            canViewClient={true}
            client={client}
            isActiveLoading={false}
            onCashFlow={vi.fn()}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onReserveDays={vi.fn()}
            onStructure={vi.fn()}
            onSwitchActive={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: 'Відкрити картку' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Структура клієнта/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Дні резерву' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Позначити неактивним' })).toBeNull()
    expect(getClientCommercialStructureMock).not.toHaveBeenCalled()
  })
})
