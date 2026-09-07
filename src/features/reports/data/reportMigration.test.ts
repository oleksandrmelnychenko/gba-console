import { describe, expect, it } from 'vitest'
import type { ReportCatalogue, ReportSourceMigration } from '../types'
import { filterMigrationCatalogue, inspectCatalogueMigration, isReportCatalogue, readSourceMigration, sourceIdentity } from './reportMigration'
import { catalogueFixture, migrationFixture, sourceHash } from './reportMigration.test-fixtures'

describe('per-implementation migration evidence', () => {
  it('keeps worlds distinct and requires all implementations before counting a completed entry', () => {
    const catalogue = catalogueFixture(), view = inspectCatalogueMigration(catalogue)
    expect(view.valid).toBe(true)
    expect(view.summary).toEqual(catalogue.Migration!.Summary)
    expect(view.summary.FullyVerifiedEntries).toBe(0)
    expect(view.statuses.get(sourceIdentity(catalogue.Reports[0].Sources[0]))).toBe('parity_verified')
    expect(view.statuses.get(sourceIdentity(catalogue.Reports[0].Sources[1]))).toBe('native_partial')
    catalogue.Reports[0].Sources[1].Migration = migrationFixture('parity_verified')
    catalogue.Migration!.Summary.ByStatus = { Captured: 1, NativePartial: 0, ParityVerified: 2, Unassessed: 1 }
    catalogue.Migration!.Summary.FullyVerifiedEntries = 1
    expect(inspectCatalogueMigration(catalogue).summary.FullyVerifiedEntries).toBe(1)
  })

  it.each([
    (value: ReportSourceMigration) => { value.Validation!.Kind = 'native_scope' },
    (value: ReportSourceMigration) => { value.SourceRevisionSha256 = 'b'.repeat(64) },
    (value: ReportSourceMigration) => { value.CaptureStatus = 'incomplete' },
    (value: ReportSourceMigration) => { value.MissingScope = ['Непідтверджена історія'] },
    (value: ReportSourceMigration) => { value.Dependencies[0].Status = 'unknown' },
    (value: ReportSourceMigration) => { value.NativeDataSources = [1] },
    (value: ReportSourceMigration) => { value.Validation = null },
  ])('refuses a parity claim without complete current source proof %#', mutate => {
    const value = migrationFixture('parity_verified'); mutate(value)
    expect(readSourceMigration(value)).toBeNull()
  })

  it('retains unknown migration data as unassessed without losing catalogue entries', () => {
    const catalogue = catalogueFixture()
    catalogue.Reports[0].Sources[0].Migration = { ...migrationFixture('parity_verified'), Status: 'ready' } as unknown as ReportSourceMigration
    expect(isReportCatalogue(catalogue)).toBe(true)
    expect(inspectCatalogueMigration(catalogue).valid).toBe(false)
    expect(inspectCatalogueMigration(catalogue).summary).toMatchObject({ CatalogueEntries: 3, SourceImplementations: 4,
      ByStatus: { Unassessed: 4, ParityVerified: 0 }, FullyVerifiedEntries: 0 })
    const legacy = { ...catalogueFixture(), Migration: undefined }
    expect(inspectCatalogueMigration(legacy).summary.ByStatus.Unassessed).toBe(4)
    expect(legacy.Reports).toHaveLength(3)
  })

  it('does not infer native readiness from captured files or source hash', () => {
    const captured = migrationFixture('captured')
    expect(readSourceMigration(captured)?.Status).toBe('captured')
    expect(readSourceMigration({ ...captured, NativeDataSources: [10] })).toBeNull()
    expect(readSourceMigration({ ...captured, Status: 'parity_verified' })).toBeNull()
    const partial = migrationFixture('native_partial')
    partial.Validation!.Kind = 'source_parity'
    expect(readSourceMigration(partial)).toBeNull()
  })

  it('filters world, state and dependency on the same implementation without changing global counts', () => {
    const catalogue = catalogueFixture(), view = inspectCatalogueMigration(catalogue)
    const defaults = { kind: null, world: 'amg', status: 'parity_verified', dependency: null, search: '' }
    expect(filterMigrationCatalogue(catalogue, view, defaults)).toEqual([])
    expect(filterMigrationCatalogue(catalogue, view, { ...defaults, status: 'native_partial', dependency: 'available' })).toEqual([])
    const filtered = filterMigrationCatalogue(catalogue, view, { ...defaults, status: 'native_partial', dependency: 'partial' })
    expect(filtered.map(item => item.report.Id)).toEqual(['builtin:Debt'])
    expect(filtered[0].matchingSources.map(source => source.World)).toEqual(['amg'])
    expect(view.summary.SourceImplementations).toBe(4)
    expect(view.summary.FullyVerifiedEntries).toBe(0)
  })

  it('rejects duplicate exact source identity while preserving valid UUID and storage string identifiers', () => {
    const catalogue = catalogueFixture()
    expect(isReportCatalogue(catalogue)).toBe(true)
    catalogue.Reports[1].Sources.push({ ...catalogue.Reports[0].Sources[0] })
    expect(isReportCatalogue(catalogue)).toBe(false)
  })

  it('counts all377 entries and690 implementations separately from624 builtin/regulated implementations', () => {
    const kinds = [['builtin',256,253],['regulated',58,57],['external',26,0],['processing',7,0],['indicator',26,0],['custom',1,0],['builder',3,3]] as const
    const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: kinds.flatMap(([kind,count,doubles]) =>
      Array.from({ length: count }, (_,index) => ({ Id: `${kind}:${index}`, Name: `${kind}${index}`, Title: `${kind}${index}`, Kind: kind,
        Sources: ['fenix', ...(index < doubles ? ['amg'] : [])].map(World => ({ World, SourceId: `${kind}:${index}`, DefinitionSha256: sourceHash,
          Attributes: [], Migration: migrationFixture('captured') })) }))),
      Migration: { Version: 'full-capture-v1', GeneratedAtUtc: '2026-09-08T00:00:00Z', Summary: { CatalogueEntries: 377, SourceImplementations: 690,
        BuiltinImplementations: 624, FullyVerifiedEntries: 0, ByStatus: { Captured: 690, NativePartial: 0, ParityVerified: 0, Unassessed: 0 } } } }
    expect(isReportCatalogue(catalogue)).toBe(true)
    expect(inspectCatalogueMigration(catalogue).valid).toBe(true)
    expect(inspectCatalogueMigration(catalogue).summary).toEqual(catalogue.Migration!.Summary)
    catalogue.Migration!.Summary.SourceImplementations = 624
    expect(inspectCatalogueMigration(catalogue).summary.ByStatus).toEqual({ Captured: 0, NativePartial: 0, ParityVerified: 0, Unassessed: 690 })
  })
})
