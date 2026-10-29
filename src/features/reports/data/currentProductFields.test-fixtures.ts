import { grossDataset, netDataset } from './reportDatasets.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
import { workbookPreview } from './workbookPresentation.test-fixtures'
import type { ReportDataset } from '../types'
import type { WorkbookPreview } from './workbookPreview'

export const productCapability = { version: 2, attributeKind: 'currentProductScalar', requiredRowGroupings: [5, 7],
  supportedReportProfiles: ['sales', 'grossProfit'], orderings: [], additionalFields: [
    { type: 2, caption: 'Артикул (поточний товар)', placement: 'column' },
    { type: 3, caption: 'Топ (поточний товар)', placement: 'column' },
    { type: 65, caption: 'Опис (поточний товар)', placement: 'column' },
    { type: 66, caption: 'Розмір (поточний товар)', placement: 'column' }] }
export const productDataset: ReportDataset = { ...netDataset, Groupings: grossDataset.Groupings,
  reportProfiles: ['sales', 'grossProfit'], workbookPresentation: productCapability,
  constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] } }
export function productRequest(profile = 'sales') {
  const request = defaultDatasetRequest(productDataset, '2026-10-18', '2026-10-27')
  request.reportProfile = profile
  request.sorted.Row = [{ type: 7, key: 'ProductName', label: 'Назва товару' }]
  request.sorted.Col = []
  request.workbookPresentation = { version: 2, additionalFields: [66, 2], ordering: null }
  return request
}
export function productPreview() {
  const raw = workbookPreview()
  const proof: WorkbookPreview = { version: 2, resultSha256: raw.ResultSha256,
    selection: { version: 2, additionalFields: [66, 2], ordering: null },
    fields: [productCapability.additionalFields[3], productCapability.additionalFields[0]] as WorkbookPreview['fields'],
    rows: [{ rowSourceIndex: 12, rowKeySha256: 'b'.repeat(64), currencyWitnesses: [], values: [
      { type: 66, state: 'null', values: [], inputSha256: 'c'.repeat(64) },
      { type: 2, state: 'known', values: ['SEM14631'], inputSha256: 'd'.repeat(64) }] }] }
  return { ...raw, Request: { ...raw.Request, DataSource: 'NativeSalesNet' },
    RowSchema: [{ Identity: 'ProductName', Caption: 'Назва товару', KeyKind: 'Numeric' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Товар', Identity: { Kind: 'signedInteger', Value: '9223372036854775807', Provenance: 'rowAxisKey' } }] }],
    workbookPresentation: proof }
}
