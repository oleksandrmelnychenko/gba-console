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
  vi.mocked(getOneCTurnoverSyncCatalog).mockResolvedValue({
    Organizations: [], ProductKinds: [], BuyerRoot: { Id: '33'.repeat(16), Name: 'Покупці' },
  })
  vi.mocked(getSyncStatus).mockResolvedValue({
    InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: false,
  })
})
afterEach(cleanup)

describe('native report synchronization boundary', () => {
  it('offers the exact report ledger only in daily Fenix mode and does not read source until enabled', async () => {
    render(<MantineProvider env="test"><I18nProvider><SyncControl /></I18nProvider></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: '1С синхронізація' }))
    await waitFor(() => expect(getSyncStatus).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('radio', { name: /Щоденна/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'FENIX' }))

    expect(screen.getByLabelText('Дата від')).toBeTruthy()
    expect(screen.getByLabelText('Дата до')).toBeTruthy()
    expect(screen.getByLabelText('Звітні рухи 1С — окремий запуск Fenix')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Завантажити звітні рухи 1С' })).toBeNull()
    expect(getOneCTurnoverSyncCatalog).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Звітні рухи 1С — окремий запуск Fenix'))
    await waitFor(() => expect(getOneCTurnoverSyncCatalog).toHaveBeenCalledOnce())
    expect(startDailySync).not.toHaveBeenCalled()
    expect(startSyncSession).not.toHaveBeenCalled()
  })
})
