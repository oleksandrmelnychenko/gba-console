/** Source buyer attributes remain independent of local manager/region identities. */
export function settlementAttributeKey(field: number, value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('Id' in value) || typeof value.Id !== 'string') return null
  const key = value.Id
  if (field === 60) return /^[0-9A-F]{32}$/.test(key) ? key : null
  return field === 61 && (key === 'region:null' || /^region:(?:[0-9A-F]{4}){0,256}$/.test(key)) ? key : null
}
export type SettlementCounterpartyAttribute = { RowSourceIndex: number; ManagerAvailable: boolean;
  ManagerName: string | null; ManagerAssigned: boolean | null; RegionAvailable: boolean; RegionCode: string | null; InputSha256: string }
export type SettlementCounterpartyAttributes = { Version: 1; ResultSha256: string; Rows: SettlementCounterpartyAttribute[] }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const nullableText = (value: unknown, bound: number) => value === null || typeof value === 'string' && value.length <= bound
export function readSettlementCounterpartyAttributes(value: unknown, resultSha: string, rowIndices: readonly number[]): SettlementCounterpartyAttributes | undefined {
  if (value === undefined) return undefined
  if (!record(value) || Object.keys(value).sort().join(',') !== 'ResultSha256,Rows,Version'
    || value.Version !== 1 || value.ResultSha256 !== resultSha || !Array.isArray(value.Rows) || value.Rows.length !== rowIndices.length)
    throw new Error('Некоректна прив’язка реквізитів контрагента.')
  const keys = 'InputSha256,ManagerAssigned,ManagerAvailable,ManagerName,RegionAvailable,RegionCode,RowSourceIndex'
  if (!value.Rows.every((row, index) => record(row) && Object.keys(row).sort().join(',') === keys
    && row.RowSourceIndex === rowIndices[index] && typeof row.ManagerAvailable === 'boolean'
    && typeof row.RegionAvailable === 'boolean' && nullableText(row.ManagerName, 1024) && nullableText(row.RegionCode, 256)
    && (row.ManagerAssigned === null || typeof row.ManagerAssigned === 'boolean')
    && (row.ManagerAvailable ? row.ManagerAssigned === false && row.ManagerName === null
      || row.ManagerAssigned === true && typeof row.ManagerName === 'string'
      : row.ManagerName === null && row.ManagerAssigned === null)
    && (row.RegionAvailable || row.RegionCode === null)
    && typeof row.InputSha256 === 'string' && /^[0-9a-f]{64}$/.test(row.InputSha256)))
    throw new Error('Непідтверджені реквізити контрагента.')
  return structuredClone(value) as SettlementCounterpartyAttributes
}
export function settlementAttributeText(row: SettlementCounterpartyAttribute | undefined, field: 'manager' | 'region'): string {
  if (!row) return '—'
  return field === 'manager' ? row.ManagerAvailable ? row.ManagerAssigned === false ? '∅' : row.ManagerName ?? '—' : '—'
    : row.RegionAvailable ? row.RegionCode ?? '∅' : '—'
}
