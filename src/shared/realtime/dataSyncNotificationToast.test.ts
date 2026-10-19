import { describe, expect, it } from 'vitest'
import { getDataSyncToastAction } from './dataSyncNotificationToast'

const RUN_A = 'bbed73c2096b4463b13acab9e0beda37'
const RUN_B = '1d784e5a8845441ab451ba4aa00cb249'

describe('data-sync toast policy', () => {
  it('raises the sync error only for the run terminal failure', () => {
    expect(getDataSyncToastAction({ IsError: true, IsTerminal: false, StopProgressBar: true }, undefined))
      .toEqual({ type: 'none' })
    expect(getDataSyncToastAction({ IsError: true, IsTerminal: true, PipelineRunId: RUN_A }, undefined))
      .toEqual({ runId: RUN_A, type: 'show-error' })
  })

  it('keeps the legacy behaviour for servers that do not mark the terminal', () => {
    expect(getDataSyncToastAction({ IsError: true, StopProgressBar: true }, undefined))
      .toEqual({ runId: undefined, type: 'show-error' })
    expect(getDataSyncToastAction({ DisplayMessage: 'Крок' }, RUN_A)).toEqual({ type: 'none' })
  })

  it('removes the sync error after a successful run or when another run starts', () => {
    expect(getDataSyncToastAction({ IsTerminal: true, PipelineRunId: RUN_B, StopProgressBar: true }, RUN_A))
      .toEqual({ type: 'hide-error' })
    expect(getDataSyncToastAction({ IsTerminal: false, PipelineRunId: RUN_B }, RUN_A))
      .toEqual({ type: 'hide-error' })
    expect(getDataSyncToastAction({ IsTerminal: false, PipelineRunId: RUN_A }, 'bbed73c2-096b-4463-b13a-cab9e0beda37'))
      .toEqual({ type: 'none' })
  })
})
