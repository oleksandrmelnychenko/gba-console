import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { createTransporterCreateOperation } from './transporterMutationOperation'

describe('transporter create operation', () => {
  it('reuses the operation id after an unknown outcome', async () => {
    const storage = createMemoryStorage()
    const operation = createTransporterCreateOperation({
      createOperationId: () => '11111111-1111-4111-8111-111111111111',
      digest: testDigest,
      getStorage: () => storage,
      getUserScope: () => 'user-a',
    })
    const payload = createPayload('Carrier A')

    const first = await operation.prepare(payload)
    operation.handleFailure(first, new ApiError('timeout', 504, null))
    const retry = await operation.prepare(createPayload('Carrier A'))

    expect(retry.operationId).toBe(first.operationId)
  })

  it('collapses concurrent identical preparations to one identity', async () => {
    let createdIds = 0
    const operation = createTransporterCreateOperation({
      createOperationId: () => {
        createdIds += 1
        return '77777777-7777-4777-8777-777777777777'
      },
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    const [first, second] = await Promise.all([
      operation.prepare(createPayload('Carrier A')),
      operation.prepare(createPayload('Carrier A')),
    ])

    expect(second.operationId).toBe(first.operationId)
    expect(createdIds).toBe(1)
  })

  it('fails closed when payload changes after an unknown outcome', async () => {
    const operation = createTransporterCreateOperation({
      createOperationId: () => '22222222-2222-4222-8222-222222222222',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    await operation.prepare(createPayload('Carrier A'))

    await expect(
      operation.prepare(createPayload('Carrier B')),
    ).rejects.toThrow('ще не підтверджено')
  })

  it('clears the identity after a definitive rejection', async () => {
    const storage = createMemoryStorage()
    const ids = [
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]
    const operation = createTransporterCreateOperation({
      createOperationId: () => ids.shift() || '',
      digest: testDigest,
      getStorage: () => storage,
      getUserScope: () => 'user-a',
    })

    const first = await operation.prepare(createPayload('Carrier A'))
    operation.handleFailure(first, new ApiError('bad request', 400, null))
    const second = await operation.prepare(createPayload('Carrier B'))

    expect(second.operationId).not.toBe(first.operationId)
  })

  it('clears the identity after an acknowledged response', async () => {
    const ids = [
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ]
    const operation = createTransporterCreateOperation({
      createOperationId: () => ids.shift() || '',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    const first = await operation.prepare(createPayload('Carrier A'))
    operation.complete(first)
    const second = await operation.prepare(createPayload('Carrier B'))

    expect(second.operationId).not.toBe(first.operationId)
  })
})

function createPayload(name: string): FormData {
  const formData = new FormData()
  formData.append(
    'entity',
    JSON.stringify({
      Name: name,
      Priority: 0,
      TransporterTypeId: 1,
    }),
  )
  return formData
}

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
