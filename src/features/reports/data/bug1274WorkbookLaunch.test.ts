import { expect, it } from 'vitest'
import { cashPeriodDataset } from './cashPeriod.test-fixtures'
import { settlementPeriodDataset } from './settlementPeriod.test-fixtures'
import { currentVparivanieDataset } from './currentVparivanie.test-fixtures'
import { availableBug1274WorkbookLaunches } from './bug1274WorkbookLaunch'
import type { ReportDataset } from '../types'

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
