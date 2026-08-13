import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getClientCommercialStructure } from '../api/clientsApi'
import type { Client, ClientCommercialStructure } from '../types'
import { ClientActionsModal } from './ClientsPage'

vi.mock('../api/clientsApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/clientsApi')>()
  return {
    ...original,
    getClientCommercialStructure: vi.fn(),
  }
})

const getClientCommercialStructureMock = vi.mocked(getClientCommercialStructure)

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
            canOpenCashFlow={false}
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
})
