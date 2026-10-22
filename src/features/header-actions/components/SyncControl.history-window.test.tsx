import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { clearDataSyncProgress } from '../../../shared/realtime/dataSyncProgressStore'
import { getSyncStatus, startSyncSession } from '../api/syncApi'
import type { DataSyncStatus } from '../types'
import { SyncControl } from './SyncControl'

vi.mock('../api/syncApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/syncApi')>(),
  getOneCTurnoverSyncCatalog: vi.fn(), getSyncStatus: vi.fn(), startDailySync: vi.fn(), startSyncSession: vi.fn(),
}))
const idle = (minimum?: string): DataSyncStatus => ({
  MinimumSupportedDate: minimum, InMemorySynchronizationInProgress: false,
  IsGlobalLockHeld: false, IsGlobalLockStatusAvailable: true, IsInProgress: false,
})
beforeEach(() => {
  vi.clearAllMocks()
  clearDataSyncProgress()
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); delete (Element.prototype as Partial<Element>).scrollIntoView })
function open() {
  render(<MantineProvider env="test"><I18nProvider><SyncControl /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: '1С синхронізація' }))
  const panel = within(screen.getByRole('tabpanel'))
  return { from: panel.getByLabelText('Дата від') as HTMLInputElement,
    to: panel.getByLabelText('Дата до') as HTMLInputElement }
}

describe('server synchronization date boundary', () => {
  it('uses the server minimum in both date inputs and permits a supported pre-2025 range', async () => {
    vi.mocked(getSyncStatus).mockResolvedValue(idle('2018-04-03'))
    const { from, to } = open()
    await waitFor(() => expect(from.value).toBe('03.04.2018'))
    expect(from.min).toBe('2018-04-03')
    expect(to.min).toBe('2018-04-03')
    fireEvent.change(from, { target: { value: '2020-01-01' } })
    fireEvent.change(to, { target: { value: '2020-01-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Запустити повну синхронізацію' }))
    expect(screen.getByText('Підтвердити запуск')).toBeTruthy()
    expect(startSyncSession).not.toHaveBeenCalled()
    vi.mocked(getSyncStatus).mockResolvedValue(idle())
    fireEvent.click(screen.getByRole('button', { name: 'Оновити статус' }))
    await screen.findByText('Межа періоду синхронізації недоступна. Оновіть статус')
    expect((screen.getByRole('button', { name: 'Запустити' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps edited dates while the status refresh changes the server minimum', async () => {
    vi.mocked(getSyncStatus).mockResolvedValue(idle('2018-01-01'))
    const { from, to } = open()
    await waitFor(() => expect(from.value).toBe('01.01.2018'))
    fireEvent.change(from, { target: { value: '2021-05-01' } })
    fireEvent.change(to, { target: { value: '2021-05-05' } })
    vi.mocked(getSyncStatus).mockResolvedValue(idle('2022-01-01'))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити статус' }))
    await waitFor(() => expect(from.min).toBe('2022-01-01'))
    expect(from.value).toBe('2021-05-01')
    expect(to.value).toBe('2021-05-05')
    expect(screen.getAllByText('Дата не може бути раніше 01.01.2022')).toHaveLength(2)
  })

  it.each([undefined, '2024-02-30'])('keeps editing available but blocks launch without valid metadata %s', async minimum => {
    vi.mocked(getSyncStatus).mockResolvedValue(idle(minimum))
    const { from, to } = open()
    await screen.findByText('Межа періоду синхронізації недоступна. Оновіть статус')
    expect((screen.getByRole('button', { name: 'Запустити повну синхронізацію' }) as HTMLButtonElement).disabled).toBe(true)
    expect(from.min).toBe('')
    fireEvent.change(from, { target: { value: '2020-01-01' } })
    fireEvent.change(to, { target: { value: '2020-01-31' } })
    vi.mocked(getSyncStatus).mockResolvedValue(idle('2019-01-01'))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити статус' }))
    await waitFor(() => expect(from.min).toBe('2019-01-01'))
    expect(from.value).toBe('2020-01-01')
    expect(to.value).toBe('2020-01-31')
    expect((screen.getByRole('button', { name: 'Запустити повну синхронізацію' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
