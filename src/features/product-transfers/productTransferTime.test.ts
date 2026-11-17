import { describe, expect, it } from 'vitest'
import { getTransferTimeSource, sortTransfersNewestFirst } from './productTransferTime'

describe('getTransferTimeSource', () => {
  it('keeps a real FromDate time', () => {
    expect(getTransferTimeSource({ FromDate: '2026-11-17T18:19:00' })?.getHours()).toBe(18)
  })

  it('uses the creation time of the same day for a date-only import', () => {
    const source = getTransferTimeSource({ Created: '2026-11-17T18:19:00', FromDate: '2026-11-17T00:00:00' })

    expect(source?.getHours()).toBe(18)
    expect(source?.getMinutes()).toBe(19)
  })

  it('shows no time instead of 00:00 when none is known', () => {
    expect(getTransferTimeSource({ FromDate: '2026-11-17T00:00:00' })).toBeNull()
    expect(getTransferTimeSource({ Created: '2026-11-18T10:00:00', FromDate: '2026-11-17T00:00:00' })).toBeNull()
  })
})

describe('sortTransfersNewestFirst', () => {
  it('puts the newest transfer on top', () => {
    const sorted = sortTransfersNewestFirst([
      { Created: '2026-11-17T18:21:00', FromDate: '2026-11-17T00:00:00', Number: 'QAU01' },
      { Created: '2026-11-17T21:47:00', FromDate: '2026-11-17T00:00:00', Number: 'QAU08' },
      { Created: '2026-11-16T10:00:00', FromDate: '2026-11-16T00:00:00', Number: 'QAU00' },
      { Created: '2026-11-17T21:35:00', FromDate: '2026-11-17T00:00:00', Number: 'QAU05' },
    ])

    expect(sorted.map((transfer) => transfer.Number)).toEqual(['QAU08', 'QAU05', 'QAU01', 'QAU00'])
  })
})
