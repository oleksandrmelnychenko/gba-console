import type { ReportDataset, ReportRequestBody } from '../types'

type RecordValue = Record<string, unknown>
export type SourceCounterpartyGroups = { Version: 1; SourceWorld: 'fenix'; IncludeGroupIds: string[]; ExcludeGroupIds: string[] }
export type CounterpartyGroupChoice = { Id: string; Name: string }
const aliases = (value: object) => Object.keys(value).filter(key => key.toLowerCase() === 'sourcecounterpartygroups')
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactFields = (value: unknown, expected: readonly string[]): RecordValue | null => {
  if (!record(value) || Object.keys(value).length !== expected.length) return null
  const result: RecordValue = {}
  for (const field of expected) {
    const keys = Object.keys(value).filter(key => key.toLowerCase() === field.toLowerCase())
    if (keys.length !== 1) return null
    result[field] = value[keys[0]]
  }
  return result
}
export const counterpartyGroupId = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{32}$/i.test(value) && !/^0{32}$/.test(value)
export function requestSourceCounterpartyGroups(data: object): unknown {
  const key = aliases(data)[0]
  return key === undefined ? undefined : (data as RecordValue)[key]
}
export const cloneSourceCounterpartyGroupAliases = (data: object): RecordValue => Object.fromEntries(
  aliases(data).map(key => [key, structuredClone((data as RecordValue)[key])]))

export function sourceCounterpartyGroups(value: unknown): SourceCounterpartyGroups | null {
  const fields = exactFields(value, ['Version', 'SourceWorld', 'IncludeGroupIds', 'ExcludeGroupIds'])
  if (!fields || fields.Version !== 1 || fields.SourceWorld !== 'fenix'
    || !Array.isArray(fields.IncludeGroupIds) || !Array.isArray(fields.ExcludeGroupIds)
    || fields.IncludeGroupIds.length + fields.ExcludeGroupIds.length > 64
    || [...fields.IncludeGroupIds, ...fields.ExcludeGroupIds].some(id => !counterpartyGroupId(id))
    || [fields.IncludeGroupIds, fields.ExcludeGroupIds].some(ids => new Set(ids.map(id => (id as string).toUpperCase())).size !== ids.length)) return null
  return structuredClone(fields) as SourceCounterpartyGroups
}
export function sourceCounterpartyGroupCapability(value: unknown): boolean {
  const fields = exactFields(value, ['Version', 'SourceWorld', 'MaximumGroupIds', 'UsesCurrentCapturedHierarchy',
    'ExclusionsTakePrecedence', 'GroupIdFormat'])
  return fields?.Version === 1 && fields.SourceWorld === 'fenix' && fields.MaximumGroupIds === 64
    && fields.UsesCurrentCapturedHierarchy === true && fields.ExclusionsTakePrecedence === true
    && fields.GroupIdFormat === '32 hexadecimal characters (16 bytes)'
}
export function normalizeSourceCounterpartyGroupDataset(value: RecordValue): ReportDataset | null {
  const keys = aliases(value)
  if (keys.length > 1) return null
  const raw = keys.length ? value[keys[0]] : undefined
  if (raw != null && (value.DataSource !== 41 || value.groupedSettlementPeriod == null || !sourceCounterpartyGroupCapability(raw))) return null
  const normalized = { ...value }
  for (const key of keys) delete normalized[key]
  if (raw != null) normalized.sourceCounterpartyGroups = structuredClone(raw)
  return normalized as ReportDataset
}
export function sourceCounterpartyGroupsConfigurationError(data: ReportRequestBody, sourceWorld: string | undefined,
  dataset?: ReportDataset): string | null {
  if (aliases(data).length > 1) return 'Відбір груп контрагентів задано двічі.'
  const raw = requestSourceCounterpartyGroups(data)
  if (raw == null) return null
  if (data.dataSource !== 41 || sourceWorld !== 'Fenix') return 'Групи контрагентів доступні для поточних групових взаєморозрахунків Fenix.'
  if (!sourceCounterpartyGroups(raw)) return 'Оберіть до 64 точних поточних груп контрагентів Fenix без повторів у кожному списку.'
  return dataset && !sourceCounterpartyGroupCapability(dataset.sourceCounterpartyGroups)
    ? 'Сервер не підтвердив відбір груп контрагентів для цієї форми.' : null
}
export function changeCounterpartyGroupList(value: unknown, list: 'IncludeGroupIds' | 'ExcludeGroupIds', ids: string[]): unknown {
  const selected = sourceCounterpartyGroups(value) ?? { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [], ExcludeGroupIds: [] }
  const changed = { ...selected, [list]: ids }
  return changed.IncludeGroupIds.length + changed.ExcludeGroupIds.length === 0 ? undefined : changed
}
