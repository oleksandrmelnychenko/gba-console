import { describe, expect, it } from 'vitest'
import { fitConsoleNavEntries, sameConsoleNavMeasure, type ConsoleNavMeasure } from './consoleNavFit'

const measure: ConsoleNavMeasure = { items: [100, 120, 80, 140, 90], more: 60, gap: 4, padding: 16 }

describe('fitConsoleNavEntries', () => {
  it('keeps every entry when the row fits', () => {
    expect(fitConsoleNavEntries(measure, 16 + 530 + 16, -1)).toEqual([0, 1, 2, 3, 4])
  })

  it('moves the entries that do not fit behind «Ще» in their order', () => {
    expect(fitConsoleNavEntries(measure, 16 + 100 + 120 + 80 + 60 + 3 * 4, -1)).toEqual([0, 1, 2])
    expect(fitConsoleNavEntries(measure, 16 + 100 + 120 + 80 + 60 + 3 * 4 - 1, -1)).toEqual([0, 1])
  })

  it('keeps the active entry on screen by giving up the last ones before it', () => {
    expect(fitConsoleNavEntries(measure, 16 + 100 + 120 + 90 + 60 + 3 * 4, 4)).toEqual([0, 1, 4])
    expect(fitConsoleNavEntries(measure, 16 + 100 + 120 + 80 + 60 + 3 * 4, 1)).toEqual([0, 1, 2])
  })

  it('leaves the active entry in «Ще» only when it cannot fit at all', () => {
    expect(fitConsoleNavEntries(measure, 16 + 100 + 4 + 60, 3)).toEqual([0])
    expect(fitConsoleNavEntries(measure, 16 + 60 + 4 + 140, 3)).toEqual([3])
  })
})

describe('sameConsoleNavMeasure', () => {
  it('compares every width', () => {
    expect(sameConsoleNavMeasure(null, measure)).toBe(false)
    expect(sameConsoleNavMeasure({ ...measure, items: [...measure.items] }, measure)).toBe(true)
    expect(sameConsoleNavMeasure({ ...measure, items: [100, 120, 80, 140, 91] }, measure)).toBe(false)
    expect(sameConsoleNavMeasure({ ...measure, more: 61 }, measure)).toBe(false)
  })
})
