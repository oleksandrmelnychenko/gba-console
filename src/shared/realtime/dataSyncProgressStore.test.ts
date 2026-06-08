import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyDataSyncNotification,
  clearDataSyncProgress,
  getDataSyncProgressSnapshot,
  markDataSyncStarted,
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
})
