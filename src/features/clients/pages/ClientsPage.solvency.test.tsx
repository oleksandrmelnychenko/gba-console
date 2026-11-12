import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getClientsForRegistry } from '../api/clientsApi'
import { getClientSolvencyGaugeScores } from '../api/clientSolvencyApi'
import type { SolvencyScoreSlim } from '../solvencyTypes'
import type { Client } from '../types'
import { ClientsPage } from './ClientsPage'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/clientsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/clientsApi')>(),
  getClientsForRegistry: vi.fn(),
  getClientCount: vi.fn().mockResolvedValue(1),
  getClientTypes: vi.fn().mockResolvedValue([]),
  getClientFilterItems: vi.fn().mockResolvedValue([]),
  getClientIdentityAttentionBatchForRegistry: vi.fn().mockResolvedValue([]),
  getClientSourceQualityBatchForRegistry: vi.fn().mockResolvedValue([]),
}))

vi.mock('../api/clientSolvencyApi', () => ({
  getClientSolvencyGaugeScores: vi.fn(),
}))

const clientName = 'Чернівці - ФОП Мартинюк Сергій Анатолійович'
const client = {
  Id: 632206,
  NetUid: 'bccbafb2-7796-e7df-11ec-53626ca59d2c',
  FullName: clientName,
  OriginalRegionCode: 'BCE01600',
  IsActive: true,
  SubClients: [],
} as unknown as Client
const unavailable = 'SolvencyApi: service is temporarily unavailable.'

function renderRegistry() {
  return render(
    <MemoryRouter initialEntries={['/clients?roleIds=1']}>
      <MantineProvider env="test">
        <I18nProvider><ClientsPage /></I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getClientsForRegistry).mockResolvedValue([client])
  vi.mocked(getClientSolvencyGaugeScores).mockRejectedValue(new Error(unavailable))
})

describe('BUG-1527 clients registry optional solvency', () => {
  it('keeps clients and role-filtered search without a global service warning', async () => {
    renderRegistry()
    expect(await screen.findByText(clientName)).toBeTruthy()
    await waitFor(() => expect(getClientSolvencyGaugeScores).toHaveBeenCalledWith(
      [632206], expect.any(AbortSignal),
    ))
    expect(screen.queryByText(unavailable)).toBeNull()
    expect(await screen.findByLabelText('Оцінки платоспроможності недоступні')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Введіть значення'), { target: { value: 'BCE01600' } })
    await waitFor(() => expect(getClientsForRegistry).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 'BCE01600', typeRoleFilter: '1' }), expect.any(AbortSignal),
    ))
    expect(screen.getAllByText(clientName)).toHaveLength(1)
  })

  it('shows a valid score when the optional service succeeds', async () => {
    vi.mocked(getClientSolvencyGaugeScores).mockResolvedValue({
      results: [{ client_id: client.Id, applicable: true, data_sufficiency: 'ok', score: 82, rating: 'A' } as SolvencyScoreSlim],
      errors: [], count: 1, failed: 0,
    })
    renderRegistry()
    expect(await screen.findByText('82')).toBeTruthy()
    expect(screen.getAllByText(clientName)).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('still shows an error when the client registry itself fails', async () => {
    vi.mocked(getClientsForRegistry).mockRejectedValue(new Error('Не вдалося завантажити клієнтів'))
    renderRegistry()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Не вдалося завантажити клієнтів')).toBeTruthy()
    expect(getClientSolvencyGaugeScores).not.toHaveBeenCalled()
  })
})
