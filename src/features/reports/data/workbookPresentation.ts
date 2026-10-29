import type { ReportDataset, ReportRequestBody } from '../types'

export type WorkbookSelection = { version: 1 | 2 | 3; additionalFields: number[]; ordering: null | 'MonthAscending' }
export type WorkbookField = { type: number; caption: string; placement: 'inline' | 'column' | 'retainedSetting' }
export type WorkbookCapability = { version: 1 | 2 | 3; additionalFields: WorkbookField[]; orderings: string[]
  attributeKind?: 'currentProductScalar' | 'currentProductFields'; requiredRowGroupings?: number[]; supportedReportProfiles?: string[] }
export const currentProductFields = [[2, 'column'], [3, 'column'], [65, 'column'], [66, 'column']] as const
export const currentProductGroupFields = [...currentProductFields, [67, 'column'] as const]
export const isCurrentProductVersion = (version: unknown): version is 2 | 3 => version === 2 || version === 3
export const isSalesProductProfile = (request: ReportRequestBody) => request.dataSource === 2
  && ['sales', 'grossProfit'].includes(String(request.reportProfile ?? request.ReportProfile))
export const hasProductRow = (request: ReportRequestBody) => request.sorted?.Row?.some(row => row.type === 5 || row.type === 7) === true
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const aliases = (value: object) => Object.keys(value).filter(key => key.toLowerCase() === 'workbookpresentation')
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',')
export const workbookSources: ReadonlyMap<number, ReadonlyArray<readonly [number, WorkbookField['placement']]>> = new Map<number, ReadonlyArray<readonly [number, WorkbookField['placement']]>>([
  [2, currentProductFields],
  [35, [[2, 'retainedSetting'], [3, 'retainedSetting']]],
  [40, [[30, 'inline'], [33, 'inline']]],
  [41, [[30, 'inline'], [60, 'column'], [61, 'column']]],
])

/** Retain descriptions losslessly; reject invalid UTF-16 before display or hashing. */
export function workbookText(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}
export const workbookHasText = (value: string | null): boolean => value !== null && /[^\p{White_Space}]/u.test(value)

export function readWorkbookSelection(value: unknown): WorkbookSelection | null {
  if (!record(value)) return null
  const fields = new Map<string, unknown>()
  for (const [key, item] of Object.entries(value)) {
    const canonical = ({ Version: 'version', version: 'version', AdditionalFields: 'additionalFields',
      additionalFields: 'additionalFields', Ordering: 'ordering', ordering: 'ordering' } as Record<string, string>)[key]
    if (!canonical || fields.has(canonical)) return null
    fields.set(canonical, item)
  }
  const additional = fields.get('additionalFields')
  const ordering = fields.get('ordering')
  if (fields.size !== 3 || ![1, 2, 3].includes(Number(fields.get('version'))) || !Number.isInteger(fields.get('version')) || !Array.isArray(additional) || additional.length > (fields.get('version') === 3 ? 5 : fields.get('version') === 2 ? 4 : 3)
    || additional.some(type => !Number.isSafeInteger(type)) || new Set(additional).size !== additional.length
    || !(ordering === null || ordering === 'MonthAscending')) return null
  return { version: fields.get('version') as 1 | 2 | 3, additionalFields: [...additional], ordering }
}

export function requestWorkbookPresentation(value: object): unknown {
  const key = aliases(value)[0]
  return key === undefined ? undefined : (value as Record<string, unknown>)[key]
}
export function cloneWorkbookAliases(value: object): Record<string, unknown> {
  return Object.fromEntries(aliases(value).map(key => [key, structuredClone((value as Record<string, unknown>)[key])]))
}
export function readWorkbookCapability(value: unknown, source: number): WorkbookCapability | null {
  const expected = workbookSources.get(source)
  if (source === 2) return readCurrentProductCapability(value)
  if (!expected || !record(value) || !exactKeys(value, ['version', 'additionalFields', 'orderings'])
    || value.version !== 1 || !Array.isArray(value.additionalFields) || value.additionalFields.length !== expected.length
    || !Array.isArray(value.orderings) || (source === 35
      ? value.orderings.length !== 1 || value.orderings[0] !== 'MonthAscending'
      : value.orderings.length !== 0)) return null
  const fields: WorkbookField[] = []
  for (let index = 0; index < expected.length; index++) {
    const field = value.additionalFields[index]
    if (!record(field) || !exactKeys(field, ['type', 'caption', 'placement']) || field.type !== expected[index][0]
      || field.placement !== expected[index][1] || !workbookText(field.caption) || !workbookHasText(field.caption)) return null
    fields.push({ type: field.type as number, caption: field.caption, placement: field.placement as WorkbookField['placement'] })
  }
  return { version: 1, additionalFields: fields, orderings: [...value.orderings] }
}
function readCurrentProductCapability(value: unknown, version: 2 | 3 = 2): WorkbookCapability | null {
  const expectedFields = version === 3 ? currentProductGroupFields : currentProductFields
  const attributeKind = version === 3 ? 'currentProductFields' : 'currentProductScalar'
  if (!record(value) || !exactKeys(value, ['version', 'additionalFields', 'orderings', 'attributeKind', 'requiredRowGroupings', 'supportedReportProfiles'])
    || value.version !== version || value.attributeKind !== attributeKind
    || JSON.stringify(value.requiredRowGroupings) !== '[5,7]'
    || JSON.stringify(value.supportedReportProfiles) !== '["sales","grossProfit"]'
    || !Array.isArray(value.orderings) || value.orderings.length !== 0
    || !Array.isArray(value.additionalFields) || value.additionalFields.length !== expectedFields.length) return null
  const fields: WorkbookField[] = []
  for (const [index, expected] of expectedFields.entries()) {
    const field = value.additionalFields[index]
    if (!record(field) || !exactKeys(field, ['type', 'caption', 'placement']) || field.type !== expected[0]
      || field.placement !== expected[1] || !workbookText(field.caption) || !workbookHasText(field.caption)) return null
    fields.push({ type: expected[0], caption: field.caption, placement: 'column' })
  }
  return { version, additionalFields: fields, orderings: [], attributeKind,
    requiredRowGroupings: [5, 7], supportedReportProfiles: ['sales', 'grossProfit'] }
}

/** Additive metadata: old clients continue reading the unchanged v2 workbook capability. */
export function readProductGroupListCapability(value: unknown): WorkbookCapability | null {
  return readCurrentProductCapability(value, 3)
}
export function currentProductCapability(dataset?: ReportDataset): WorkbookCapability | null {
  if (dataset?.DataSource !== 2) return null
  return readProductGroupListCapability(dataset.currentProductGroupLists) ?? readWorkbookCapability(dataset.workbookPresentation, 2)
}

export function normalizeWorkbookDataset(value: Record<string, unknown>): ReportDataset | null {
  const keys = aliases(value)
  if (keys.length > 1 || keys.some(key => key !== 'workbookPresentation')) return null
  if (!keys.length || value.workbookPresentation == null) return value as ReportDataset
  const capability = readWorkbookCapability(value.workbookPresentation, Number(value.DataSource))
  return capability ? { ...value, workbookPresentation: capability } as ReportDataset : null
}

export function cashWorkbookPresentationSupported(dataset?: ReportDataset): boolean {
  if (dataset?.DataSource !== 40 || !readWorkbookCapability(dataset.workbookPresentation, 40)
    || !record(dataset.groupedCashPeriod)) return false
  const rows = dataset.groupedCashPeriod.PresentedWorkbookRows
  return Array.isArray(rows) && rows.length === 1 && rows[0] === 40
}

/** Each currency record of a multi-currency desk is its own row, like the separate single-currency desks of 1C. */
export function cashCurrencyRecordWorkbookSupported(dataset?: ReportDataset): boolean {
  if (!cashWorkbookPresentationSupported(dataset) || !record(dataset?.groupedCashPeriod)) return false
  const rows = dataset.groupedCashPeriod.PresentedCurrencyRecordRows
  return Array.isArray(rows) && rows.length === 1 && rows[0] === 42
}

function option(data: object, name: string): unknown {
  const key = Object.keys(data).find(key => key.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : (data as Record<string, unknown>)[key]
}
/** API callers validate semantics; the form additionally requires current server capabilities. */
export function workbookConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data)
  if (keys.length > 1 || keys.some(key => key !== 'workbookPresentation' && key !== 'WorkbookPresentation'))
    return 'Налаштування форми задано повторно або невідомим полем.'
  const raw = requestWorkbookPresentation(data)
  if (raw == null) return null
  const selected = readWorkbookSelection(raw)
  const expected = data.dataSource === 2 && selected?.version === 3 ? currentProductGroupFields : workbookSources.get(data.dataSource ?? -1)
  if (!selected || !expected || (data.dataSource === 2 ? !isCurrentProductVersion(selected.version) : selected.version !== 1) || selected.additionalFields.some(type => !expected.some(field => field[0] === type))
    || selected.ordering !== null && data.dataSource !== 35) return 'Непідтверджені додаткові поля або порядок форми.'
  if (dataset && (dataset.DataSource !== data.dataSource || !(selected.version === 3
    ? readProductGroupListCapability(dataset.currentProductGroupLists) : readWorkbookCapability(dataset.workbookPresentation, data.dataSource ?? -1))))
    return 'Поточний сервер не підтвердив ці налаштування форми.'
  if (data.dataSource === 2 && !isSalesProductProfile(data))
    return 'Поточні поля товару доступні лише у звітах продажів і валового прибутку.'
  if (data.dataSource === 2 && !hasProductRow(data))
    return 'Додайте «Товар» або «Назва товару» до рядків або приберіть додаткові поля товару.'
  if (dataset && data.dataSource === 40 && !cashWorkbookPresentationSupported(dataset))
    return 'Сервер ще не підтвердив форму коштів із рядками лише за рахунком / касою.'
  if (data.dataSource === 35 && option(data, 'dayOrganizationBasis') !== 0)
    return 'Налаштування книги за днем доступні для продажів і повернень за період.'
  const cashRows = data.sorted?.Row?.map(field => field.type).join(',')
  if (data.dataSource === 40 && (!record(option(data, 'groupedCashPeriod'))
    || cashRows !== '40' && !(cashRows === '42' && (!dataset || cashCurrencyRecordWorkbookSupported(dataset)))))
    return 'Форма коштів із додатковими полями групується лише за рахунком / касою або за рахунком / касою у валюті.'
  const settlements = option(data, 'groupedSettlementPeriod')
  if (data.dataSource === 41 && (!record(settlements)
    || !['4,41,76', '4,76'].includes(data.sorted?.Row?.map(field => field.type).join(',') ?? '')
    || option(settlements, 'SourceWorld') !== 'Fenix' && selected.additionalFields.some(type => type === 60 || type === 61)))
    return 'Додаткові поля взаєморозрахунків потребують групової форми; менеджер і регіон доступні для Fenix.'
  return null
}

export function sameWorkbookSelection(left: WorkbookSelection, right: WorkbookSelection): boolean {
  return left.version === right.version && left.ordering === right.ordering
    && left.additionalFields.join(',') === right.additionalFields.join(',')
}
