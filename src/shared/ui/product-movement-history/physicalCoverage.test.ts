import { describe, expect, it } from 'vitest'
import { physicalCoverageIntervals, physicalMovementResponse, readPhysicalCoverage } from './physicalCoverage'
import { partialPhysicalCoverage as coverage } from './physicalCoverage.test-fixtures'

describe('physical coverage transport', () => {
  it.each([[], null])('retains coverage independently of empty Body %j', Body => {
    expect(physicalMovementResponse({ Body, PhysicalCoverage: [coverage] })).toEqual({ body: Body, coverage: [coverage] })
  })
  it('supports legacy arrays without inventing coverage', () => {
    expect(physicalMovementResponse([{ Qty: 3 }])).toEqual({ body: [{ Qty: 3 }], coverage: [] })
  })
  it('shows the inclusive Kyiv last day without using browser timezone', () => {
    expect(physicalCoverageIntervals([coverage])).toEqual(['01.01.2025 — 02.11.2026'])
    expect(physicalCoverageIntervals([{ ...coverage, AvailableThroughExclusiveUtc: '2026-07-01T21:00:00Z' }])).toEqual(['01.01.2025 — 01.07.2026'])
  })
  it.each([
    ['2026-11-03T10:15:23Z', '03.11.2026 12:15:23'],
    ['2026-07-01T09:15:23Z', '01.07.2026 12:15:23'],
  ])('shows the observed intraday cutoff rather than claiming the whole day: %s', (cutoff, local) => {
    expect(physicalCoverageIntervals([{ ...coverage, AvailableThroughExclusiveUtc: cutoff }]))
      .toEqual([`01.01.2025 — до ${local} (Київ)`])
  })
  it('deduplicates identical warehouse ranges and hides complete coverage notices', () => {
    expect(physicalCoverageIntervals([coverage, { ...coverage, StorageId: 2 }])).toHaveLength(1)
    expect(physicalCoverageIntervals([{ ...coverage, ImportedPeriodComplete: true }])).toEqual([])
  })
  it.each([{ AvailableThroughExclusiveUtc: 'invalid' }, { AvailableThroughExclusiveUtc: coverage.AvailableFromUtc }, { ImportedPeriodComplete: 'false' }, { StorageId: 0 }, { RequestedFromUtc: '2026-01-01T00:00:00' }])('rejects malformed present metadata %j', change => {
    expect(() => readPhysicalCoverage([{ ...coverage, ...change }])).toThrow('межі історії')
  })
})
