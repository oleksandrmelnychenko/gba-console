import { describe, expect, it } from 'vitest'
import { createWizardEnterLatch } from './wizardEnterLatch'

describe('wizard Enter submit latch', () => {
  it('blocks key repeat while pending and allows keyboard retry after settlement', () => {
    const latch = createWizardEnterLatch()

    expect(latch.tryAcquire()).toBe(true)
    expect(latch.tryAcquire()).toBe(false)
    expect(latch.isLatched()).toBe(true)

    latch.release()

    expect(latch.isLatched()).toBe(false)
    expect(latch.tryAcquire()).toBe(true)
  })

  it('can be released after an early validation return', () => {
    const latch = createWizardEnterLatch()

    expect(latch.tryAcquire()).toBe(true)
    latch.release()
    expect(latch.tryAcquire()).toBe(true)
  })
})
