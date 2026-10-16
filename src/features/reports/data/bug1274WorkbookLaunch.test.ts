import { beforeEach, expect, it, vi } from 'vitest'
import { cashPeriodDataset } from './cashPeriod.test-fixtures'
import { settlementPeriodDataset } from './settlementPeriod.test-fixtures'
import { currentVparivanieDataset } from './currentVparivanie.test-fixtures'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, opensOnPreviousDay, type WorkbookLaunch } from './bug1274WorkbookLaunch'
import type { ReportDataset } from '../types'
import { groupedCashDataset, groupedCashWorkbookDataset } from './groupedCashPeriod.test-fixtures'
import { groupedSettlementDataset } from './groupedSettlementPeriod.test-fixtures'
import { cashPeriodConfigurationError, previousKyivDay } from './cashPeriod'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { profitDayDataset, profitSupplierDataset } from './profitReadMode.test-fixtures'
import { cashModeDataset } from './cashReadMode.test-fixtures'
import { settlementModeDataset } from './settlementReadMode.test-fixtures'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from './dayOrganizationGrossProfit'
import { groupCapability } from './sourceCounterpartyGroups.test-fixtures'
import { SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS } from './sourceCounterpartyGroups'
import { DAY_WORKBOOK_FILTERS_NOTICE, DEBTOR_WORKBOOK_CURRENCY_NOTICE, SETTLEMENT_WORKBOOK_CURRENCY_NOTICE,
  SETTLEMENT_WORKBOOK_EXCLUSIONS_NOTICE } from './bug1274WorkbookLaunch'
import { FENIX_BUYERS_ROOT_ID, nativeExactFiltersConfigurationError } from './nativeExactFilters'

const surface = vi.hoisted(() => ({ only: true }))
vi.mock('../reportSurfacePolicy', () => ({ get BUG_1274_ONLY_REPORT_SURFACE() { return surface.only } }))
beforeEach(() => { surface.only = true })

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

it('opens «Взаємороз всі.xls» on current documents without the three excluded counterparty groups of the workbook', () => {
  const dataset = { ...settlementModeDataset, sourceCounterpartyGroups: groupCapability }
  const launches = availableBug1274WorkbookLaunches([dataset])
  const all = launches.find(item => item.fileName === 'Взаємороз всі.xls')!
  const debt = launches.find(item => item.fileName === 'ДБіторка.xls')!
  const day = previousKyivDay(formatKyivBusinessDate())
  const request = defaultDatasetRequest(dataset, day, day), before = structuredClone(request)
  const opened = bug1274WorkbookRequest(request, all)
  expect(opened).toMatchObject({ settlementReadMode: 0, sourceBuyerSubtree: { BuyerRootId: FENIX_BUYERS_ROOT_ID },
    sourceCounterpartyGroups: { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [],
      ExcludeGroupIds: ['A156005056C0000811E182DA08AE7D43', 'B1A7005056C0000811E18EBBAA67CF52', '8AB2005056C0000811DEFEBB3581EBEC'] },
    workbookPresentation: { version: 1, additionalFields: [30, 60, 61], ordering: null } })
  expect(opened.selections).toEqual([])
  expect(opened.sorted.Row.map(row => row.type)).toEqual([4, 41, 76])
  expect(datasetConfigurationError(opened, dataset)).toBeNull()
  expect(request).toEqual(before)
  expect(all.notice).toContain(SETTLEMENT_WORKBOOK_EXCLUSIONS_NOTICE)
  expect(SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS.map(group => group.Name)).toEqual(['Харків Скляр', 'Ніжин - ФОП Гречківська О.І.', 'НЕВІДОМІ'])
  const debtor = bug1274WorkbookRequest(request, debt)
  expect(debtor).not.toHaveProperty('sourceCounterpartyGroups')
  expect(debt.notice).not.toContain(SETTLEMENT_WORKBOOK_EXCLUSIONS_NOTICE)
  const explicit = { ...request, sourceCounterpartyGroups: undefined }
  expect(bug1274WorkbookRequest(explicit, all).sourceCounterpartyGroups).toBeUndefined()
  const legacy = { ...request, settlementReadMode: 1 }
  expect(bug1274WorkbookRequest(legacy, all)).not.toHaveProperty('sourceCounterpartyGroups')
  const withoutCapability = availableBug1274WorkbookLaunches([settlementModeDataset]).find(item => item.fileName === 'Взаємороз всі.xls')!
  expect(bug1274WorkbookRequest(defaultDatasetRequest(settlementModeDataset, day, day), withoutCapability)).not.toHaveProperty('sourceCounterpartyGroups')
  expect(withoutCapability.notice).not.toContain(SETTLEMENT_WORKBOOK_EXCLUSIONS_NOTICE)
})

const currentDayDataset: ReportDataset = { ...dayDataset,
  dayOrganizationBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], OperationalMaximumDays: 31,
    SignedRegisterMaximumDays: 1, LegacyInferenceWhenAbsent: true } }
const dayDefaults = () => defaultDatasetRequest(currentDayDataset, '2026-09-01', '2026-09-30')
const dayLaunch = (dataset = currentDayDataset): WorkbookLaunch => ({ fileName: 'ВП.xls', label: '', notice: '', dataset })

it('opens the day workbook with its three exact retained filters and keeps the ordinary request detached', () => {
  const request = dayDefaults(), before = structuredClone(request)
  const result = bug1274WorkbookRequest(request, dayLaunch())
  expect(result).toMatchObject({ dataSource: 35, from: '2026-09-01', to: '2026-09-30', dayOrganizationBasis: 0,
    productClassification: { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
    sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
    sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID } })
  expect(result.sorted).toEqual(request.sorted)
  expect(result.selections).toEqual(request.selections)
  expect(nativeExactFiltersConfigurationError(result, currentDayDataset)).toBeNull()
  const organizations = result.sourceOrganizations as { OrganizationIds: string[] }
  organizations.OrganizationIds.pop(); result.sorted.Row[0].label = 'Changed'
  expect(request).toEqual(before)
  expect(defaultDatasetRequest(currentDayDataset, request.from, request.to)).toEqual(before)
  expect(DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS).toHaveLength(4)
  expect(DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS).not.toContain(DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS[0])
})

it.each(['productClassification', 'sourceOrganizations', 'sourceBuyerSubtree'] as const)(
  'preserves an explicit %s scope including saved aliases, null and undefined', field => {
    for (const key of [field, field[0].toUpperCase() + field.slice(1)]) {
      for (const value of [null, undefined, { Version: 9, UserChoice: 'Keep this exact saved scope' }]) {
        const request = { ...dayDefaults(), [key]: value }, before = structuredClone(request)
        expect(bug1274WorkbookRequest(request, dayLaunch())).toBe(request)
        expect(request).toEqual(before)
        expect(Object.keys(request).filter(k => k.toLowerCase() === field.toLowerCase())).toEqual([key])
      }
    }
  })

it('keeps an active native organization selection and admits only inactive selections beside the workbook defaults', () => {
  const request = dayDefaults()
  request.selections = [{ IsChecked: true, SelectedField: { Type: 0, Name: 'Організація' },
    FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: '1' }, Value: 0, Name: 'Обрана організація' }] }]
  expect(bug1274WorkbookRequest(request, dayLaunch())).toBe(request)
  request.selections[0].IsChecked = false
  const result = bug1274WorkbookRequest(request, dayLaunch())
  expect(result.sourceOrganizations).toMatchObject({ OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] })
  expect(result.selections).toEqual(request.selections)
  expect(nativeExactFiltersConfigurationError(result, currentDayDataset)).toBeNull()
})

it('does not infer workbook filters for an old or malformed server, an explicit legacy basis or another launch', () => {
  const request = dayDefaults()
  for (const dataset of [{ ...currentDayDataset, dayOrganizationBasis: undefined },
    { ...currentDayDataset, productClassification: undefined }, { ...currentDayDataset, sourceOrganizations: undefined },
    { ...currentDayDataset, sourceBuyerSubtree: undefined },
    { ...currentDayDataset, sourceBuyerSubtree: { ...(currentDayDataset.sourceBuyerSubtree as object), BuyerRootId: '1'.repeat(32) } }]) {
    expect(bug1274WorkbookRequest(request, dayLaunch(dataset))).toBe(request)
  }
  for (const basis of [null, undefined, 1]) {
    const saved = { ...request, dayOrganizationBasis: basis }
    expect(bug1274WorkbookRequest(saved, dayLaunch())).toBe(saved)
  }
  const duplicate = { ...request, DayOrganizationBasis: 1 }
  expect(bug1274WorkbookRequest(duplicate, dayLaunch())).toBe(duplicate)
  expect(bug1274WorkbookRequest(request)).toBe(request)
  expect(bug1274WorkbookRequest(request, { ...dayLaunch(), fileName: 'ВП по постачальниках.xls' })).toBe(request)
})

it('opens every workbook with an advertised source on current GBA documents and keeps an explicit registers choice', () => {
  const launches = availableBug1274WorkbookLaunches([profitDayDataset, profitSupplierDataset, cashModeDataset, settlementModeDataset])
  expect(launches.map(item => item.fileName)).toEqual(['ВП.xls', 'ВП по постачальниках.xls',
    'Ведомость по денежным средствам.xls', 'Взаємороз всі.xls', 'ДБіторка.xls'])
  const day = previousKyivDay(formatKyivBusinessDate())
  const mode = (request: ReturnType<typeof defaultDatasetRequest>) => request.dataSource === 40 ? request.cashReadMode
    : request.dataSource === 41 ? request.settlementReadMode : request.profitReadMode
  for (const launch of launches) {
    const opened = bug1274WorkbookRequest(defaultDatasetRequest(launch.dataset, day, day), launch)
    expect(mode(opened)).toBe(0)
    expect(datasetConfigurationError(opened, launch.dataset)).toBeNull()
    expect(launch.notice).toContain('Форма відкривається з джерелом «Поточні документи GBA»')
    expect(launch.notice).not.toContain('«Збережені регістри 1С»')
  }
  const current = bug1274WorkbookRequest(defaultDatasetRequest(profitDayDataset, day, day), launches[0])
  expect(current).toMatchObject({ profitReadMode: 0, dayOrganizationBasis: 0,
    productClassification: { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
    sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
    sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
    workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } })
  expect(launches[0].notice).toContain(DAY_WORKBOOK_FILTERS_NOTICE)
  surface.only = false
  const [dayLaunchWithRegisters, supplierLaunchWithRegisters] = availableBug1274WorkbookLaunches([profitDayDataset, profitSupplierDataset])
  expect(dayLaunchWithRegisters.notice).toContain('«Збережені регістри 1С» і відбори Fenix')
  expect(supplierLaunchWithRegisters.notice).toContain('«Збережені регістри 1С»')
  surface.only = true
  const original = bug1274WorkbookRequest({ ...defaultDatasetRequest(profitDayDataset, day, day), profitReadMode: 1 }, launches[0])
  expect(original).toMatchObject({ profitReadMode: 1, dayOrganizationBasis: 0,
    sourceOrganizations: { OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
    workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } })
  expect(datasetConfigurationError(original, profitDayDataset)).toBeNull()
  for (const launch of launches.slice(2)) {
    const explicit = { ...defaultDatasetRequest(launch.dataset, day, day), ...(launch.dataset.DataSource === 40 ? { cashReadMode: 1 } : { settlementReadMode: 1 }) }
    expect(mode(bug1274WorkbookRequest(explicit, launch))).toBe(1)
  }
})

it('opens both gross-profit workbooks on the previous completed Kyiv day like the settlement and cash forms', () => {
  expect([35, 38, 40, 41].map(opensOnPreviousDay)).toEqual([true, true, true, true])
  expect([39, 1, 27, 30].map(opensOnPreviousDay)).toEqual([false, false, false, false])
})

it('states the 1C currency rule of both settlement workbooks instead of claiming currencies are never added', () => {
  const launches = availableBug1274WorkbookLaunches([settlementModeDataset])
  const all = launches.find(item => item.fileName === 'Взаємороз всі.xls')!
  const debt = launches.find(item => item.fileName === 'ДБіторка.xls')!
  expect(all.notice).toContain(SETTLEMENT_WORKBOOK_CURRENCY_NOTICE)
  expect(debt.notice).toContain(DEBTOR_WORKBOOK_CURRENCY_NOTICE)
  for (const launch of [all, debt]) expect(launch.notice).not.toContain('не додаються')
  expect(DEBTOR_WORKBOOK_CURRENCY_NOTICE).toContain('в один рядок без перерахунку')
  expect(SETTLEMENT_WORKBOOK_CURRENCY_NOTICE).toContain('розділено за валютою')
})
