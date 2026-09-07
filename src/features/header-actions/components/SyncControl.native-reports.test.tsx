import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOneCTurnoverSyncCatalog, getSyncStatus, startDailySync, startSyncSession } from '../api/syncApi'
import { SyncControl } from './SyncControl'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'

vi.mock('../api/syncApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/syncApi')>(),
  getOneCTurnoverSyncCatalog: vi.fn(),
  getSyncStatus: vi.fn(),
  startDailySync: vi.fn(),
  startSyncSession: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSyncStatus).mockResolvedValue({
    InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: false,
  })
})
afterEach(cleanup)

describe('native report synchronization boundary', () => {
  it('keeps daily Fenix document controls without exposing or loading the source-register experiment', async () => {
    render(<MantineProvider env="test"><I18nProvider><SyncControl /></I18nProvider></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: '1С синхронізація' }))
    await waitFor(() => expect(getSyncStatus).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('radio', { name: /Щоденна/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'FENIX' }))

    expect(screen.getByLabelText('Дата від')).toBeTruthy()
    expect(screen.getByLabelText('Дата до')).toBeTruthy()
    expect(screen.queryByLabelText('Звітні рухи 1С — окремий запуск Fenix')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завантажити звітні рухи 1С' })).toBeNull()
    expect(getOneCTurnoverSyncCatalog).not.toHaveBeenCalled()
    expect(startDailySync).not.toHaveBeenCalled()
    expect(startSyncSession).not.toHaveBeenCalled()
  })
})
