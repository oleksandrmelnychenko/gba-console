import { expect, it } from 'vitest'
import { reportAxisCaption, type ReportCaptionAxisSchema } from './reportAxisCaption'
import { previewSharedNames } from './nativeReportPreview'
import { datasetFieldHierarchy, datasetHierarchyDescriptor, withDatasetGroupConditions } from './reportHierarchyFilters'
import { REPORT_FILTER_CONDITIONS } from './reportOptions'
import type { ReportDataset } from '../types'
import type { AnalysisHierarchy } from './currentVparivanieAnalysis'

// Authored contract examples, not actual SQL/HTTP or financial receipts.
const schema: ReportCaptionAxisSchema = { Caption: 'Користувач проведення', Identity: 'SaleDocumentManagerPosted', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }
it.each(['Unique [2025]', 'Twin [9007199254740993]', 'Twin [9223372036854775807]', 'Twin (ID 9007199254740993)', '∅', ''])('preserves the supplied source46 posting caption %j', caption => {
  expect(reportAxisCaption('NativePriceComparison', schema, caption, previewSharedNames([caption]))).toBe(caption)
})
it('keeps same-name posting identities complete on separate one-row pages and together', () => {
  const labels = ['Twin [9007199254740993]', 'Twin [9223372036854775807]']
  for (const label of labels) {
    expect(reportAxisCaption('NativePriceComparison', schema, label, previewSharedNames([label]))).toBe(label)
    expect(reportAxisCaption('NativePriceComparison', schema, label, previewSharedNames(labels))).toBe(label)
  }
})
it.each(['Captioned','KeyKind','DisplayKind'] as const)('keeps old cleanup when posting metadata is missing %s', key => {
  const incomplete = { ...schema };delete incomplete[key]
  expect(reportAxisCaption('NativePriceComparison', incomplete, 'Business [2025]')).toBe('Business')
})
it.each([{...schema,Captioned:false},{...schema,Captioned:'true'},{...schema,KeyKind:'Text'},{...schema,DisplayKind:'Numeric'},
  {...schema,Identity:'SaleDocumentManagerInput'},{...schema,Identity:'Supplier'}])('does not trust conflicting or deferred source46 metadata %#', invalid => {
  expect(reportAxisCaption('NativePriceComparison', invalid, 'Business [2025]')).toBe('Business')
})
it.each(['NativeSalesNet','NativeCustomerGroupComparison','NativePurchases','NativeStockPeriod'])('does not broaden %s posting captions', source => {
  expect(reportAxisCaption(source, schema, 'Business [2025]')).toBe('Business')
})
const hierarchy = (field: number): AnalysisHierarchy => ({version:1,groupKind:field===1?'productGroup':'counterpartyGroup',itemKind:field===1?'product':'buyer',itemField:field,
  groupConditions:[3,5,6,7],mixedConditions:[3,5],source:'Поточні групи GBA',maximumPageSize:50,
  browseEndpoint:field===1?'/report/datasets/current-vparivanie/analysis/groups':'/report/datasets/current-vparivanie/analysis/hierarchy',
  statusEndpoint:'/report/datasets/current-vparivanie/analysis/hierarchy-status'})
const dataset = (field: number): ReportDataset => ({DataSource:46,Name:'Порівняння',Description:'',Groupings:[{Type:5,Name:'Товар'}],Measurements:[{Type:2,Name:'Продажі'}],Filters:[{Type:field,Name:field===1?'Товар':'Покупець',hierarchy:hierarchy(field)}],Limitations:[]})
it.each([1,6])('admits all8 source46 field%i conditions only from owned valid hierarchy metadata', field => {
  const data = dataset(field)
  expect(datasetFieldHierarchy(data,field)?.itemField).toBe(field)
  expect(datasetHierarchyDescriptor(data,field,'Вибір')?.hierarchy?.itemKind).toBe(field===1?'product':'buyer')
  expect(withDatasetGroupConditions(data,field,REPORT_FILTER_CONDITIONS).map(item=>item.Type)).toEqual([0,1,2,3,4,5,6,7])
  expect(datasetFieldHierarchy({...data,Filters:[{Type:field,Name:'Вибір'}]},field)).toBeUndefined()
  expect(datasetFieldHierarchy({...data,Filters:[{...data.Filters[0],hierarchy:{...hierarchy(field),itemKind:'supplier'}}]},field)).toBeUndefined()
})
