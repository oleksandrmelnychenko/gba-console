import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { clearDataSyncProgress } from '../../../shared/realtime/dataSyncProgressStore'
import { realtimeBus, realtimeEvents } from '../../../shared/realtime/events'
import { getSyncStatus } from '../api/syncApi'
import { SyncControl } from './SyncControl'

vi.mock('../api/syncApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/syncApi')>(),
  getOneCTurnoverSyncCatalog: vi.fn(),
  getSyncStatus: vi.fn(),
  startDailySync: vi.fn(),
  startSyncSession: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  clearDataSyncProgress()
  vi.mocked(getSyncStatus).mockResolvedValue({
    InMemorySynchronizationInProgress: true,
    IsGlobalLockHeld: true,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: true,
  })
})

afterEach(cleanup)

describe('sync control realtime refresh', () => {
  it('does not query the sync status for every hub message while the dialog is closed', async () => {
    renderSyncControl()

    emitProgress(20)

    expect(getSyncStatus).not.toHaveBeenCalled()
  })

  it('refreshes the sync status on hub messages while the dialog is open', async () => {
    renderSyncControl()
    fireEvent.click(screen.getByRole('button', { name: '1С синхронізація' }))
    await waitFor(() => expect(getSyncStatus).toHaveBeenCalledOnce())

    emitProgress(1)

    await waitFor(() => expect(getSyncStatus).toHaveBeenCalledTimes(2))
  })
})

function renderSyncControl() {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <SyncControl />
      </I18nProvider>
    </MantineProvider>,
  )
}

function emitProgress(count: number) {
  act(() => {
    for (let index = 0; index < count; index += 1) {
      realtimeBus.emit(realtimeEvents.dataSyncNotification, {
        DisplayMessage: `Крок ${index + 1}`,
        IsTerminal: false,
      })
    }
  })
}
