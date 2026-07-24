import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyDataSyncNotification,
  clearDataSyncProgress,
  getDataSyncProgressSnapshot,
  markDataSyncStarted,
  reconcileDataSyncProgress,
} from './dataSyncProgressStore'

describe('dataSyncProgressStore', () => {
  beforeEach(() => {
    clearDataSyncProgress()
  })

  it('starts progress immediately after a sync request is accepted', () => {
    markDataSyncStarted('Синхронізацію запущено')

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
      message: 'Синхронізацію запущено',
      messages: ['Синхронізацію запущено'],
    })
  })

  it('updates progress from ordinary hub messages and stops on StopProgressBar', () => {
    applyDataSyncNotification({ DisplayMessage: 'Тягнемо товари' })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
      message: 'Тягнемо товари',
      messages: ['Тягнемо товари'],
    })

    applyDataSyncNotification({ StopProgressBar: true })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: false,
      message: 'Тягнемо товари',
      messages: ['Тягнемо товари'],
    })
  })

  it('marks errors as finished and visible', () => {
    applyDataSyncNotification({ DisplayMessage: '1C не відповідає', IsError: true })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: true,
      message: '1C не відповідає',
      messages: ['1C не відповідає'],
    })
  })

  it('clears stale active progress when backend status says sync is not running', () => {
    markDataSyncStarted('Синхронізацію запущено')

    reconcileDataSyncProgress(false)

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: false,
      message: 'Синхронізацію запущено',
    })
  })

  it('restores active progress after reload when backend status says sync is running', () => {
    reconcileDataSyncProgress(true)

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
    })
  })

  it('clears a stale hub error after the durable backend session is idle', () => {
    applyDataSyncNotification({ DisplayMessage: '1C не відповідає', IsError: true })

    reconcileDataSyncProgress(false)

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: false,
    })
  })

  it('does not reuse a previous session message when backend status discovers a new run', () => {
    applyDataSyncNotification({ DisplayMessage: 'Попередня синхронізація завершена', StopProgressBar: true })

    reconcileDataSyncProgress(true)

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
      message: '',
    })
  })
})
