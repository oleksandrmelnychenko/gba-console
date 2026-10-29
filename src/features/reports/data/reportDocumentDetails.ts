import type { ReportDataset, ReportGroupingItem, ReportRequestBody } from '../types'

export const DOCUMENT_DETAIL_GROUPING = 84
export const DOCUMENT_DETAIL_LABEL = 'Детальний запис GBA'
type DetailCapability = { version: 1; grouping: 84; profiles: ['sales', 'grossProfit']; maximumUserRows: 2; maximumColumns: 1; deepestRowOnly: true; unsupportedTransforms: string[]; unallocatedCaption: string }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function readDocumentDetails(value: unknown): DetailCapability | undefined {
  if (!record(value) || Object.keys(value).sort().join(',') !== ['version', 'grouping', 'profiles', 'maximumUserRows', 'maximumColumns', 'deepestRowOnly', 'unsupportedTransforms', 'unallocatedCaption'].sort().join(',')
    || value.version !== 1 || value.grouping !== 84 || JSON.stringify(value.profiles) !== '["sales","grossProfit"]'
    || value.maximumUserRows !== 2 || value.maximumColumns !== 1 || value.deepestRowOnly !== true
    || JSON.stringify(value.unsupportedTransforms) !== '["topGroups","abcClassification","threshold"]'
    || value.unallocatedCaption !== 'Без підтвердженої деталізації') return undefined
  return value as DetailCapability
}
function profile(data: ReportRequestBody): unknown {
  const entries = Object.entries(data).filter(([key]) => key.toLowerCase() === 'reportprofile')
  return entries.length === 1 ? entries[0][1] : undefined
}
export function hasDocumentDetails(data: ReportRequestBody): boolean {
  return [...(Array.isArray(data.sorted?.Row) ? data.sorted.Row : []), ...(Array.isArray(data.sorted?.Col) ? data.sorted.Col : [])].some(row => row?.type === DOCUMENT_DETAIL_GROUPING)
}
export function documentDetailsSupported(dataset: ReportDataset | undefined, data: ReportRequestBody): boolean {
  const name = profile(data)
  if (data.dataSource !== 2 || dataset?.DataSource !== 2 || !readDocumentDetails(dataset.documentDetails)
    || (name !== 'sales' && name !== 'grossProfit') || !Array.isArray(dataset.reportProfiles) || !dataset.reportProfiles.includes(name)
    || !record(dataset.profileGroupings) || !Array.isArray(dataset.profileGroupings[name])) return false
  return dataset.profileGroupings[name].some(field => record(field) && field.Type === 84 && field.Selectable === true && typeof field.Name === 'string' && !!field.Name.trim())
}
/** The existing grouping wire is the saved setting; never infer or silently repair a template. */
export function documentDetailsError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (!hasDocumentDetails(data)) return null
  if (data.dataSource !== 2 || !['sales', 'grossProfit'].includes(String(profile(data))))
    return 'Детальні записи доступні лише у звітах продажів і валового прибутку.'
  if (dataset && !documentDetailsSupported(dataset, data)) return 'Сервер не підтвердив детальні записи. Вимкніть деталізацію або оновіть можливості звіту.'
  const rows = data.sorted.Row.map(row => row.type)
  if (data.sorted.Col.some(row => row.type === 84) || rows.filter(type => type === 84).length !== 1 || rows.at(-1) !== 84)
    return 'Детальний запис має бути останнім рівнем рядків. Вимкніть і знову увімкніть деталізацію.'
  if (rows.length - 1 > 2 || data.sorted.Col.length > 1)
    return 'Для деталізації залиште не більше двох групувань рядків і одного групування стовпців.'
  if (Object.entries(data).some(([key, value]) => ['topgroups', 'abcclassification', 'threshold'].includes(key.toLowerCase()) && value != null))
    return 'Детальні записи несумісні з ТОП, ABC-класифікацією та порогом. Вимкніть ці налаштування або деталізацію.'
  return null
}
export function appendBeforeDocumentDetail(groups: ReportGroupingItem[], item: ReportGroupingItem): ReportGroupingItem[] {
  if (groups.some(group => group.type === item.type)) return groups
  const index = groups.findIndex(group => group.type === 84)
  return index < 0 ? [...groups, item] : [...groups.slice(0, index), item, ...groups.slice(index)]
}
