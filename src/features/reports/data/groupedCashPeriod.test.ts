import { expect, it } from 'vitest'
import type { ReportSelection } from '../types'
import { groupedCashDataset, groupedCashRequest, groupedCashWorkbookDataset } from './groupedCashPeriod.test-fixtures'
import { cashPeriodDataset, cashPeriodRequest } from './cashPeriod.test-fixtures'
import { cashPeriodConfigurationError, isCashPeriodDataset } from './cashPeriod'
import { cashFormDataset, defaultGroupedCashPeriod, groupedCashSupported, normalizeGroupedCashDataset } from './groupedCashPeriod'
import { defaultDatasetRequest, datasetPresetRequest } from './reportDatasets'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { availableBug1274WorkbookLaunches } from './bug1274WorkbookLaunch'
const selection = (type: number, id: string, condition = 0): ReportSelection => ({ IsChecked: true,
  SelectedField: { Type: type, Name: 'Synthetic' }, FilterCondition: { Type: condition, Name: 'Synthetic' },
  Values: [{ Data: { Id: id, Name: 'Synthetic' }, Name: 'Synthetic', Value: 0 }],
})
it('opts in only on a genuine explicit capability and keeps legacy four-column requests valid', () => {
  expect(isCashPeriodDataset(groupedCashDataset)).toBe(true)
  expect(groupedCashSupported(groupedCashDataset)).toBe(true)
  expect(defaultDatasetRequest(groupedCashDataset, '2026-09-01', '2026-09-30').groupedCashPeriod).toEqual(defaultGroupedCashPeriod())
  expect(defaultDatasetRequest(cashPeriodDataset, '2026-09-01', '2026-09-30').groupedCashPeriod).toBeUndefined()
  expect(cashPeriodConfigurationError(cashPeriodRequest(), groupedCashDataset, '2026-10-01')).toBeNull()
  expect(cashPeriodConfigurationError(groupedCashRequest(), cashPeriodDataset, '2026-10-01')).toMatch(/ще не підтримує/)
})
it('normalizes an additive capability without accepting duplicated aliases or a wrong dataset', () => {
  const { groupedCashPeriod, ...base } = groupedCashDataset
  expect(normalizeGroupedCashDataset({ ...base, GroupedCashPeriod: groupedCashPeriod })?.groupedCashPeriod).toEqual(groupedCashPeriod)
  expect(normalizeGroupedCashDataset({ ...groupedCashDataset, GroupedCashPeriod: groupedCashPeriod })).toBeNull()
  expect(normalizeGroupedCashDataset({ ...groupedCashDataset, DataSource: 41 })).toBeNull()
})
it('keeps the one-account no-filter form and exposes exactly four multi-account filters', () => {
  expect(cashFormDataset(groupedCashDataset, undefined)?.Filters).toEqual([])
  expect(cashFormDataset(groupedCashDataset, defaultGroupedCashPeriod())?.Filters.map(x => x.Type)).toEqual([29, 30, 32, 33])
})
it('accepts exact Int64 account identities plus bank/cash inclusion or exclusion without Number coercion', () => {
  const data = groupedCashRequest(); data.selections = [selection(29, '9223372036854775807', 4), selection(33, '1', 0)]
  expect(cashPeriodConfigurationError(data, groupedCashDataset, '2026-10-01')).toBeNull()
  expect(data.selections[0].Values[0].Data).toMatchObject({ Id: '9223372036854775807' })
  data.selections = [selection(33, '3')]
  expect(cashPeriodConfigurationError(data, groupedCashDataset, '2026-10-01')).toMatch(/Банк \/ Каса/)
})
it('rejects another selector, mixed scalar/grouped request or an unsupported native filter', () => {
  const data = groupedCashRequest()
  expect(cashPeriodConfigurationError({ ...data, cashPeriod: cashPeriodRequest().cashPeriod }, groupedCashDataset, '2026-10-01')).toMatch(/не поєднуються/)
  expect(cashPeriodConfigurationError({ ...data, dataSource: 11 })).toMatch(/належить лише/)
  expect(cashPeriodConfigurationError({ ...data, GroupedCashPeriod: defaultGroupedCashPeriod() }, groupedCashDataset, '2026-10-01')).toMatch(/двічі/)
  expect(cashPeriodConfigurationError({ ...data, selections: [selection(6, '1')] }, groupedCashDataset, '2026-10-01')).not.toBeNull()
})
it('requires eight columns and a closed period while permitting empty population and no manual balance', () => {
  const data = groupedCashRequest()
  expect(cashPeriodConfigurationError(data, groupedCashDataset, '2026-10-01')).toBeNull()
  expect(cashPeriodConfigurationError({ ...data, to: '2026-10-01' }, groupedCashDataset, '2026-10-01')).toMatch(/завершені/)
  expect(cashPeriodConfigurationError({ ...data, sorted: cashPeriodRequest().sorted }, groupedCashDataset, '2026-10-01')).toMatch(/фіксована/)
  const unsupportedBalance = { ...data, currentBalance: 1 }
  expect(cashPeriodConfigurationError(unsupportedBalance, groupedCashDataset, '2026-10-01')).not.toBeNull()
})
it('clears the old grouped selector when changing to exact mode and does not overwrite saved legacy meaning with a preset', () => {
  const data = groupedCashRequest()
  expect(retainStoredTemplateFields(data, { ...cashPeriodRequest(), groupedCashPeriod: undefined }).groupedCashPeriod).toBeUndefined()
  const preset = datasetPresetRequest(groupedCashDataset, 'native-cash-period-account-currency', cashPeriodRequest())!
  expect(preset.Data.groupedCashPeriod).toBeUndefined(); expect(preset.Data.cashPeriod).toEqual(cashPeriodRequest().cashPeriod)
  expect(preset.Data.sorted.Measurements.map(x => x.Type)).toEqual([84, 85, 86, 87])
})
it('the workbook shortcut describes and defaults to the full current bank/cash form', () => {
  const choice = availableBug1274WorkbookLaunches([groupedCashDataset]).find(x => x.dataset.DataSource === 40)!
  expect(choice.dataset.DataSource).toBe(40); expect(choice.notice).toMatch(/банківські рахунки та каси/i)
})

it('accepts the workbook axes only when the server declares the exact additional layout', () => {
  const data = groupedCashRequest()
  data.sorted.Row = [40, 44, 43].map(type => ({ type, key: String(type), label: 'Axis' }))
  expect(cashPeriodConfigurationError(data, groupedCashWorkbookDataset, '2026-10-01')).toBeNull()
  expect(cashPeriodConfigurationError(data, groupedCashDataset, '2026-10-01')).not.toBeNull()
})
it('keeps a saved scalar account request valid on the expanded dataset but refuses scalar kind grouping', () => {
  const scalar = cashPeriodRequest()
  expect(cashPeriodConfigurationError(scalar, groupedCashWorkbookDataset, '2026-10-01')).toBeNull()
  scalar.sorted.Row = [40, 44, 43].map(type => ({ type, key: String(type), label: 'Axis' }))
  expect(cashPeriodConfigurationError(scalar, groupedCashWorkbookDataset, '2026-10-01')).not.toBeNull()
})
it('refuses a malformed layout capability and any arbitrary combination of the now advertised kind axis', () => {
  expect(normalizeGroupedCashDataset({ ...groupedCashWorkbookDataset,
    groupedCashPeriod: { ...(groupedCashWorkbookDataset.groupedCashPeriod as Record<string, unknown>), RowLayouts: [[43, 40, 42, 41], [44, 40, 43]] } })).toBeNull()
  const data = groupedCashRequest()
  data.sorted.Row = [43, 44].map(type => ({ type, key: String(type), label: 'Axis' }))
  expect(cashPeriodConfigurationError(data, groupedCashWorkbookDataset, '2026-10-01')).not.toBeNull()
})
