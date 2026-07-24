import { describe, expect, it, vi } from 'vitest'
import { printAfterPersistingStatus } from './invoicePrintFlow'

describe('warehouse invoice print flow', () => {
  it('waits for the print status update before loading the document', async () => {
    let finishStatusUpdate!: (saved: boolean) => void
    const persistStatus = vi.fn(() => new Promise<boolean>((resolve) => {
      finishStatusUpdate = resolve
    }))
    const loadDocument = vi.fn(async () => undefined)

    const print = printAfterPersistingStatus({
      loadDocument,
      persistStatus,
      requiresStatusUpdate: true,
    })

    expect(persistStatus).toHaveBeenCalledOnce()
    expect(loadDocument).not.toHaveBeenCalled()

    finishStatusUpdate(true)
    await print

    expect(loadDocument).toHaveBeenCalledOnce()
  })

  it('does not load the document when the required status update is not confirmed', async () => {
    const loadDocument = vi.fn(async () => undefined)

    await printAfterPersistingStatus({
      loadDocument,
      persistStatus: vi.fn(async () => false),
      requiresStatusUpdate: true,
    })

    expect(loadDocument).not.toHaveBeenCalled()
  })

  it('loads an already-marked document without another status update', async () => {
    const loadDocument = vi.fn(async () => undefined)
    const persistStatus = vi.fn(async () => true)

    await printAfterPersistingStatus({
      loadDocument,
      persistStatus,
      requiresStatusUpdate: false,
    })

    expect(persistStatus).not.toHaveBeenCalled()
    expect(loadDocument).toHaveBeenCalledOnce()
  })
})
