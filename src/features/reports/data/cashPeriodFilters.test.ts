import { expect, it } from 'vitest'
import devDataset from './cashPeriod.dev-dataset-fixture.json'
import type { ReportDataset, ReportGroupingItem, ReportMeasurementGroup, ReportRequestBody, ReportSelection } from '../types'
import { CASH_PERIOD_ALL_MEASURES, cashPeriodConfigurationError } from './cashPeriod'
import { datasetConfigurationError } from './reportDatasets'
import { buildReportBuilderRequest } from './reportBuilderRequest'

const dataset = devDataset as unknown as ReportDataset
const today = '2026-11-17'
const grouping = (type: number): ReportGroupingItem => {
  const field = dataset.Groupings.find(item => item.Type === type)!
  return { key: field.Name, label: field.Name, type }
}
const LAYOUTS: Array<{ rows: number[]; workbook: boolean }> = [
  { rows: [43, 40, 42, 41], workbook: false },
  { rows: [40, 44, 43], workbook: false },
  { rows: [40], workbook: true },
  { rows: [42], workbook: true },
]
const VALUES: Record<number, string[]> = { 29: ['40755', '40758'], 30: ['10038', '2'], 32: ['10566', '10567'], 33: ['1', '2'] }
const selection = (type: number, condition: number, ids: string[]): ReportSelection => ({ IsChecked: true,
  SelectedField: { Name: 'Field', Type: type }, FilterCondition: { Name: 'Condition', Type: condition },
  Values: ids.map(id => ({ Data: { Id: id, Name: id }, Name: id, Value: 0 })) })
const measurementGroups = (types: readonly number[], unchecked: number[] = []): ReportMeasurementGroup[] => types.map(type => {
  const field = dataset.Measurements.find(item => item.Type === type)!
  return { Name: field.Name, Label: field.Name, IsChecked: !unchecked.includes(type),
    SubList: [{ Name: field.Name, Label: field.Name, Type: type, IsChecked: !unchecked.includes(type) }] }
})
const request = (rows: number[], workbook: boolean, selections: ReportSelection[], measurements = measurementGroups(CASH_PERIOD_ALL_MEASURES)): ReportRequestBody =>
  buildReportBuilderRequest({ dataSource: 40, from: '2026-10-01', to: '2026-10-31', ordering: undefined, filterExpression: undefined,
    topGroups: undefined, cashReadMode: 0, groupedCashPeriod: { Version: 1, CurrencyBasis: 'AccountAndManagementCurrency' },
    workbookPresentation: workbook ? { version: 1, additionalFields: [30, 33], ordering: null } : undefined,
    rowGroups: rows.map(grouping), colGroups: [], measurements, selections })

it('builds every offered cash filter and condition on every cash form', () => {
  for (const { rows, workbook } of LAYOUTS) {
    expect(datasetConfigurationError(request(rows, workbook, []), dataset, 'workspace')).toBeNull()
    for (const [field, ids] of Object.entries(VALUES)) for (const condition of [0, 1, 2, 4]) {
      const values = condition === 2 || condition === 4 ? ids : ids.slice(0, 1)
      const data = request(rows, workbook, [selection(Number(field), condition, values)])
      expect(datasetConfigurationError(data, dataset, 'workspace'), `${rows} ${field} ${condition}`).toBeNull()
      expect(cashPeriodConfigurationError(data, dataset, today)).toBeNull()
    }
  }
})

it('keeps the organization filter of the reported screen buildable together with other filters', () => {
  const data = request([42], true, [selection(32, 2, ['10566']), selection(30, 0, ['10038']), selection(33, 4, ['2'])])
  expect(datasetConfigurationError(data, dataset, 'workspace')).toBeNull()
})

it('sends the cash columns in the order of the statement whatever order the measures panel shows', () => {
  const reordered = measurementGroups([95, 84, 93, 86, 85, 87, 92, 94])
  const data = request([42], true, [selection(32, 2, ['10566'])], reordered)
  expect(data.sorted.Measurements.map(item => item.Type)).toEqual([...CASH_PERIOD_ALL_MEASURES])
  expect(datasetConfigurationError(data, dataset, 'workspace')).toBeNull()
})

it('asks in plain words to tick every measure instead of describing the report structure', () => {
  const data = request([42], true, [selection(32, 2, ['10566'])], measurementGroups(CASH_PERIOD_ALL_MEASURES, [94]))
  const error = cashPeriodConfigurationError(data, dataset, today)
  expect(error).toMatch(/^Позначте всі вісім показників/)
  expect(error).not.toMatch(/→|фіксована|структура/i)
  const plain = request([43, 40, 42, 41], false, [])
  const layout = cashPeriodConfigurationError({ ...plain, sorted: { ...plain.sorted, Row: [grouping(41)] } }, dataset, today)
  expect(layout).toBe('Оберіть форму руху коштів зі списку.')
  const order = cashPeriodConfigurationError({ ...request([42], true, []), sorted: { ...data.sorted,
    Measurements: [...request([42], true, []).sorted.Measurements].reverse() } }, dataset, today)
  expect(order).toMatch(/в іншому порядку/)
})
