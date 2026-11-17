import { describe, expect, it, vi } from 'vitest'
import { printFailureMessage, printThenPersistStatus } from './invoicePrintFlow'

describe('warehouse invoice print flow', () => {
  it('marks the invoice printed only after the document was generated', async () => {
    let finishPrint!: (printed: boolean) => void
    const loadDocument = vi.fn(() => new Promise<boolean>((resolve) => {
      finishPrint = resolve
    }))
    const persistStatus = vi.fn(async () => true)

    const print = printThenPersistStatus({
      loadDocument,
      persistStatus,
      requiresStatusUpdate: true,
    })

    expect(loadDocument).toHaveBeenCalledOnce()
    expect(persistStatus).not.toHaveBeenCalled()

    finishPrint(true)
    await print

    expect(persistStatus).toHaveBeenCalledOnce()
  })

  it('does not mark the invoice printed when the print failed', async () => {
    const persistStatus = vi.fn(async () => true)

    await printThenPersistStatus({
      loadDocument: vi.fn(async () => false),
      persistStatus,
      requiresStatusUpdate: true,
    })

    expect(persistStatus).not.toHaveBeenCalled()
  })

  it('prints an already-marked document without another status update', async () => {
    const loadDocument = vi.fn(async () => true)
    const persistStatus = vi.fn(async () => true)

    await printThenPersistStatus({
      loadDocument,
      persistStatus,
      requiresStatusUpdate: false,
    })

    expect(persistStatus).not.toHaveBeenCalled()
    expect(loadDocument).toHaveBeenCalledOnce()
  })
})

describe('print failure message', () => {
  it('replaces a raw English server text with the Ukrainian fallback', () => {
    expect(printFailureMessage(new Error('The document could not be generated.'), 'Не вдалося сформувати документ'))
      .toBe('Не вдалося сформувати документ')
  })

  it('keeps a Ukrainian server message', () => {
    expect(printFailureMessage(new Error('Продаж не знайдено'), 'x')).toBe('Продаж не знайдено')
  })
})
