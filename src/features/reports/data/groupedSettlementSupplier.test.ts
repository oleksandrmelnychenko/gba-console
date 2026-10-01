import { expect, it } from 'vitest'
import { groupedSettlementSupplierDataset as dataset, groupedSettlementSupplierRequest as request, supplierSelection } from './groupedSettlementSupplier.test-fixtures'
import { groupedSettlementDataset as buyerDataset, groupedSettlementRequest } from './groupedSettlementPeriod.test-fixtures'
import { settlementPeriodRequest } from './settlementPeriod.test-fixtures'
import { groupedSettlementCapability, groupedSettlementConfigurationError, groupedSettlementSupportsSuppliers,
  groupedWorkbookRequest, isGroupedSettlementDataset, requestGroupedSettlementPeriod, settlementFormDataset } from './groupedSettlementPeriod'
import { datasetConfigurationError, datasetFilters, datasetPresetRequest, datasetPresets } from './reportDatasets'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { requestSourceBuyerSubtree } from './nativeExactFilters'

it('admits the exact additive six-filter contract while preserving the accepted buyer-only contract', () => {
  expect(isGroupedSettlementDataset(dataset)).toBe(true)
  expect(groupedSettlementSupportsSuppliers(dataset)).toBe(true)
  expect(groupedSettlementCapability(buyerDataset.groupedSettlementPeriod)).toEqual(buyerDataset.groupedSettlementPeriod)
  expect(groupedSettlementSupportsSuppliers(buyerDataset)).toBe(false)
  const cap = dataset.groupedSettlementPeriod as Record<string, unknown>
  const camel = Object.fromEntries(Object.entries(cap).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]))
  expect(groupedSettlementCapability(camel)).toEqual(cap)
  for (const patch of [{ usesCurrentNativeSupplierAgreements: true }, { UsesCurrentNativeSupplierAgreements: false },
    { Filters: [0, 6, 9, 30] }, { Filters: [0, 6, 9, 17, 30] }])
    expect(groupedSettlementCapability({ ...cap, ...patch })).toBeNull()
  expect(groupedSettlementCapability({ ...(buyerDataset.groupedSettlementPeriod as object), Filters: [0, 6, 9, 17, 18, 30] })).toBeNull()
})
it('exposes genuine supplier and supplier-contract fields independently from buyer fields', () => {
  const fields = datasetFilters(settlementFormDataset(dataset, request().groupedSettlementPeriod))
  expect(fields.map(item => item.field.Type)).toEqual([0, 6, 9, 17, 18, 30])
  expect(fields.find(item => item.field.Type === 17)?.field.Name).toBe('Supplier')
  expect(fields.find(item => item.field.Type === 18)?.field.Name).toBe('SupplierContract')
  expect(settlementFormDataset(dataset, undefined)?.Filters).toEqual([])
})
it('preserves exact supplier include/exclude IDs and Boolean leaves without assigning them to buyer IDs', () => {
  const data = request()
  data.selections = [supplierSelection(17, '9007199254740993'), supplierSelection(18, '9223372036854775807', 4)]
  data.filterExpression = { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } }
  expect(datasetConfigurationError(data, dataset)).toBeNull()
  expect(groupedSettlementConfigurationError(data, undefined, '2026-10-01')).toBeNull()
  expect(datasetConfigurationError(data, buyerDataset)).not.toBeNull()
  expect(data.selections.map(item => [item.SelectedField.Type, item.Values[0].Data.Id])).toEqual([
    [17, '9007199254740993'], [18, '9223372036854775807'],
  ])
  data.selections[1].Values[0].Data.Id = 'not-an-id'
  expect(datasetConfigurationError(data, dataset)).not.toBeNull()
})
it('keeps existing grouped buyer and exact scalar saved drafts unchanged on a supplier-capable server', () => {
  for (const original of [groupedSettlementRequest(), settlementPeriodRequest()]) {
    const saved = normalizeSavedTemplate({ Id: crypto.randomUUID(), Revision: 1, Name: 'Original saved scope', Data: {
      DataSource: original.dataSource, From: original.from, To: original.to, Sorted: structuredClone(original.sorted), Selections: [],
      ...(original.groupedSettlementPeriod === undefined ? {} : { GroupedSettlementPeriod: structuredClone(original.groupedSettlementPeriod) }),
      ...(original.settlementPeriod === undefined ? {} : { SettlementPeriod: structuredClone(original.settlementPeriod) }),
      ...(original.sourceBuyerSubtree === undefined ? {} : { SourceBuyerSubtree: structuredClone(original.sourceBuyerSubtree) }),
    } })
    expect(requestGroupedSettlementPeriod(saved.Data)).toEqual(original.groupedSettlementPeriod)
    expect(saved.Data.settlementPeriod).toEqual(original.settlementPeriod)
    expect(requestSourceBuyerSubtree(saved.Data)).toEqual(original.sourceBuyerSubtree)
    expect(datasetConfigurationError(saved.Data, dataset)).toBeNull()
    const preset = datasetPresetRequest(dataset, datasetPresets(dataset)[0].id, saved.Data)!
    expect(requestGroupedSettlementPeriod(preset.Data)).toEqual(original.groupedSettlementPeriod)
    expect(preset.Data.settlementPeriod).toEqual(original.settlementPeriod)
    expect(requestSourceBuyerSubtree(preset.Data)).toEqual(original.sourceBuyerSubtree)
  }
})
it('keeps the default Buyers scope for both workbook layouts until the user explicitly clears it', () => {
  const data = request()
  expect(data.sourceBuyerSubtree).toEqual(groupedSettlementRequest().sourceBuyerSubtree)
  data.selections = [supplierSelection(17, '9007199254740993')]
  const debtor = groupedWorkbookRequest(data, false)
  expect(debtor.sorted.Row.map(item => item.type)).toEqual([4, 76])
  expect(debtor.sourceBuyerSubtree).toEqual(data.sourceBuyerSubtree)
  expect(debtor.selections).toEqual(data.selections)
  expect(datasetConfigurationError(debtor, dataset)).toBeNull()
  delete debtor.sourceBuyerSubtree
  expect(datasetConfigurationError(debtor, dataset)).toBeNull()
  expect(data.sourceBuyerSubtree).toBeTruthy()
})
it('retains only explicit supplier selections in the managed draft and never rewrites native ownership', () => {
  const data = request(); data.selections = [supplierSelection(18, '9223372036854775807')]
  const changed = { ...data, selections: [supplierSelection(17, '9007199254740993')] }
  const draft = retainStoredTemplateFields(data, changed)
  expect(draft.selections).toEqual(changed.selections)
  expect(draft.sourceBuyerSubtree).toEqual(data.sourceBuyerSubtree)
  expect(data.selections[0].SelectedField.Type).toBe(18)
})
