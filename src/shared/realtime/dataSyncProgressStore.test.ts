import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyDataSyncNotification,
  clearDataSyncProgress,
  getDataSyncProgressRevision,
  getDataSyncProgressSnapshot,
  markDataSyncStarted,
  reconcileDataSyncProgress,
} from './dataSyncProgressStore'

const RUN_A = 'bbed73c2096b4463b13acab9e0beda37'
const RUN_B = '1d784e5a8845441ab451ba4aa00cb249'

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

  it('ignores a status snapshot that was requested before a newer hub notification', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію цін завершено', StopProgressBar: true })
    const revisionBeforeStatusRequest = getDataSyncProgressRevision()

    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію завершено', StopProgressBar: true })
    reconcileDataSyncProgress(true, { revision: revisionBeforeStatusRequest })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: false,
      message: 'Синхронізацію завершено',
    })
  })

  it('applies a status snapshot when no hub notification arrived while it was requested', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    const revision = getDataSyncProgressRevision()

    reconcileDataSyncProgress(false, { revision, runId: RUN_A })

    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: false, isError: false })
  })

  it('keeps the run active when a worker step reports StopProgressBar before the run terminal', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію цін завершено', IsTerminal: false, StopProgressBar: true })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
      message: 'Синхронізацію цін завершено',
      runId: RUN_A,
    })
  })

  it('keeps a retried stage failure in progress and finishes only on the run terminal', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    applyDataSyncNotification({
      DisplayMessage: '19.10.2026 12:00:02 - Помилка синхронізації',
      IsError: true,
      IsTerminal: false,
      StopProgressBar: true,
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
      message: '19.10.2026 12:00:02 - Помилка синхронізації',
    })

    applyDataSyncNotification({
      DisplayMessage: '19.10.2026 12:00:02 - Етап синхронізації перервано, автоматичний повтор через 60 с',
      IsTerminal: false,
      PipelineRunId: RUN_A,
    })
    applyDataSyncNotification({
      DisplayMessage: '19.10.2026 12:09:33 - Синхронізацію завершено',
      IsTerminal: true,
      PipelineRunId: RUN_A,
      StopProgressBar: true,
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: false,
      message: '19.10.2026 12:09:33 - Синхронізацію завершено',
    })
  })

  it('shows an error only for the run terminal failure', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    applyDataSyncNotification({
      DisplayMessage: 'Помилка синхронізації (DailySession.MasterData.Clients)',
      IsError: true,
      IsTerminal: true,
      PipelineRunId: RUN_A,
      StopProgressBar: true,
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      isError: true,
      message: 'Помилка синхронізації (DailySession.MasterData.Clients)',
    })
  })

  it('does not let a terminal notification of another run end the run that is in progress', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_B })
    applyDataSyncNotification({
      DisplayMessage: 'Помилка синхронізації',
      IsError: true,
      IsTerminal: true,
      PipelineRunId: RUN_A,
      StopProgressBar: true,
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: true,
      isError: false,
      message: 'Синхронізацію розпочато',
      runId: RUN_B,
    })
  })

  it('keeps the last message when status confirms the same run and drops it for a different run', () => {
    applyDataSyncNotification({ DisplayMessage: 'Тягнемо товари', IsTerminal: false, PipelineRunId: RUN_A })

    reconcileDataSyncProgress(true, { revision: getDataSyncProgressRevision(), runId: 'bbed73c2-096b-4463-b13a-cab9e0beda37' })
    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: true, message: 'Тягнемо товари', runId: RUN_A })

    reconcileDataSyncProgress(true, { revision: getDataSyncProgressRevision(), runId: RUN_B })
    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: true, message: '', runId: RUN_B })
  })

  it('does not resurrect a run whose terminal arrived before the start response', () => {
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    applyDataSyncNotification({ DisplayMessage: 'Синхронізацію завершено', IsTerminal: true, PipelineRunId: RUN_A, StopProgressBar: true })

    markDataSyncStarted('Синхронізацію запущено', RUN_A)

    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: false, message: 'Синхронізацію завершено' })
  })
})
