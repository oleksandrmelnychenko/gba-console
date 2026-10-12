import { describe, expect, it } from 'vitest'
import { createSalesReportPreset } from './reportPresets'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetMeasurements, defaultDatasetRequest } from './reportDatasets'
import { supplierBasisFormDataset } from './supplierBasis'
import { flattenCheckedMeasurements } from './reportOptions'
import type { ReportDataset } from '../types'
import { retainStoredGroupingLabels, retainStoredMeasurementLabels, retainStoredTemplateFields } from './reportTemplateDraft'

describe('saved-template draft preservation', () => {
  it('preserves unrecognized settings and grouping metadata while allowing explicit option removal and full filter edits', () => {
    const data = createSalesReportPreset('agreements', '', '', []).Data
    const stored = { ...data, future: { nil: null, enabled: false }, ordering: { Version: 1 },
      sorted: { ...data.sorted, futureLayout: ['keep'], Row: data.sorted.Row.map(item => ({ ...item, futureId: 42 })) } }
    const draft = { ...data, from: '2026-09-01', selections: [{ SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'InGroup', Type: 6 }, IsChecked: false, Values: [{ Name: '42', Value: 42, Data: { Id: 42 } }] }] }
    const result = retainStoredTemplateFields(stored, draft)
    expect(result).toMatchObject({ future: { nil: null, enabled: false }, from: '2026-09-01', selections: draft.selections })
    expect(result.sorted).toMatchObject({ futureLayout: ['keep'], Row: stored.sorted.Row })
    expect(result).not.toHaveProperty('ordering')
    expect(result.selections).not.toBe(draft.selections)
    expect(stored.ordering).toEqual({ Version: 1 })
  })
  it('retains stored unchecked measures and their metadata without restoring a checked measure deselected in the form', () => {
    const data = createSalesReportPreset('agreements', '', '', []).Data
    const first = data.sorted.Measurements[0]
    const unchecked = { ...first, Type: 902, IsChecked: false, future: { nil: null, keep: 0 } }
    const deselected = { ...first, Type: 903, IsChecked: true }
    const stored = { ...data, sorted: { ...data.sorted, Measurements: [first, unchecked, deselected] } }
    const draft = { ...data, sorted: { ...data.sorted, Measurements: [first] } }
    const result = retainStoredTemplateFields(stored, draft)
    expect(result.sorted.Measurements).toEqual([first, unchecked])
    expect(result.sorted.Measurements[1]).not.toBe(unchecked)
    const selected = retainStoredTemplateFields(stored, { ...draft, sorted: { ...draft.sorted,
      Measurements: [first, { ...unchecked, IsChecked: true }] } })
    expect(selected.sorted.Measurements.filter(item => item.Type === 902)).toEqual([{ ...unchecked, IsChecked: true }])
  })

  it('retains explicit saved captions for the same measures while new measures use current defaults', () => {
    const data = createSalesReportPreset('agreements', '', '', []).Data
    const first = data.sorted.Measurements[0]
    const stored = { ...data, sorted: { ...data.sorted, Measurements: [{ ...first, Label: 'Власний підпис' }] } }
    const draft = { ...data, sorted: { ...data.sorted, Measurements: [
      { ...first, Label: 'Поточний стандартний підпис' }, { ...first, Type: 999, Label: 'Новий показник' },
    ] } }
    const before = structuredClone(stored)
    const result = retainStoredTemplateFields(stored, draft)
    expect(result.sorted.Measurements.map(item => item.Label)).toEqual(['Власний підпис', 'Новий показник'])
    expect(stored).toEqual(before)
    expect(result.sorted.Measurements[0]).not.toBe(stored.sorted.Measurements[0])
    expect(retainStoredTemplateFields({ ...stored, dataSource: 99 }, draft).sorted.Measurements[0].Label)
      .toBe('Поточний стандартний підпис')
    expect(retainStoredTemplateFields({ ...stored, sorted: { ...stored.sorted, Measurements: [first] } }, draft)
      .sorted.Measurements[0].Label).toBe('Поточний стандартний підпис')
    for (const Label of ['', '   ', null]) {
      const malformed = { ...stored, sorted: { ...stored.sorted, Measurements: [{ ...first, Label }] } }
      expect(retainStoredTemplateFields(malformed as never, draft).sorted.Measurements[0].Label)
        .toBe('Поточний стандартний підпис')
    }
  })

  it('applies saved row and column captions using current metadata without changing new or foreign-source defaults', () => {
    const data = createSalesReportPreset('agreements', '', '', []).Data
    const row = { type: 41, key: 'SettlementCurrency', label: 'Валюта взаєморозрахунків' }
    const column = { type: 76, key: 'Counterparty', label: 'Контрагент' }
    const stored = { ...data, dataSource: 41, sorted: { ...data.sorted,
      Row: [{ ...row, key: 'OldCurrencyKey', label: 'Валюта рахунку' }],
      Col: [{ ...column, label: 'Власний підпис колонки' }],
    } }
    const before = structuredClone(stored)
    expect(retainStoredGroupingLabels(stored, 41, 'Row', [row])).toEqual([{ ...row, label: 'Валюта рахунку' }])
    expect(retainStoredGroupingLabels(stored, 41, 'Col', [column])).toEqual([{ ...column, label: 'Власний підпис колонки' }])
    expect(retainStoredGroupingLabels(stored, 39, 'Row', [row])).toEqual([row])
    expect(retainStoredGroupingLabels(stored, 41, 'Row', [column])).toEqual([column])
    for (const label of ['', '   ', null]) {
      const invalid = { ...stored, sorted: { ...stored.sorted, Row: [{ ...row, label }] } }
      expect(retainStoredGroupingLabels(invalid as never, 41, 'Row', [row])).toEqual([row])
    }
    const duplicate = { ...stored, sorted: { ...stored.sorted, Row: [stored.sorted.Row[0], row] } }
    expect(retainStoredGroupingLabels(duplicate, 41, 'Row', [row])).toEqual([row])
    expect(stored).toEqual(before)
  })

  const supplier: ReportDataset = {
    DataSource: 38, Name: 'Прибуток', Description: '', PeriodSupported: true, PeriodRequired: true,
    supplierBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], MaximumDays: 31,
      IncludesReturns: true, PreservesUnavailableValues: true, RegistrarWarehouseGrouping: 78 },
    supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
    Groupings: [73, 78, 4, 21].map(Type => ({ Type, Name: `Група ${Type}` })),
    Measurements: [0, 2, 6, 10, 12, 14].map(Type => ({ Type, Name: `Показник ${Type}` })),
    Filters: [], Limitations: [],
  }

  function supplierRebuild(stored: ReturnType<typeof defaultDatasetRequest>, basis: unknown) {
    const measurements = retainStoredMeasurementLabels(stored, { dataSource: 38, supplierBasis: basis },
      datasetMeasurements(supplierBasisFormDataset(supplier, basis), stored.sorted.Measurements))
    return buildReportBuilderRequest({ dataSource: 38, from: stored.from, to: stored.to,
      supplierBasis: basis, supplierSourceWorld: 0, rowGroups: stored.sorted.Row, colGroups: [],
      measurements, selections: [], ordering: undefined, filterExpression: undefined,
      topGroups: undefined, valuationClientAgreementId: undefined })
  }

  it('round-trips the complete restored supplier request despite the adapted quantity default caption', () => {
    const stored = defaultDatasetRequest(supplier, '2026-08-01', '2026-09-30')
    stored.sorted.Measurements[0].Label = 'Кількість за регістром собівартості 1С'
    const rebuilt = supplierRebuild(stored, 0)
    expect(rebuilt).toEqual(stored)
    expect(datasetMeasurements(supplierBasisFormDataset(supplier, 0), stored.sorted.Measurements)[0].SubList[0].Label)
      .toBe('Кількість продажів мінус повернення')
    expect(retainStoredTemplateFields(stored, rebuilt)).toEqual(stored)
    expect(flattenCheckedMeasurements(datasetMeasurements(supplierBasisFormDataset(supplier, 0), [])))
      .toEqual([])
  })

  it.each([[0, 1], [1, 0], [0, undefined], [0, null]])(
    'keeps the new quantity default when the user changes supplier calculation %s to %s', (before, after) => {
      const stored = defaultDatasetRequest(supplier, '2026-08-01', '2026-09-30')
      stored.supplierBasis = before
      stored.sorted.Measurements[0].Label = 'Збережений підпис кількості'
      stored.sorted.Measurements[1].Label = 'Власний підпис продажів'
      const rebuilt = supplierRebuild(stored, after)
      const result = retainStoredTemplateFields(stored, rebuilt)
      expect(result.sorted.Measurements[0].Label).toBe(after === 0
        ? 'Кількість продажів мінус повернення' : 'Кількість за регістром собівартості 1С')
      expect(result.sorted.Measurements[1].Label).toBe('Власний підпис продажів')
    },
  )

  it.each([undefined, null, 1])('preserves a saved caption for equivalent legacy supplier basis %s', basis => {
    const stored = defaultDatasetRequest(supplier, '2026-08-01', '2026-09-30')
    delete stored.supplierBasis
    stored.SupplierBasis = basis
    stored.sorted.Measurements[0].Label = 'Власна назва кількості'
    expect(retainStoredTemplateFields(stored, supplierRebuild(stored, 1)).sorted.Measurements[0].Label)
      .toBe('Власна назва кількості')
  })

})
