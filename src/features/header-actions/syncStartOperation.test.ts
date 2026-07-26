import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import { createSyncStartOperation, type SyncStartDescriptor } from './syncStartOperation'
import type { DataSyncStatus } from './types'

const firstOperationId = '11111111111111111111111111111111'
const secondOperationId = '22222222222222222222222222222222'

const fullDescriptor: SyncStartDescriptor = {
  forAmg: true,
  mode: 'full',
  types: ['4', '1'],
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('sync start operation', () => {
  it('reuses the operation id for a semantically identical retry', () => {
    const operation = createSyncStartOperation(() => firstOperationId)

    expect(operation.getOrCreate(fullDescriptor)).toBe(firstOperationId)
    expect(operation.getOrCreate({
      ...fullDescriptor,
      types: ['1', '4', '1'],
    })).toBe(firstOperationId)
    expect(sessionStorage).toHaveLength(1)
  })

  it('restores the pending operation after a component remount', () => {
    createSyncStartOperation(() => firstOperationId).getOrCreate(fullDescriptor)

    const restored = createSyncStartOperation(() => secondOperationId)

    expect(restored.getOrCreate(fullDescriptor)).toBe(firstOperationId)
  })

  it('fails closed when parameters change while the outcome is unknown', () => {
    const operation = createSyncStartOperation(() => firstOperationId)
    operation.getOrCreate(fullDescriptor)

    expect(() => operation.getOrCreate({
      ...fullDescriptor,
      forAmg: false,
    })).toThrow('Повторіть його без зміни параметрів')
  })

  it('keeps the operation id after network and timeout failures', () => {
    const operation = createSyncStartOperation(() => firstOperationId)
    const operationId = operation.getOrCreate(fullDescriptor)

    operation.handleFailure(operationId, new ApiError('network', 0, null))
    expect(operation.getOrCreate(fullDescriptor)).toBe(firstOperationId)

    operation.handleFailure(operationId, new ApiError('timeout', 504, null))
    expect(operation.getOrCreate(fullDescriptor)).toBe(firstOperationId)
  })

  it('clears the operation after a definitive validation failure', () => {
    let nextOperationId = firstOperationId
    const operation = createSyncStartOperation(() => nextOperationId)
    const operationId = operation.getOrCreate(fullDescriptor)

    operation.handleFailure(operationId, new ApiError('bad request', 400, null))
    nextOperationId = secondOperationId

    expect(operation.getOrCreate(fullDescriptor)).toBe(secondOperationId)
  })

  it('clears the operation after an accepted response', () => {
    let nextOperationId = firstOperationId
    const operation = createSyncStartOperation(() => nextOperationId)
    const operationId = operation.getOrCreate(fullDescriptor)

    operation.complete(operationId)
    nextOperationId = secondOperationId

    expect(operation.getOrCreate(fullDescriptor)).toBe(secondOperationId)
  })

  it('clears an unknown outcome when durable status confirms the run', () => {
    let nextOperationId = firstOperationId
    const operation = createSyncStartOperation(() => nextOperationId)
    operation.getOrCreate(fullDescriptor)

    operation.reconcile(createStatus({
      ActiveRun: {
        AcceptedScope: {
          ForAmg: true,
          OperationType: 'DataSync',
          SyncEntityTypes: [],
          Types: [],
        },
        PipelineRunId: firstOperationId,
        StartedAtUtc: '2026-07-25T10:00:00Z',
        StartedBy: 'test',
        Status: 'Running',
      },
    }))
    nextOperationId = secondOperationId

    expect(operation.getOrCreate(fullDescriptor)).toBe(secondOperationId)
  })

  it('does not clear an unknown outcome for an unrelated run', () => {
    const operation = createSyncStartOperation(() => firstOperationId)
    operation.getOrCreate(fullDescriptor)

    operation.reconcile(createStatus({
      PipelineRunId: secondOperationId,
    }))

    expect(operation.getOrCreate(fullDescriptor)).toBe(firstOperationId)
  })
})

function createStatus(overrides: Partial<DataSyncStatus> = {}): DataSyncStatus {
  return {
    ActiveRun: null,
    InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: false,
    LastTerminalRun: null,
    ...overrides,
  }
}
