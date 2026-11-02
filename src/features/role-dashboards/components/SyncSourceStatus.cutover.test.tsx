import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { resetSystemOfRecordCutoverForTests } from '../../../shared/system-of-record/systemOfRecordCutover'
import { getSyncStatus } from '../../header-actions/api/syncApi'
import { SyncSourceStatus } from './SyncSourceStatus'

vi.mock('../../header-actions/api/syncApi', () => ({ getSyncStatus: vi.fn() }))

afterEach(() => resetSystemOfRecordCutoverForTests())

describe('1C sync panel and the system-of-record cutover', () => {
  it('shows the sync panel before the cutover', async () => {
    resetSystemOfRecordCutoverForTests({ cutoverUtc: null, isActive: false, loaded: true })
    vi.mocked(getSyncStatus).mockResolvedValue({ IsGlobalLockStatusAvailable: true, IsInProgress: false } as never)
    renderWithMantine(<SyncSourceStatus />)
    expect(await screen.findByText('Синхронізація 1С')).toBeTruthy()
  })

  it('hides the sync panel and does not poll after the cutover', () => {
    resetSystemOfRecordCutoverForTests({ cutoverUtc: '2026-11-01T00:00:00Z', isActive: true, loaded: true })
    renderWithMantine(<SyncSourceStatus />)
    expect(screen.queryByText('Синхронізація 1С')).toBeNull()
    expect(getSyncStatus).not.toHaveBeenCalled()
  })
})
