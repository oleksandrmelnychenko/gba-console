import type { ReportCatalogue, ReportMigrationStatus, ReportSourceMigration } from '../types'

export const sourceHash = 'a'.repeat(64)
export function migrationFixture(status: ReportMigrationStatus): ReportSourceMigration {
  return { CaptureStatus: 'assets_captured', SourceRevisionSha256: sourceHash, Status: status,
    NativeDataSources: status === 'captured' ? [] : [10],
    CoveredScope: status === 'captured' ? [] : ['Поточний борг за підтвердженою валютою й точним договором.'],
    MissingScope: status === 'parity_verified' ? [] : ['Історія взаєморозрахунків ще не перенесена.'],
    Dependencies: [{ Key: 'register:debt', Title: 'Регістр взаєморозрахунків', Status: status === 'parity_verified' ? 'available' : 'partial', Note: null }],
    Validation: status === 'captured' ? null : { Kind: status === 'parity_verified' ? 'source_parity' : 'native_scope', EvidenceId: 'independent-proof-v1',
      VerifiedAtUtc: '2026-09-08T00:00:00Z', SourceRevisionSha256: sourceHash, NativeRevision: 'b'.repeat(40) } }
}

export function catalogueFixture(): ReportCatalogue {
  return { CapturedOn: '2026-09-07', Presentations: [{ Id: 'complex', Title: 'Складне представлення' }],
    Reports: [
      { Id: 'builtin:Debt', Name: 'Debt', Title: 'Борг за договорами', Kind: 'builtin', Sources: [
        { World: 'fenix', SourceId: 'same-source-id', DefinitionSha256: sourceHash, Attributes: [], Migration: migrationFixture('parity_verified') },
        { World: 'amg', SourceId: 'same-source-id', DefinitionSha256: sourceHash, Attributes: [], Migration: migrationFixture('native_partial') },
      ] },
      { Id: 'external:Returns', Name: 'Returns', Title: 'Повернення постачальникам', Kind: 'external', Sources: [
        { World: 'fenix', SourceId: '0xabcd', DefinitionSha256: null, Attributes: [], Migration: migrationFixture('captured') },
      ] },
      { Id: 'builder:Query', Name: 'Query', Title: 'Конструктор запиту', Kind: 'builder', Sources: [
        { World: 'amg', SourceId: 'builder-id', DefinitionSha256: null, Attributes: [] },
      ] },
    ], Migration: { Version: 'migration-v1', GeneratedAtUtc: '2026-09-08T01:00:00Z', Summary: {
      CatalogueEntries: 3, SourceImplementations: 4, BuiltinImplementations: 2,
      ByStatus: { Unassessed: 1, Captured: 1, NativePartial: 1, ParityVerified: 1 }, FullyVerifiedEntries: 0,
    } } }
}
