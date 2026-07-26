import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { createReferenceCreateOperation } from './referenceCreateOperation'

describe('reference create operation', () => {
  it('reuses the same operation after an unknown outcome', async () => {
    const storage = createMemoryStorage()
    const operation = createReferenceCreateOperation('region', {
      createOperationId: () => '11111111-1111-4111-8111-111111111111',
      digest: testDigest,
      getStorage: () => storage,
      getUserScope: () => 'user-a',
    })
    const payload = { Name: '01' }

    const first = await operation.prepare(payload)
    operation.handleFailure(first, new ApiError('timeout', 504, null))
    const retry = await operation.prepare({ Name: '01' })

    expect(retry.operationId).toBe(first.operationId)
  })

  it('fails closed when the payload changes while outcome is unknown', async () => {
    const operation = createReferenceCreateOperation('region-code', {
      createOperationId: () => '22222222-2222-4222-8222-222222222222',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    await operation.prepare({
      RegionId: 10,
      Value: '0100001',
    })

    await expect(
      operation.prepare({
        RegionId: 10,
        Value: '0100002',
      }),
    ).rejects.toThrow('ще не підтверджено')
  })

  it('clears the operation after a definitive rejection', async () => {
    const ids = [
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]
    const operation = createReferenceCreateOperation('region', {
      createOperationId: () => ids.shift() || '',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    const first = await operation.prepare({ Name: '01' })
    operation.handleFailure(first, new ApiError('bad request', 400, null))
    const second = await operation.prepare({ Name: '02' })

    expect(second.operationId).not.toBe(first.operationId)
  })

  it('isolates pending operations by resource kind', async () => {
    const storage = createMemoryStorage()
    const operationIds = [
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ]
    const dependencies = {
      createOperationId: () => operationIds.shift() || '',
      digest: testDigest,
      getStorage: () => storage,
      getUserScope: () => 'user-a',
    }
    const regionOperation =
      createReferenceCreateOperation('region', dependencies)
    const codeOperation =
      createReferenceCreateOperation('region-code', dependencies)

    const region = await regionOperation.prepare({ Name: '01' })
    const code = await codeOperation.prepare({
      RegionId: 10,
      Value: '0100001',
    })

    expect(code.operationId).not.toBe(region.operationId)
  })
})

async function testDigest(value: ArrayBuffer): Promise<string> {
  let hash = 2166136261
  for (const byte of new Uint8Array(value)) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}
