import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllSalesPendingMutations,
  clearSalesPendingMutation,
  collectSalesMutationGarbage,
  getSalesPendingMutationUserKey,
  listSalesPendingMutationsForUser,
  loadSalesPendingMutation,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveSalesPendingMutation,
  SALES_MUTATION_RESOLUTION_RETENTION_MS,
  saveSalesPendingMutation,
  synchronizeSalesPendingMutationUser,
  withSalesPendingMutationLock,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from './salesMutationStorageTestHarness'

const scope: SalesPendingMutationScope = {
  context: 'wizard-final:client-1:agreement-1:sale-1',
  kind: 'create-sale',
  userKey: 'net:user-a',
}

let storageHarness: SalesMutationStorageHarness

beforeEach(() => {
  storageHarness = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
})
afterEach(() => {
  clearAllSalesPendingMutations()
  storageHarness.dispose()
})

describe('pending sales mutation registry', () => {
  it('survives a remount/reload with the same frozen operation payload', () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const payload = {
      operationId,
      payload: { Comment: 'immutable', OperationNetUid: operationId },
    }

    saveSalesPendingMutation(scope, operationId, payload, { now: 1_000 })
    payload.payload.Comment = 'changed after persistence'

    const firstMount = loadSalesPendingMutation<typeof payload>(scope, 2_000)
    const remount = loadSalesPendingMutation<typeof payload>(scope, 2_001)

    expect(firstMount).toEqual(remount)
    expect(remount?.operationId).toBe(operationId)
    expect(remount?.payload.payload.Comment).toBe('immutable')
    expect(Object.isFrozen(remount)).toBe(true)
    expect(Object.isFrozen(remount?.payload.payload)).toBe(true)
  })

  it('keeps unrelated durable operations isolated across tabs and browser reopen', () => {
    const operationA = '10111111-1111-4111-8111-111111111111'
    const operationB = '20222222-2222-4222-8222-222222222222'
    const scopeB = { ...scope, context: 'wizard-final:client-2:agreement-2:sale-2' }

    storageHarness.selectTab('tab-a')
    saveSalesPendingMutation(scope, operationA, { tab: 'a' })
    storageHarness.selectTab('tab-b')
    saveSalesPendingMutation(scopeB, operationB, { tab: 'b' })

    expect(loadSalesPendingMutation(scope)?.operationId).toBe(operationA)
    expect(loadSalesPendingMutation(scopeB)?.operationId).toBe(operationB)
    expect(storageHarness.sessionStorageFor('tab-a').length).toBe(1)
    expect(storageHarness.sessionStorageFor('tab-b').length).toBe(1)
    expect(storageHarness.sessionStorageFor('tab-a').getItem('gba_console:sales-pending-mutations:v1')).toBe(null)
    expect(storageHarness.sessionStorageFor('tab-b').getItem('gba_console:sales-pending-mutations:v1')).toBe(null)

    storageHarness.closeTab('tab-a')
    storageHarness.openTab('tab-a')

    expect(loadSalesPendingMutation(scope)).toMatchObject({ operationId: operationA, payload: { tab: 'a' } })
    expect(loadSalesPendingMutation(scopeB)).toMatchObject({ operationId: operationB, payload: { tab: 'b' } })

    clearSalesPendingMutation(scope, operationA)
    expect(loadSalesPendingMutation(scope)).toBe(null)
    expect(loadSalesPendingMutation(scopeB)?.operationId).toBe(operationB)
  })

  it.each(['cart', 'create-sale', 'merged-sale'] as const)(
    'restores a validated %s context after page reload',
    (kind) => {
      const currentScope = { ...scope, kind }
      const operationId = '22222222-2222-4222-8222-222222222222'

      saveSalesPendingMutation(currentScope, operationId, { kind, operationId }, { now: 10 })

      expect(loadSalesPendingMutation(currentScope, 11)).toMatchObject({
        operationId,
        payload: { kind, operationId },
        resumable: true,
      })
    },
  )

  it('isolates users without deleting unresolved entries on logout or user switch', () => {
    saveSalesPendingMutation(
      scope,
      '33333333-3333-4333-8333-333333333333',
      { value: 'user-a-only' },
      { now: 100 },
    )

    synchronizeSalesPendingMutationUser('net:user-b', 101)

    expect(loadSalesPendingMutation(scope, 102)?.payload).toEqual({ value: 'user-a-only' })

    const userBScope = { ...scope, userKey: 'net:user-b' }
    saveSalesPendingMutation(
      userBScope,
      '44444444-4444-4444-8444-444444444444',
      { value: 'user-b-only' },
      { now: 103 },
    )
    synchronizeSalesPendingMutationUser('', 104)

    expect(loadSalesPendingMutation(scope, 105)?.payload).toEqual({ value: 'user-a-only' })
    expect(loadSalesPendingMutation(userBScope, 105)?.payload).toEqual({ value: 'user-b-only' })
    expect(listSalesPendingMutationsForUser('net:user-a', 105)).toHaveLength(1)
    expect(listSalesPendingMutationsForUser('net:user-b', 105)).toHaveLength(1)
  })

  it('keeps unresolved contexts fail-closed after their former TTL', () => {
    const fileScope = { ...scope, kind: 'sale-update-file' as const }
    const operationId = '55555555-5555-4555-8555-555555555555'

    window.sessionStorage.setItem('gba_console:sales-pending-mutations:v1', JSON.stringify({
      entries: [{
        ...fileScope,
        createdAt: 100,
        expiresAt: 150,
        operationId,
        payload: { fileMetadata: { name: 'ttn.pdf', size: 12 } },
        resumable: false,
        version: 1,
      }],
      version: 1,
    }))

    expect(loadSalesPendingMutation(fileScope, 10_000)).toMatchObject({
      expiresAt: null,
      operationId,
      resumable: false,
    })
  })

  it('garbage collects only expired resolved coordination records during production sync', async () => {
    const resolvedAt = 10_000
    const resolvedOperationId = '56555555-5555-4555-8555-555555555555'
    const ambiguousOperationId = '57555555-5555-4555-8555-555555555555'
    const preparedOperationId = '58555555-5555-4555-8555-555555555555'
    const ambiguousScope = { ...scope, context: 'sale-comment:ambiguous', kind: 'sale-comment' as const }
    const preparedScope = { ...scope, context: 'sale-comment:prepared', kind: 'sale-comment' as const }

    storageHarness.setClock(resolvedAt)
    await withSalesPendingMutationLock(
      scope,
      resolvedOperationId,
      { value: 'resolved' },
      async (lease) => {
        markSalesPendingMutationSubmitted(lease)
        resolveSalesPendingMutation(lease, 'committed', resolvedAt)
      },
    )
    await withSalesPendingMutationLock(
      ambiguousScope,
      ambiguousOperationId,
      { value: 'ambiguous' },
      async (lease) => {
        markSalesPendingMutationSubmitted(lease)
        markSalesPendingMutationUnknown(lease)
      },
    )
    saveSalesPendingMutation(
      preparedScope,
      preparedOperationId,
      { value: 'prepared' },
      { now: resolvedAt },
    )

    synchronizeSalesPendingMutationUser(
      scope.userKey,
      resolvedAt + SALES_MUTATION_RESOLUTION_RETENTION_MS - 1,
    )

    expect(listStoredJson('gba_console:sales-mutation-tombstone:v1:')).toHaveLength(1)
    expect(listStoredJson('gba_console:sales-mutation-control:v1:')).toHaveLength(2)

    synchronizeSalesPendingMutationUser(
      scope.userKey,
      resolvedAt + SALES_MUTATION_RESOLUTION_RETENTION_MS,
    )

    expect(listStoredJson('gba_console:sales-mutation-tombstone:v1:')).toEqual([])
    expect(listStoredJson('gba_console:sales-mutation-control:v1:')).toMatchObject([{
      operationId: ambiguousOperationId,
      phase: 'unknown',
      state: 'active',
    }])
    expect(loadSalesPendingMutation(ambiguousScope)).toMatchObject({
      operationId: ambiguousOperationId,
      phase: 'unknown',
    })
    expect(loadSalesPendingMutation(preparedScope)).toMatchObject({
      operationId: preparedOperationId,
      phase: 'prepared',
    })
  })

  it('does not remove a resolved control replaced by an active generation during the final GC read', async () => {
    const resolvedAt = 20_000
    const operationId = '59555555-5555-4555-8555-555555555555'

    storageHarness.setClock(resolvedAt)
    await withSalesPendingMutationLock(
      scope,
      operationId,
      { value: 'resolved before race' },
      async (lease) => {
        markSalesPendingMutationSubmitted(lease)
        resolveSalesPendingMutation(lease, 'committed', resolvedAt)
      },
    )

    const controlKey = listStoredKeys('gba_console:sales-mutation-control:v1:')[0]

    if (!controlKey) {
      throw new Error('Expected a resolved mutation control')
    }

    const storage = storageHarness.localStorage
    const originalGetItem = storage.getItem.bind(storage)
    const resolved = JSON.parse(originalGetItem(controlKey) as string) as Record<string, unknown>
    const activeReplacement: Record<string, unknown> = {
      ...resolved,
      fencingToken: 'active-race-fence',
      generation: Number(resolved.generation) + 1,
      leaseUntil: resolvedAt + SALES_MUTATION_RESOLUTION_RETENTION_MS + 10_000,
      operationId: '60666666-6666-4666-8666-666666666666',
      ownerId: 'active-race-owner',
      ownerUpdatedAt: resolvedAt + SALES_MUTATION_RESOLUTION_RETENTION_MS,
      phase: 'unknown',
      state: 'active',
    }
    delete activeReplacement.resolution
    delete activeReplacement.resolvedAt
    let controlReads = 0
    const getItemSpy = vi.spyOn(storage, 'getItem').mockImplementation((key) => {
      if (key === controlKey && ++controlReads === 2) {
        storage.setItem(controlKey, JSON.stringify(activeReplacement))
      }

      return originalGetItem(key)
    })

    const result = collectSalesMutationGarbage(
      resolvedAt + SALES_MUTATION_RESOLUTION_RETENTION_MS,
      scope.userKey,
    )
    getItemSpy.mockRestore()

    expect(controlReads).toBe(2)
    expect(result.controlsRemoved).toBe(0)
    expect(JSON.parse(storage.getItem(controlKey) as string)).toMatchObject({
      generation: Number(resolved.generation) + 1,
      operationId: activeReplacement.operationId,
      phase: 'unknown',
      state: 'active',
    })
  })

  it('lists cloned read-only entries for one user without touching other users', () => {
    const operationId = '66666666-6666-4666-8666-666666666666'
    const userBScope = { ...scope, userKey: 'net:user-b' }

    saveSalesPendingMutation(scope, operationId, { nested: { value: 'user-a' } }, { now: 100 })
    saveSalesPendingMutation(
      userBScope,
      '99999999-9999-4999-8999-999999999999',
      { nested: { value: 'user-b' } },
      { now: 101 },
    )

    const first = listSalesPendingMutationsForUser('NET:USER-A', 20_000)
    const second = listSalesPendingMutationsForUser('net:user-a', 20_001)

    expect(first).toHaveLength(1)
    expect(first[0]).not.toBe(second[0])
    expect(first[0]).toMatchObject({ operationId, payload: { nested: { value: 'user-a' } } })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first[0]?.payload)).toBe(true)
    expect(listSalesPendingMutationsForUser('net:user-b', 20_002)).toHaveLength(1)
  })

  it('does not rewrite storage while listing legacy unresolved entries', () => {
    const operationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const raw = JSON.stringify({
      entries: [{
        ...scope,
        createdAt: 100,
        expiresAt: 150,
        operationId,
        payload: { value: 'legacy unresolved' },
        resumable: true,
        version: 1,
      }],
      version: 1,
    })
    window.sessionStorage.setItem('gba_console:sales-pending-mutations:v1', raw)

    expect(listSalesPendingMutationsForUser(scope.userKey, 50_000)).toMatchObject([{
      expiresAt: null,
      operationId,
    }])
    expect(window.sessionStorage.getItem('gba_console:sales-pending-mutations:v1')).toBe(raw)
  })

  it('derives a stable user scope without storing credentials', () => {
    expect(getSalesPendingMutationUserKey({ csrfToken: 'secret', userNetUid: 'USER-A' })).toBe('net:user-a')
    expect(getSalesPendingMutationUserKey({ user: { Id: 7 } })).toBe('id:7')
    expect(getSalesPendingMutationUserKey(null)).toBe('')
  })

  it.each([
    new DOMException('quota exceeded', 'QuotaExceededError'),
    new DOMException('storage disabled', 'SecurityError'),
  ])('fails closed before a request when durable local storage cannot persist (%s)', (storageError) => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const unavailableStorage = {
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw storageError
      }),
    } satisfies Storage
    Object.defineProperty(window, 'localStorage', { configurable: true, value: unavailableStorage })

    try {
      expect(() => saveSalesPendingMutation(
        scope,
        '77777777-7777-4777-8777-777777777777',
        { payload: 'must survive before sending' },
      )).toThrow('Запит не надіслано')
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    }
  })

  it('fails closed when browser policy blocks access to localStorage itself', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('storage disabled', 'SecurityError')
      },
    })

    try {
      expect(() => saveSalesPendingMutation(
        scope,
        '88888888-8888-4888-8888-888888888888',
        { payload: 'must not be sent' },
      )).toThrow('Запит не надіслано')
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    }
  })
})

function listStoredJson(prefix: string): Array<Record<string, unknown>> {
  return listStoredKeys(prefix)
    .map((key) => JSON.parse(window.localStorage.getItem(key) as string) as Record<string, unknown>)
}

function listStoredKeys(prefix: string): string[] {
  return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(prefix)))
}
