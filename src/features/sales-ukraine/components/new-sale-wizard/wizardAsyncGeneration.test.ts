import { describe, expect, it, vi } from 'vitest'
import { createWizardAsyncGenerationGuard } from './wizardAsyncGeneration'

describe('wizard async generation guard', () => {
  it('invalidates an in-flight reload on close before any store or React write', async () => {
    const guard = createWizardAsyncGenerationGuard()
    const token = guard.begin('agreement-1:sale-1')
    const writeGlobalStore = vi.fn()
    const writeReactState = vi.fn()
    const response = Promise.resolve({ NetUid: 'sale-1' })

    guard.invalidate()
    const value = await response

    if (guard.isCurrent(token, 'agreement-1:sale-1')) {
      writeGlobalStore(value)
      writeReactState(value)
    }

    expect(token.signal.aborted).toBe(true)
    expect(writeGlobalStore).not.toHaveBeenCalled()
    expect(writeReactState).not.toHaveBeenCalled()
  })

  it('rejects an older response after a new reload starts in the same context', () => {
    const guard = createWizardAsyncGenerationGuard()
    const first = guard.begin('agreement-1:sale-1')
    const second = guard.begin('agreement-1:sale-1')

    expect(guard.isCurrent(first, first.context)).toBe(false)
    expect(first.signal.aborted).toBe(true)
    expect(guard.isCurrent(second, second.context)).toBe(true)
  })

  it('rejects a response when the wizard context changed even without a close', () => {
    const guard = createWizardAsyncGenerationGuard()
    const token = guard.begin('agreement-1:sale-1')

    expect(guard.isCurrent(token, 'agreement-2:sale-2')).toBe(false)
  })

  it('allows only the latest products/registry/merged navigation response to write or invoke callbacks', async () => {
    const guard = createWizardAsyncGenerationGuard()
    const commits = vi.fn()
    const callbacks = vi.fn()
    let resolveFirst: ((value: string) => void) | undefined
    let resolveSecond: ((value: string) => void) | undefined
    const firstResponse = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })
    const secondResponse = new Promise<string>((resolve) => {
      resolveSecond = resolve
    })
    const first = guard.begin('registry:sale-a')
    const firstTask = firstResponse.then((value) => {
      if (guard.isCurrent(first, first.context)) {
        commits(value)
        callbacks(value)
      }
    })
    const second = guard.begin('merged-edit:sale-b')
    const secondTask = secondResponse.then((value) => {
      if (guard.isCurrent(second, second.context)) {
        commits(value)
        callbacks(value)
      }
    })

    resolveFirst?.('stale sale-a')
    resolveSecond?.('current sale-b')
    await Promise.all([firstTask, secondTask])

    expect(first.signal.aborted).toBe(true)
    expect(commits).toHaveBeenCalledOnce()
    expect(commits).toHaveBeenCalledWith('current sale-b')
    expect(callbacks).toHaveBeenCalledOnce()
  })

  it('invalidates an old mount so it cannot complete a reopened wizard', async () => {
    const oldMount = createWizardAsyncGenerationGuard()
    const oldToken = oldMount.begin('wizard-final:sale-1')
    const onCreated = vi.fn()
    const response = Promise.resolve('acknowledged')

    oldMount.invalidate()
    const reopenedMount = createWizardAsyncGenerationGuard()
    const reopenedToken = reopenedMount.begin('wizard-final:sale-1')
    const value = await response

    if (oldMount.isCurrent(oldToken, oldToken.context)) {
      onCreated(value)
    }

    expect(onCreated).not.toHaveBeenCalled()
    expect(reopenedMount.isCurrent(reopenedToken, reopenedToken.context)).toBe(true)
  })
})
