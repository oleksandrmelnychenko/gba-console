import type { ReportCatalogue, ReportCatalogueEntry, ReportCatalogueSource, ReportDependencyStatus, ReportMigrationStatus, ReportMigrationSummary, ReportSourceMigration } from '../types'

export type MigrationDisplayStatus = ReportMigrationStatus | 'unassessed'
export const MIGRATION_STATUS_LABELS: Record<MigrationDisplayStatus, string> = {
  unassessed: 'Стан перенесення не оцінено', captured: 'Джерело зафіксовано',
  native_partial: 'Частково доступно в GBA', parity_verified: 'Відповідність підтверджено',
}
export const DEPENDENCY_STATUS_LABELS: Record<ReportDependencyStatus, string> = {
  unknown: 'Не оцінено', unmapped: 'Не перенесено', partial: 'Частково покрито', available: 'Доступно',
}
export const CAPTURE_STATUS_LABELS: Record<ReportSourceMigration['CaptureStatus'], string> = {
  metadata_only: 'Збережено лише метадані', assets_captured: 'Файли джерела збережено',
  incomplete: 'Файли джерела збережено частково', unknown: 'Обсяг збережених файлів не оцінено',
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text)
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const sha256 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
const immutableRevision = (value: unknown): value is string => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value)
const publicEvidenceId = (value: unknown): value is string => text(value) && value.length <= 160
  && !value.startsWith('/') && !value.includes('://') && !/\p{Cc}/u.test(value)
/** .NET UTC timestamps retain100ns precision; Date.parse alone loses sub-millisecond ordering. */
function utcInstant(value: unknown): bigint | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?(?:Z|\+00:00)$/.exec(value)
  if (!match) return null
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== match[1]) return null
  const ticks = BigInt(milliseconds) * 10000n + BigInt((match[2] ?? '').padEnd(7, '0').slice(3))
  return ticks > BigInt(Date.parse('0001-01-01T00:00:00Z')) * 10000n ? ticks : null
}
const utc = (value: unknown): value is string => utcInstant(value) !== null

export function sourceIdentity(source: Pick<ReportCatalogueSource, 'World' | 'SourceId'>): string {
  return JSON.stringify([source.World, source.SourceId])
}

/** Validate the existing inventory without discarding unknown migration data or source rows. */
export function isReportCatalogue(value: unknown): value is ReportCatalogue {
  if (!record(value) || !text(value.CapturedOn) || !Array.isArray(value.Reports) || !Array.isArray(value.Presentations)) return false
  const sourceIds = new Set<string>(), reportIds = new Set<string>(), presentationIds = new Set<string>()
  if (!value.Presentations.every(item => {
    if (!record(item) || !text(item.Id) || !text(item.Title) || presentationIds.has(item.Id)) return false
    presentationIds.add(item.Id); return true
  })) return false
  return value.Reports.every(report => {
    if (!record(report) || ![report.Id, report.Name, report.Title, report.Kind].every(text) || reportIds.has(String(report.Id))
      || !Array.isArray(report.Sources) || !report.Sources.length) return false
    reportIds.add(String(report.Id))
    return report.Sources.every(source => {
      if (!record(source) || !text(source.World) || !text(source.SourceId) || !strings(source.Attributes)
        || (source.DefinitionSha256 !== null && !sha256(source.DefinitionSha256))) return false
      const key = sourceIdentity({ World: source.World, SourceId: source.SourceId })
      if (sourceIds.has(key)) return false
      sourceIds.add(key); return true
    })
  })
}

/** A numeric dataset mapping or native-only comparison is never source parity. */
export function readSourceMigration(value: unknown, publishedAtUtc?: string): ReportSourceMigration | null {
  if (!record(value) || !Object.hasOwn(CAPTURE_STATUS_LABELS, String(value.CaptureStatus))
    || !['captured', 'native_partial', 'parity_verified'].includes(String(value.Status))
    || (value.SourceRevisionSha256 !== null && !sha256(value.SourceRevisionSha256))
    || !Array.isArray(value.NativeDataSources) || !value.NativeDataSources.every(id => count(id) && id !== 1)
    || new Set(value.NativeDataSources).size !== value.NativeDataSources.length
    || !strings(value.CoveredScope) || !strings(value.MissingScope) || !Array.isArray(value.Dependencies)) return null
  const dependencyKeys = new Set<string>()
  if (!value.Dependencies.every(dependency => {
    if (!record(dependency) || !text(dependency.Key) || !text(dependency.Title) || !Object.hasOwn(DEPENDENCY_STATUS_LABELS, String(dependency.Status))
      || (dependency.Note !== null && !text(dependency.Note)) || dependencyKeys.has(dependency.Key)) return false
    dependencyKeys.add(dependency.Key); return true
  })) return null
  const validation = value.Validation
  if (validation !== null && (!record(validation) || !['native_scope', 'source_parity'].includes(String(validation.Kind))
    || !publicEvidenceId(validation.EvidenceId) || !utc(validation.VerifiedAtUtc) || !sha256(validation.SourceRevisionSha256)
    || validation.SourceRevisionSha256 !== value.SourceRevisionSha256 || !immutableRevision(validation.NativeRevision))) return null
  if (validation && publishedAtUtc !== undefined) {
    const published = utcInstant(publishedAtUtc), verified = utcInstant(validation.VerifiedAtUtc)
    if (published === null || verified === null || verified > published) return null
  }
  if (value.Status === 'captured') {
    if (value.NativeDataSources.length || value.CoveredScope.length || !value.MissingScope.length || validation !== null) return null
  } else {
    if (!value.NativeDataSources.length || !value.CoveredScope.length || !validation || !sha256(value.SourceRevisionSha256)) return null
    if (value.Status === 'native_partial' && (!value.MissingScope.length || validation.Kind !== 'native_scope')) return null
    if (value.Status === 'parity_verified' && (value.CaptureStatus !== 'assets_captured' || value.MissingScope.length
      || validation.Kind !== 'source_parity' || value.Dependencies.some(dependency => dependency.Status !== 'available'))) return null
  }
  return value as ReportSourceMigration
}

function summarize(reports: ReportCatalogueEntry[], statuses: ReadonlyMap<string, MigrationDisplayStatus>): ReportMigrationSummary {
  const result: ReportMigrationSummary = { CatalogueEntries: reports.length, SourceImplementations: 0, BuiltinImplementations: 0,
    ByStatus: { Unassessed: 0, Captured: 0, NativePartial: 0, ParityVerified: 0 }, FullyVerifiedEntries: 0 }
  const counters = { unassessed: 'Unassessed', captured: 'Captured', native_partial: 'NativePartial', parity_verified: 'ParityVerified' } as const
  for (const report of reports) {
    for (const source of report.Sources) {
      result.SourceImplementations += 1
      if (report.Kind === 'builtin' || report.Kind === 'regulated') result.BuiltinImplementations += 1
      result.ByStatus[counters[statuses.get(sourceIdentity(source)) ?? 'unassessed']] += 1
    }
    if (report.Sources.length && report.Sources.every(source => statuses.get(sourceIdentity(source)) === 'parity_verified')) result.FullyVerifiedEntries += 1
  }
  return result
}

function summaryMatches(value: unknown, actual: ReportMigrationSummary): boolean {
  if (!record(value) || !record(value.ByStatus)) return false
  return (['CatalogueEntries', 'SourceImplementations', 'BuiltinImplementations', 'FullyVerifiedEntries'] as const)
    .every(key => count(value[key]) && value[key] === actual[key])
    && (['Unassessed', 'Captured', 'NativePartial', 'ParityVerified'] as const)
      .every(key => count(value.ByStatus && (value.ByStatus as Record<string, unknown>)[key]) && (value.ByStatus as Record<string, unknown>)[key] === actual.ByStatus[key])
}

export function inspectCatalogueMigration(catalogue: ReportCatalogue) {
  const statuses = new Map<string, MigrationDisplayStatus>(), migrations = new Map<string, ReportSourceMigration>()
  const manifest: unknown = catalogue.Migration
  const publishedAtUtc = record(manifest) && utc(manifest.GeneratedAtUtc) ? manifest.GeneratedAtUtc : undefined
  for (const report of catalogue.Reports) for (const source of report.Sources) {
    const migration = readSourceMigration(source.Migration, publishedAtUtc), key = sourceIdentity(source)
    statuses.set(key, migration?.Status ?? 'unassessed')
    if (migration) migrations.set(key, migration)
  }
  const expected = summarize(catalogue.Reports, statuses)
  const valid = record(manifest) && text(manifest.Version) && utc(manifest.GeneratedAtUtc) && summaryMatches(manifest.Summary, expected)
  if (!valid) {
    for (const key of statuses.keys()) statuses.set(key, 'unassessed')
    migrations.clear()
  }
  return { valid, supplied: manifest !== undefined, statuses, migrations, summary: valid ? expected : summarize(catalogue.Reports, statuses) }
}

export type MigrationFilters = { kind: string | null; world: string | null; status: string | null; dependency: string | null; search: string }
export function filterMigrationCatalogue(catalogue: ReportCatalogue, inspection: ReturnType<typeof inspectCatalogueMigration>, filters: MigrationFilters) {
  const query = filters.search.trim().toLocaleLowerCase('uk')
  return catalogue.Reports.flatMap(report => {
    if ((filters.kind && report.Kind !== filters.kind) || !`${report.Title} ${report.Name}`.toLocaleLowerCase('uk').includes(query)) return []
    // World, migration and dependency filters must match the SAME implementation.
    const matchingSources = report.Sources.filter(source => {
      const key = sourceIdentity(source), migration = inspection.migrations.get(key)
      return (!filters.world || source.World === filters.world)
        && (!filters.status || inspection.statuses.get(key) === filters.status)
        && (!filters.dependency || (migration ? migration.Dependencies.some(dependency => dependency.Status === filters.dependency) : filters.dependency === 'unknown'))
    })
    return matchingSources.length ? [{ report, matchingSources }] : []
  })
}
