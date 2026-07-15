import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from './salesMutationStorageTestHarness'

type RegistryModule = typeof import('./pendingSalesMutationRegistry')
type SplitStateModule = typeof import('./components/new-sale-wizard/newSaleWizardState')

let harness: SalesMutationStorageHarness | null = null

afterEach(() => {
  harness?.dispose()
  harness = null
  vi.resetModules()
})

describe('cross-tab sales mutation fencing', () => {
  it('fences a duplicated session as a distinct mutation owner', async () => {
    harness = installSalesMutationStorageHarness('tab-a', 5_000)
    harness.disableWebLocks()
    const tabA = await importRegistryForTab('tab-a')
    const scope = createScope()
    const operationId = '01111111-1111-4111-8111-111111111111'
    const payload = { operationId, value: 'frozen' }
    const leaseReady = deferred<void>()
    const releaseLease = deferred<void>()

    harness.selectTab('tab-a')
    const ownerRun = tabA.withSalesPendingMutationLock(
      scope,
      operationId,
      payload,
      async (lease) => {
        tabA.markSalesPendingMutationSubmitted(lease)
        leaseReady.resolve()
        await releaseLease.promise
        tabA.resolveSalesPendingMutation(lease, 'committed')
      },
    )
    await leaseReady.promise
    duplicateSessionStorage('tab-a', 'tab-b')
    const tabB = await importRegistryForTab('tab-b')

    harness.selectTab('tab-b')
    await expect(tabB.withSalesPendingMutationLock(
      scope,
      operationId,
      payload,
      async () => undefined,
    )).rejects.toBeInstanceOf(tabB.SalesPendingMutationConflictError)

    harness.selectTab('tab-a')
    releaseLease.resolve()
    await ownerRun
  })

  it('permanently fences a suspended fallback owner after takeover and tombstone', async () => {
    harness = installSalesMutationStorageHarness('tab-a', 10_000)
    harness.disableWebLocks()
    const tabA = await importRegistryForTab('tab-a')
    const tabB = await importRegistryForTab('tab-b')
    const scope = createScope()
    const operationId = '11111111-1111-4111-8111-111111111111'
    const payload = { operationId, value: 'frozen' }
    const leaseReady = deferred<void>()
    const resumeStaleTab = deferred<void>()
    let staleSendCount = 0

    harness.selectTab('tab-a')
    const staleRun = tabA.withSalesPendingMutationLock(
      scope,
      operationId,
      payload,
      async (lease) => {
        leaseReady.resolve()
        await resumeStaleTab.promise
        tabA.markSalesPendingMutationSubmitted(lease)
        staleSendCount += 1
      },
      { now: harness.activeTabId() ? () => Date.now() : undefined },
    )
    await leaseReady.promise

    harness.advanceClock(tabA.SALES_MUTATION_LEASE_MS + 1)
    harness.selectTab('tab-b')
    await tabB.withSalesPendingMutationLock(
      scope,
      operationId,
      payload,
      async (lease) => tabB.releasePreparedSalesPendingMutation(lease),
      { now: () => Date.now() },
    )

    harness.selectTab('tab-a')
    resumeStaleTab.resolve()
    await expect(staleRun).rejects.toBeInstanceOf(tabA.SalesPendingMutationFenceError)
    expect(staleSendCount).toBe(0)
    await expect(tabA.withSalesPendingMutationLock(
      scope,
      operationId,
      payload,
      async () => undefined,
    )).rejects.toBeInstanceOf(tabA.SalesPendingMutationFenceError)
  })

  it('does not let two distinct queued operation IDs send under Web Locks', async () => {
    harness = installSalesMutationStorageHarness('tab-a')
    const tabA = await importRegistryForTab('tab-a')
    const tabB = await importRegistryForTab('tab-b')
    const scope = createScope()
    const operationA = '21111111-1111-4111-8111-111111111111'
    const operationB = '32222222-2222-4222-8222-222222222222'
    const lockName = getLockName(scope)
    const releaseQueue = harness.holdWebLock(lockName)
    let sends = 0

    harness.selectTab('tab-a')
    const first = tabA.withSalesPendingMutationLock(scope, operationA, { operationA }, async (lease) => {
      tabA.markSalesPendingMutationSubmitted(lease)
      sends += 1
      tabA.resolveSalesPendingMutation(lease, 'committed')
    })
    harness.selectTab('tab-b')
    const second = tabB.withSalesPendingMutationLock(scope, operationB, { operationB }, async (lease) => {
      tabB.markSalesPendingMutationSubmitted(lease)
      sends += 1
      tabB.resolveSalesPendingMutation(lease, 'committed')
    })

    releaseQueue()
    const results = await Promise.allSettled([first, second])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(sends).toBe(1)
  })

  it('allows only one distinct operation to send with the lease fallback', async () => {
    harness = installSalesMutationStorageHarness('tab-a')
    harness.disableWebLocks()
    const tabA = await importRegistryForTab('tab-a')
    const tabB = await importRegistryForTab('tab-b')
    const scope = createScope()
    let sends = 0

    harness.selectTab('tab-a')
    const first = tabA.withSalesPendingMutationLock(
      scope,
      '41111111-1111-4111-8111-111111111111',
      { tab: 'a' },
      async (lease) => {
        tabA.markSalesPendingMutationSubmitted(lease)
        sends += 1
        tabA.resolveSalesPendingMutation(lease, 'committed')
      },
    )
    harness.selectTab('tab-b')
    const second = tabB.withSalesPendingMutationLock(
      scope,
      '52222222-2222-4222-8222-222222222222',
      { tab: 'b' },
      async (lease) => {
        tabB.markSalesPendingMutationSubmitted(lease)
        sends += 1
        tabB.resolveSalesPendingMutation(lease, 'committed')
      },
    )

    const results = await Promise.allSettled([first, second])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(sends).toBe(1)
  })

  it('retains corrupt evidence, fails storage reads closed, and dispatches real cross-tab updates', async () => {
    harness = installSalesMutationStorageHarness('tab-a')
    const tabA = await importRegistryForTab('tab-a')
    const tabB = await importRegistryForTab('tab-b')
    const scope = createScope()
    const operationId = '63333333-3333-4333-8333-333333333333'
    const key = getEntryKey(scope, operationId)
    const events: Array<{ external: boolean; key: string | null }> = []

    harness.selectTab('tab-a')
    const unsubscribe = tabA.subscribeSalesPendingMutations((event) => events.push(event))
    harness.selectTab('tab-b')
    tabB.saveSalesPendingMutation(scope, operationId, { value: 'shared' })

    expect(events.some((event) => event.external && event.key === key)).toBe(true)

    harness.localStorage.setItem(key, '{broken-json')
    harness.selectTab('tab-a')
    expect(() => tabA.loadSalesPendingMutation(scope)).toThrow(tabA.SalesPendingMutationCorruptionError)
    expect(harness.localStorage.getItem(key)).toBe('{broken-json')
    expect(listStorageKeys(harness.localStorage).some((candidate) => (
      candidate.startsWith('gba_console:sales-mutation-corruption:v1:')
    ))).toBe(true)

    const cleanScope = { ...scope, context: 'clean-scope' }
    harness.failNextLocalStorage('length')
    expect(() => tabA.loadSalesPendingMutation(cleanScope)).toThrow(tabA.SalesPendingMutationStorageError)
    unsubscribe()
  })

  it('fences a stale split module after takeover and keeps unrelated recovery records', async () => {
    harness = installSalesMutationStorageHarness('tab-a', 50_000)
    const tabA = await importSplitForTab('tab-a')
    const tabB = await importSplitForTab('tab-b')
    const source = createSplitSource('sale-a')
    const unrelated = createSplitSource('sale-b')
    const mutation = createSplitMutation('74444444-4444-4444-8444-444444444444')
    const item = createSplitItem('product-a')

    harness.selectTab('tab-a')
    const unsubscribe = tabA.subscribeWizardSplitOrderItems(() => undefined)
    tabA.stageWizardSplitExtraction({ fallbackItems: [], items: [item], mutation, source })

    harness.selectTab('tab-b')
    const hydrated = tabB.hydrateWizardSplitRecovery(source.userKey)
    expect(hydrated).not.toBeNull()
    harness.advanceClock(tabB.WIZARD_SPLIT_RECOVERY_LEASE_MS + 1)
    expect(tabB.claimWizardSplitRecoveryOwnership(hydrated!, Date.now())).not.toBeNull()
    tabB.clearWizardSplitOrderItems()
    tabB.setWizardSplitOrderItems([createSplitItem('product-b')], unrelated.agreementNetId, unrelated)

    harness.selectTab('tab-a')
    expect(tabA.getWizardSplitRecovery()).toBeNull()
    expect(() => tabA.commitWizardSplitExtraction(mutation.operationId)).toThrow(
      tabA.WizardSplitRecoveryFenceError,
    )
    expect(() => tabA.stageWizardSplitExtraction({
      fallbackItems: [],
      items: [item],
      mutation,
      source,
    })).toThrow(tabA.WizardSplitRecoveryFenceError)

    harness.selectTab('tab-b')
    expect(tabB.hydrateWizardSplitRecovery(unrelated.userKey)).toMatchObject({
      saleNetUid: unrelated.saleNetUid,
    })
    unsubscribe()
  })

  it('does not reuse a duplicated session as the same split recovery owner', async () => {
    harness = installSalesMutationStorageHarness('tab-a', 80_000)
    const tabA = await importSplitForTab('tab-a')
    const source = createSplitSource('duplicated-sale')
    const mutation = createSplitMutation('85555555-5555-4555-8555-555555555555')

    harness.selectTab('tab-a')
    tabA.stageWizardSplitExtraction({
      fallbackItems: [],
      items: [createSplitItem('product-duplicated')],
      mutation,
      source,
    })
    const ownerA = tabA.getWizardSplitRecoveryOwnerId()
    duplicateSessionStorage('tab-a', 'tab-b')
    const tabB = await importSplitForTab('tab-b')

    harness.selectTab('tab-b')
    const ownerB = tabB.getWizardSplitRecoveryOwnerId()
    const hydrated = tabB.hydrateWizardSplitRecovery(source.userKey)

    expect(ownerB).not.toBe(ownerA)
    expect(hydrated).not.toBeNull()
    expect(tabB.claimWizardSplitRecoveryOwnership(hydrated!, Date.now())).toBeNull()

    harness.advanceClock(tabB.WIZARD_SPLIT_RECOVERY_LEASE_MS + 1)
    expect(tabB.claimWizardSplitRecoveryOwnership(hydrated!, Date.now())).not.toBeNull()

    harness.selectTab('tab-a')
    expect(() => tabA.markWizardSplitExtractionSubmitted(mutation.operationId)).toThrow(
      tabA.WizardSplitRecoveryFenceError,
    )
  })
})

async function importRegistryForTab(tabId: string): Promise<RegistryModule> {
  harness?.selectTab(tabId)
  vi.resetModules()
  return import('./pendingSalesMutationRegistry')
}

async function importSplitForTab(tabId: string): Promise<SplitStateModule> {
  harness?.selectTab(tabId)
  vi.resetModules()
  return import('./components/new-sale-wizard/newSaleWizardState')
}

function createScope() {
  return {
    context: 'wizard-final:client-1:agreement-1:sale-1',
    kind: 'cart' as const,
    userKey: 'net:user-a',
  }
}

function createSplitSource(saleNetUid: string) {
  return {
    agreementNetId: `agreement-${saleNetUid}`,
    origin: 'ordinary' as const,
    saleNetUid,
    userKey: 'net:user-a',
  }
}

function createSplitMutation(operationId: string) {
  return {
    expectation: { kind: 'operation-marker' as const },
    operationId,
    request: {
      clientAgreementNetId: 'agreement-sale-a',
      kind: 'add' as const,
      orderItem: { Product: { NetUid: 'product-a' }, Qty: 2 },
      saleNetId: 'sale-a',
    },
  }
}

function createSplitItem(productNetUid: string) {
  return {
    Deleted: false,
    Id: 0,
    NetUid: '00000000-0000-0000-0000-000000000000',
    Product: { NetUid: productNetUid },
    Qty: 2,
    TotalAmount: 10,
    TotalAmountEurToUah: 0,
    TotalAmountLocal: 400,
  }
}

function getLockName(scope: ReturnType<typeof createScope>): string {
  return `gba-sales-mutation:${encodeURIComponent([
    scope.userKey,
    scope.kind,
    scope.context,
  ].join('\u001f'))}`
}

function getEntryKey(scope: ReturnType<typeof createScope>, operationId: string): string {
  return `gba_console:sales-pending-mutation:v3:${encodeURIComponent([
    scope.userKey,
    scope.kind,
    scope.context,
    operationId,
  ].join('\u001f'))}`
}

function listStorageKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null)
}

function duplicateSessionStorage(sourceTabId: string, targetTabId: string): void {
  const source = harness?.sessionStorageFor(sourceTabId)
  const target = harness?.sessionStorageFor(targetTabId)

  if (!source || !target) {
    throw new Error('Storage harness is not installed')
  }

  target.clear()

  for (const key of listStorageKeys(source)) {
    const value = source.getItem(key)

    if (value !== null) {
      target.setItem(key, value)
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}
