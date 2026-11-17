import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { clearDataSyncProgress } from '../../../shared/realtime/dataSyncProgressStore'
import { getSyncStatus, startSyncSession } from '../api/syncApi'
import { SyncControl } from './SyncControl'

vi.mock('../api/syncApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/syncApi')>(),
  getOneCTurnoverSyncCatalog: vi.fn(), getSyncStatus: vi.fn(), startDailySync: vi.fn(), startSyncSession: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  clearDataSyncProgress()
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getSyncStatus).mockResolvedValue({
    MinimumSupportedDate: '2018-01-01', InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false, IsGlobalLockStatusAvailable: true, IsInProgress: false,
  })
})
afterEach(() => { cleanup(); delete (Element.prototype as Partial<Element>).scrollIntoView })

describe('daily sync without document types', () => {
  it('disables the run button and explains why when no type is selected', async () => {
    render(<MantineProvider env="test"><I18nProvider><SyncControl /></I18nProvider></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: '1С синхронізація' }))
    fireEvent.click(screen.getByText('Щоденна синхронізація', { selector: '*:not(p)' }))

    const run = await screen.findByRole('button', { name: 'Запустити щоденну синхронізацію' })
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText('Оберіть хоча б один тип документів для синхронізації')).toBeNull()

    const selectAll = screen.getByLabelText('Вибрати всі') as HTMLInputElement
    if (!selectAll.checked) fireEvent.click(selectAll)
    fireEvent.click(selectAll)

    expect(screen.getByText('Оберіть хоча б один тип документів для синхронізації')).toBeTruthy()
    expect((run as HTMLButtonElement).disabled).toBe(true)
    expect(run.getAttribute('aria-describedby')).toBe('sync-no-types-hint')
    fireEvent.click(run)
    expect(startSyncSession).not.toHaveBeenCalled()
  })
})
