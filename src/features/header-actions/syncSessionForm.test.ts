import { describe, expect, it } from 'vitest'
import { allDailySyncTypes } from './syncOptions'
import {
  createInitialSyncState,
  getSessionDocumentTypes,
  getMinimumSyncSessionDate,
  isStrictSyncDate,
  syncReducer,
  validateSyncDateRange,
} from './syncSessionForm'
import type { DataSyncStatus } from './types'

describe('composite sync session date form', () => {
  it('waits for the server full-history boundary and starts Daily with today', () => {
    const state = createInitialSyncState('2026-07-27')

    expect(state.dateRanges).toEqual({
      full: {
        from: '',
        to: '2026-07-27',
      },
      daily: {
        from: '2026-07-27',
        to: '2026-07-27',
      },
    })
    expect(state.selectedDailyDocumentTypes).toEqual(allDailySyncTypes)
    expect(state.selectedDailyDocumentTypes).toHaveLength(12)
  })

  it('takes the initial full range and validation boundary from the server, including pre-2025 history', () => {
    const state = syncReducer(createInitialSyncState('2026-07-27'), {
      type: 'statusSucceeded', status: { ...createIdleStatus(), MinimumSupportedDate: '2018-04-03' },
    })
    expect(state.dateRanges.full).toEqual({ from: '2018-04-03', to: '2026-07-27' })
    expect(validateSyncDateRange({ from: '2020-01-01', to: '2020-02-01' }, '2026-07-27',
      getMinimumSyncSessionDate(state.status))).toEqual({})
    expect(validateSyncDateRange({ from: '2018-04-02', to: '2018-04-02' }, '2026-07-27',
      getMinimumSyncSessionDate(state.status))).toEqual({
      from: 'Дата не може бути раніше 03.04.2018', to: 'Дата не може бути раніше 03.04.2018',
    })
  })

  it('preserves both selected ranges on metadata refresh, source/mode changes and reopening', () => {
    let state = createInitialSyncState('2026-07-27')
    for (const mode of ['full', 'daily'] as const) {
      state = syncReducer(state, { type: 'dateChanged', mode, boundary: 'from', value: '2021-05-01' })
      state = syncReducer(state, { type: 'dateChanged', mode, boundary: 'to', value: '2021-05-05' })
    }
    state = syncReducer(state, { type: 'statusSucceeded', status: { ...createIdleStatus(), MinimumSupportedDate: '2020-01-01' } })
    state = syncReducer(state, { type: 'closed' })
    state = syncReducer(state, { type: 'opened' })
    state = syncReducer(state, { type: 'modeChanged', mode: 'daily' })
    state = syncReducer(state, { type: 'sourceChanged', source: 'fenix' })
    state = syncReducer(state, { type: 'statusSucceeded', status: { ...createIdleStatus(), MinimumSupportedDate: '2022-01-01' } })
    expect(state.dateRanges.full).toEqual({ from: '2021-05-01', to: '2021-05-05' })
    expect(state.dateRanges.daily).toEqual(state.dateRanges.full)
    expect(validateSyncDateRange(state.dateRanges.full, '2026-07-27', getMinimumSyncSessionDate(state.status)))
      .toEqual({ from: 'Дата не може бути раніше 01.01.2022', to: 'Дата не може бути раніше 01.01.2022' })
  })

  it('preserves an explicitly cleared full date even when the first metadata response arrives', () => {
    let state = syncReducer(createInitialSyncState('2026-07-27'), {
      type: 'dateChanged', mode: 'full', boundary: 'from', value: '',
    })
    state = syncReducer(state, { type: 'statusSucceeded', status: createIdleStatus() })
    expect(state.dateRanges.full.from).toBe('')
  })

  it.each([undefined, null, '', '2024-02-30', '2024-1-01', '2024-01-01T00:00:00'])('does not invent a minimum for invalid/missing server metadata %s', (minimum) => {
    const status = { ...createIdleStatus(), MinimumSupportedDate: minimum }
    expect(getMinimumSyncSessionDate(status)).toBeNull()
    expect(syncReducer(createInitialSyncState(), { type: 'statusSucceeded', status }).dateRanges.full.from).toBe('')
  })

  it('fixes Full to all 12 types while keeping the Daily selection editable', () => {
    let state = createInitialSyncState('2026-07-27')
    state = syncReducer(state, {
      type: 'dailyDocumentTypesChanged',
      types: ['6', '0'],
    })

    expect(state.selectedDailyDocumentTypes).toEqual(['0', '6'])
    expect(getSessionDocumentTypes('daily', state.selectedDailyDocumentTypes)).toEqual(['0', '6'])
    expect(getSessionDocumentTypes('full', state.selectedDailyDocumentTypes)).toEqual(allDailySyncTypes)
    expect(getSessionDocumentTypes('full', [])).toHaveLength(12)
  })

  it('requires strict, real YYYY-MM-DD calendar dates', () => {
    expect(isStrictSyncDate('2026-07-27')).toBe(true)
    expect(isStrictSyncDate('2026-7-27')).toBe(false)
    expect(isStrictSyncDate('2026-02-29')).toBe(false)

    expect(validateSyncDateRange(
      { from: '', to: '2026-02-29' },
      '2026-07-27',
    )).toEqual({
      from: 'Дата від є обов’язковою',
      to: 'Вкажіть дату у форматі РРРР-ММ-ДД',
    })
  })

  it('enforces the lower bound, ordering, and today upper bound', () => {
    expect(validateSyncDateRange(
      { from: '2024-12-31', to: '2026-07-27' },
      '2026-07-27',
      '2025-01-01',
    )).toEqual({
      from: 'Дата не може бути раніше 01.01.2025',
    })
    expect(validateSyncDateRange(
      { from: '2026-07-28', to: '2026-07-27' },
      '2026-07-27',
    )).toEqual({
      range: 'Дата початку має бути не пізніше дати завершення',
    })
    expect(validateSyncDateRange(
      { from: '2026-07-27', to: '2026-07-28' },
      '2026-07-27',
    )).toEqual({
      to: 'Дата завершення не може бути пізніше сьогодні',
    })
  })

  it('retains cleared manual dates through mode changes and status refreshes', () => {
    let state = createInitialSyncState('2026-07-27')
    state = syncReducer(state, {
      type: 'dateChanged',
      boundary: 'from',
      mode: 'daily',
      value: '',
    })
    state = syncReducer(state, { type: 'modeChanged', mode: 'daily' })
    state = syncReducer(state, {
      type: 'statusSucceeded',
      status: createIdleStatus(),
    })

    expect(state.dateRanges.daily).toEqual({
      from: '',
      to: '2026-07-27',
    })
    expect(state.dateRanges.full).toEqual({
      from: '2025-01-01',
      to: '2026-07-27',
    })
  })
})

function createIdleStatus(): DataSyncStatus {
  return {
    MinimumSupportedDate: '2025-01-01',
    ActiveRun: null,
    InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: false,
    LastTerminalRun: null,
  }
}
