import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { createCurrencyCreateOperation } from './currencyMutationOperation'

describe('currency create operation', () => {
  it('reuses the operation id after an unknown outcome', async () => {
    const storage = createMemoryStorage()
    const operation = createCurrencyCreateOperation({
      createOperationId: () => '11111111-1111-4111-8111-111111111111',
      digest: testDigest,
      getStorage: () => storage,
      getUserScope: () => 'user-a',
    })

    const first = await operation.prepare(createPayload('EUR'))
    operation.handleFailure(first, new ApiError('timeout', 504, null))
    const retry = await operation.prepare(createPayload('EUR'))

    expect(retry.operationId).toBe(first.operationId)
  })

  it('uses one identity for concurrent identical submissions', async () => {
    let createdIds = 0
    const storage = createMemoryStorage()
    const operation = createCurrencyCreateOperation({
      createOperationId: () => {
        createdIds += 1
        return '22222222-2222-4222-8222-222222222222'
      },
      digest: testDigest,
      getStorage: () => storage,
      getUserScope: () => 'user-a',
    })

    const [first, second] = await Promise.all([
      operation.prepare(createPayload('EUR')),
      operation.prepare(createPayload('EUR')),
    ])

    expect(second.operationId).toBe(first.operationId)
    expect(createdIds).toBe(1)
  })

  it('fails closed when data changes after an unknown outcome', async () => {
    const operation = createCurrencyCreateOperation({
      createOperationId: () => '33333333-3333-4333-8333-333333333333',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    await operation.prepare(createPayload('EUR'))

    await expect(
      operation.prepare(createPayload('USD')),
    ).rejects.toThrow('ще не підтверджено')
  })

  it('clears the operation after a definitive rejection', async () => {
    const ids = [
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]
    const operation = createCurrencyCreateOperation({
      createOperationId: () => ids.shift() || '',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    const first = await operation.prepare(createPayload('EUR'))
    operation.handleFailure(first, new ApiError('bad request', 400, null))
    const second = await operation.prepare(createPayload('USD'))

    expect(second.operationId).not.toBe(first.operationId)
  })

  it('keeps the operation after request timeout but clears it on success', async () => {
    const ids = [
      '66666666-6666-4666-8666-666666666666',
      '77777777-7777-4777-8777-777777777777',
    ]
    const operation = createCurrencyCreateOperation({
      createOperationId: () => ids.shift() || '',
      digest: testDigest,
      getStorage: () => createMemoryStorage(),
      getUserScope: () => 'user-a',
    })

    const first = await operation.prepare(createPayload('EUR'))
    operation.handleFailure(first, new ApiError('timeout', 408, null))
    const retry = await operation.prepare(createPayload('EUR'))
    operation.complete(retry)
    const next = await operation.prepare(createPayload('USD'))

    expect(retry.operationId).toBe(first.operationId)
    expect(next.operationId).not.toBe(first.operationId)
  })
})

function createPayload(code: string) {
  return {
    Code: code,
    CurrencyTranslations: [
      {
        CultureCode: 'uk',
        Name: code === 'EUR' ? 'Євро' : 'Долар США',
      },
    ],
    Name: code === 'EUR' ? 'Euro' : 'United States dollar',
  }
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
