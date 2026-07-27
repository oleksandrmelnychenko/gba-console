import { describe, expect, it } from 'vitest'
import { allDailySyncTypes } from './syncOptions'
import {
  createInitialSyncState,
  getSessionDocumentTypes,
  isStrictSyncDate,
  syncReducer,
  validateSyncDateRange,
} from './syncSessionForm'
import type { DataSyncStatus } from './types'

describe('composite sync session date form', () => {
  it('starts Full with the supported history range and Daily with today', () => {
    const state = createInitialSyncState('2026-07-27')

    expect(state.dateRanges).toEqual({
      full: {
        from: '2025-01-01',
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
    ActiveRun: null,
    InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: false,
    LastTerminalRun: null,
  }
}
