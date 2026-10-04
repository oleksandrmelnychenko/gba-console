import type { ReportDataset, ReportRequestBody } from '../types'

export const CLIENT_DISCOUNTS_ORIGINAL_ID = '56e2ad4b-9f75-4461-a742-eb54ae01823f'
const definition = 'e355fd45fed1b64f52704baa92f09755b91bea96be74953c182f65b1c8fcc637'
const query = '6176122623be4ad0696ff2b614943d645c9290b094f9babe7f0f48854e13e2b8'
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const vector = (value: unknown, expected: readonly number[]) => Array.isArray(value)
  && value.length === expected.length && expected.every((item, index) => value[index] === item)

/** The Fenix original defaults do not grant current Source or parity acceptance. */
export function originalClientDiscountsSupported(dataset: ReportDataset): boolean {
  const value = dataset.originalClientDiscounts
  return dataset.DataSource === 25 && record(value) && value.Version === 1 && value.SourceWorld === 'fenix'
    && value.OriginalId === CLIENT_DISCOUNTS_ORIGINAL_ID && value.DefinitionSha256 === definition && value.QuerySha256 === query
    && vector(value.Rows, [55]) && vector(value.Columns, [53]) && vector(value.Measures, [64])
    && vector(value.DefaultFilters, [41, 43, 50]) && value.Aggregation === 'MaximumAtSelectedGrouping'
    && value.AdditionalRecipientField === 'КодПоРегиону' && value.CurrentSourceVerified === false && value.ParityVerified === false
    && [55, 53].every(type => dataset.Groupings.some(field => field.Type === type && field.Selectable !== false))
    && dataset.Measurements.some(field => field.Type === 64 && field.Selectable !== false)
    && [41, 43, 50].every(type => dataset.Filters.some(field => field.Type === type && field.Selectable !== false))
}

/** Fresh original defaults; no filter is active until its exact value is selected. */
export function applyOriginalClientDiscounts(data: ReportRequestBody, dataset: ReportDataset): void {
  if (!originalClientDiscountsSupported(dataset)) throw new Error('Сервер не підтвердив початковий макет звіту знижок.')
  const grouping = (type: number) => {
    const field = dataset.Groupings.find(item => item.Type === type)
    if (!field) throw new Error('Сервер не підтвердив початковий макет звіту знижок.')
    return { type, key: field.Name, label: field.Name }
  }
  const measurement = dataset.Measurements.find(field => field.Type === 64)
  if (!measurement) throw new Error('Сервер не підтвердив початковий макет звіту знижок.')
  data.sorted.Row = [grouping(55)]
  data.sorted.Col = [grouping(53)]
  data.sorted.Measurements = [{ Type: 64, Name: measurement.Name, IsChecked: true, parentName: '' }]
  data.selections = [41, 43, 50].map(type => {
    const field = dataset.Filters.find(item => item.Type === type)
    if (!field) throw new Error('Сервер не підтвердив початковий макет звіту знижок.')
    return { IsChecked: false, SelectedField: { Type: type, Name: field.Name },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [] }
  })
  data.discountMarkup = { Version: 1, SourceWorld: 1, DateEnd: '' }
}

export type ClientDiscountRegions = { Version: 1; ResultSha256: string;
  Rows: { RowSourceIndex: number; RegionCode: string | null }[] }

/** Recipient attributes have the same result hash and exact page row identities. */
export function readClientDiscountRegions(value: unknown, resultSha: string, rowIndices: readonly number[]): ClientDiscountRegions | undefined {
  if (value === undefined) return undefined
  if (!record(value) || Object.keys(value).sort().join(',') !== 'ResultSha256,Rows,Version'
    || value.Version !== 1 || value.ResultSha256 !== resultSha || !Array.isArray(value.Rows)
    || value.Rows.length !== rowIndices.length
    || !value.Rows.every((row, index) => record(row) && Object.keys(row).sort().join(',') === 'RegionCode,RowSourceIndex'
      && row.RowSourceIndex === rowIndices[index] && (row.RegionCode === null
        || typeof row.RegionCode === 'string' && row.RegionCode.length <= 512)))
    throw new Error('Не підтверджено код регіону одержувача знижки.')
  return structuredClone(value) as ClientDiscountRegions
}
