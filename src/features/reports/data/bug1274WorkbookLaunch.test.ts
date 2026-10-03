import { expect, it } from 'vitest'
import { cashPeriodDataset } from './cashPeriod.test-fixtures'
import { settlementPeriodDataset } from './settlementPeriod.test-fixtures'
import { currentVparivanieDataset } from './currentVparivanie.test-fixtures'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, type WorkbookLaunch } from './bug1274WorkbookLaunch'
import type { ReportDataset } from '../types'
import { groupedCashDataset, groupedCashWorkbookDataset } from './groupedCashPeriod.test-fixtures'
import { groupedSettlementDataset } from './groupedSettlementPeriod.test-fixtures'
import { cashPeriodConfigurationError } from './cashPeriod'
import { defaultDatasetRequest } from './reportDatasets'

const dayDataset: ReportDataset = {
  DataSource: 35, Name: 'Валовий прибуток за днем', Description: '', PeriodRequired: true, PeriodSupported: true,
  Groupings: [3, 4].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: String(Type) })),
  Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: String(Type) })),
  productClassification: { Version: 1, SourceWorld: 0, RequiresIsService: true,
    RequiresProductKindId: true, ProductKindIdFormat: '32 hexadecimal characters (16 bytes)' },
  sourceOrganizations: { Version: 1, SourceWorlds: ['fenix'], MaximumOrganizationIds: 64,
    OrganizationIdFormat: '32 hexadecimal characters (16 bytes)', RequiresDurableNativeBinding: true,
    RequiresCompleteFactLineage: true },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40',
    RequiresCompletePeriodLineage: true, UsesCurrentCapturedHierarchy: true },
  Limitations: [],
}
const supplierDataset: ReportDataset = {
  DataSource: 38, Name: 'Валовий прибуток за постачальниками', Description: '', PeriodRequired: true, PeriodSupported: true,
  Groupings: [73, 4, 21].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [0, 2, 3, 4, 6, 7, 8, 10, 12, 14].map(Type => ({ Type, Name: String(Type) })),
  Filters: [0, 1, 17].map(Type => ({ Type, Name: String(Type) })),
  supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
  Limitations: [],
}

it('maps the five bounded workbook forms to exact live native capabilities', () => {
  const launches = availableBug1274WorkbookLaunches([
    dayDataset, supplierDataset, currentVparivanieDataset, cashPeriodDataset, settlementPeriodDataset,
  ])
  expect(launches.map(item => [item.fileName, item.dataset.DataSource])).toEqual([
    ['ВП.xls', 35],
    ['ВП по постачальниках.xls', 38],
    ['Впарювання.xls', 39],
    ['Ведомость по денежным средствам.xls', 40],
    ['Взаємороз всі.xls', 41],
  ])
  expect(launches.every(item => item.notice.includes('Часткова форма Excel'))).toBe(true)
  expect(launches.some(item => item.fileName === 'ДБіторка.xls')).toBe(false)
})

it('withholds a workbook shortcut when its capability is missing, malformed or duplicated', () => {
  expect(availableBug1274WorkbookLaunches([])).toEqual([])
  expect(availableBug1274WorkbookLaunches([{ ...cashPeriodDataset, cashPeriod: undefined },
    { ...settlementPeriodDataset, settlementPeriod: undefined }])).toEqual([])
  expect(availableBug1274WorkbookLaunches([cashPeriodDataset, cashPeriodDataset,
    settlementPeriodDataset]).map(item => item.dataset.DataSource)).toEqual([41])
  expect(availableBug1274WorkbookLaunches([dayDataset, { ...supplierDataset, supplierSourceWorld: undefined },
    { ...currentVparivanieDataset, currentVparivanie: undefined }]).map(item => item.dataset.DataSource)).toEqual([35])
  expect(availableBug1274WorkbookLaunches([{ ...dayDataset, sourceBuyerSubtree: undefined }])).toEqual([])
  expect(availableBug1274WorkbookLaunches([dayDataset, dayDataset])).toEqual([])
})

it('mentions the registrar preset only when the server advertises that axis', () => {
  const oldLaunch = availableBug1274WorkbookLaunches([supplierDataset])[0]
  const versioned = { ...supplierDataset, Groupings: [73, 78, 4, 21].map(Type =>
    ({ Type, Name: String(Type) })) }
  const newLaunch = availableBug1274WorkbookLaunches([versioned])[0]
  expect(oldLaunch.notice).not.toContain('складом продажу 1С')
  expect(newLaunch.notice).toContain('Валовий прибуток за складом продажу 1С')
})

const cashLaunch = (dataset: ReportDataset): WorkbookLaunch => ({ fileName: 'Ведомость по денежным средствам.xls',
  label: 'Рух коштів за період', notice: '', dataset })
const cashDefaults = () => defaultDatasetRequest(groupedCashWorkbookDataset, '2026-09-01', '2026-09-30')

it('opens the cash Excel shortcut with the exact sample axes and all eight current measures', () => {
  const request = cashDefaults()
  const launch = availableBug1274WorkbookLaunches([groupedCashWorkbookDataset])[0]
  const result = bug1274WorkbookRequest(request, launch)
  expect(result.sorted.Row.map(row => row.type)).toEqual([40, 44, 43])
  expect(result.sorted.Measurements.map(field => field.Type)).toEqual([84, 85, 86, 87, 92, 93, 94, 95])
  expect(cashPeriodConfigurationError(result, groupedCashWorkbookDataset, '2026-10-01')).toBeNull()
  expect(request.sorted.Row.map(row => row.type)).toEqual([43, 40, 42, 41])
  expect(defaultDatasetRequest(groupedCashWorkbookDataset, '2026-09-01', '2026-09-30')).toEqual(request)
})
it('uses current server captions and detaches the shortcut request without changing selections or currency basis', () => {
  const request = cashDefaults()
  request.selections = [{ IsChecked: true, SelectedField: { Type: 33, Name: 'Вид' },
    FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: '1' }, Value: 0, Name: 'Банк' }] }]
  const result = bug1274WorkbookRequest(request, cashLaunch(groupedCashWorkbookDataset))
  expect(result.sorted.Row[1].label).toBe('Тип рахунку')
  expect(result.selections).toEqual(request.selections); expect(result.groupedCashPeriod).toEqual(request.groupedCashPeriod)
  result.selections[0].Values[0].Name = 'Changed'; result.sorted.Measurements[0].Name = 'Changed'
  expect(request.selections[0].Values[0].Name).toBe('Банк'); expect(request.sorted.Measurements[0].Name).not.toBe('Changed')
})
it.each([
  groupedCashDataset,
  { ...groupedCashWorkbookDataset, groupedCashPeriod: { ...(groupedCashWorkbookDataset.groupedCashPeriod as object),
    RowLayouts: [[43, 40, 42, 41], [44, 40, 43]] } },
  { ...groupedCashWorkbookDataset, groupedCashPeriod: { ...(groupedCashWorkbookDataset.groupedCashPeriod as object),
    RowLayouts: [[40, 44, 43]] } },
])('keeps the current request when no exact two-layout capability admits the sample %#', dataset => {
  const request = cashDefaults()
  expect(bug1274WorkbookRequest(request, cashLaunch(dataset))).toBe(request)
  expect(request.sorted.Row.map(row => row.type)).toEqual([43, 40, 42, 41])
})
it.each(['missing', 'disabled', 'duplicate'] as const)('does not synthesize an unavailable sample kind axis: %s', invalid => {
  const dataset = structuredClone(groupedCashWorkbookDataset)
  if (invalid === 'missing') dataset.Groupings = dataset.Groupings.filter(field => field.Type !== 44)
  else if (invalid === 'disabled') dataset.Groupings.find(field => field.Type === 44)!.Selectable = false
  else dataset.Groupings.push({ Type: 44, Name: 'Duplicate' })
  const request = cashDefaults()
  expect(bug1274WorkbookRequest(request, cashLaunch(dataset))).toBe(request)
})
it('preserves a saved scalar account request and unrelated/default launches', () => {
  const scalar = defaultDatasetRequest(cashPeriodDataset, '2026-09-01', '2026-09-30')
  expect(bug1274WorkbookRequest(scalar, cashLaunch(groupedCashWorkbookDataset))).toBe(scalar)
  const request = cashDefaults()
  expect(bug1274WorkbookRequest(request)).toBe(request)
  expect(bug1274WorkbookRequest(request, { ...cashLaunch(groupedCashWorkbookDataset), fileName: 'ВП.xls' })).toBe(request)
  expect(bug1274WorkbookRequest(request, { ...cashLaunch(groupedCashWorkbookDataset), dataset: dayDataset })).toBe(request)
})
it('preserves the two settlement workbook layouts and independent currency witnesses', () => {
  const request = defaultDatasetRequest(groupedSettlementDataset, '2026-09-01', '2026-09-30')
  const launches = availableBug1274WorkbookLaunches([groupedSettlementDataset])
  const all = bug1274WorkbookRequest(request, launches.find(item => item.fileName === 'Взаємороз всі.xls'))
  const debt = bug1274WorkbookRequest(request, launches.find(item => item.fileName === 'ДБіторка.xls'))
  expect(all.sorted.Row.map(row => row.type)).toEqual([4, 41, 76])
  expect(debt.sorted.Row.map(row => row.type)).toEqual([4, 76])
  expect(debt.groupedSettlementPeriod).toEqual(request.groupedSettlementPeriod)
  expect(debt.sorted.Measurements).toEqual(request.sorted.Measurements)
  expect(request.sorted.Row.map(row => row.type)).toEqual([4, 41, 76])
})
