import type { OneCTurnoverScopeSummary, ReportCatalogue } from '../types'
import { ORGANIZATION_ONLY_TURNOVER_IDS, ORGANIZATION_ONLY_TURNOVER_CHOICE } from './oneCTurnoverScopes'
import { migrationFixture } from './reportMigration.test-fixtures'
export const organizationOnlyScope: OneCTurnoverScopeSummary = {
  Key: 'a'.repeat(64), Filters: { ScopeVersion: 3, OrganizationIds: [...ORGANIZATION_ONLY_TURNOVER_IDS], ProductKindId: null, ExcludeServices: null, BuyerRootId: null },
  OrganizationNames: ['Організація 1', 'Організація 2', 'Організація 3', 'Організація 4'],
  FirstDay: '2026-09-01', LastDay: '2026-10-24', LoadedDayCount: 54,
  OldestReadCompletedUtc: '2026-10-24T08:00:00Z', NewestReadCompletedUtc: '2026-10-24T08:01:00Z',
}
export const turnoverCatalogue: ReportCatalogue = {
  CapturedOn: '2026-10-24', Presentations: [], Reports: [{ Id: ORGANIZATION_ONLY_TURNOVER_CHOICE.reportId,
    Name: 'ВаловаяПрибыль', Title: 'Валовий прибуток', Kind: 'builtin', Sources: [{ World: 'fenix',
      SourceId: ORGANIZATION_ONLY_TURNOVER_CHOICE.sourceId, DefinitionSha256: 'c'.repeat(64), Attributes: [],
      Migration: { ...migrationFixture('native_partial'), NativeDataSources: [1, 35] } }] }],
  Migration: { Version: 'turnover-v3-fixture', GeneratedAtUtc: '2026-10-24T00:00:00Z', Summary: {
    CatalogueEntries: 1, SourceImplementations: 1, BuiltinImplementations: 1, FullyVerifiedEntries: 0,
    ByStatus: { Captured: 0, NativePartial: 1, ParityVerified: 0, Unassessed: 0 },
  } },
}
