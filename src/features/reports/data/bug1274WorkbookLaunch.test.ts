import { expect, it } from 'vitest'
import { cashPeriodDataset } from './cashPeriod.test-fixtures'
import { settlementPeriodDataset } from './settlementPeriod.test-fixtures'
import { availableBug1274WorkbookLaunches } from './bug1274WorkbookLaunch'

it('maps only the two bounded period workbook forms to exact live native capabilities', () => {
  const launches = availableBug1274WorkbookLaunches([cashPeriodDataset, settlementPeriodDataset])
  expect(launches.map(item => [item.fileName, item.dataset.DataSource])).toEqual([
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
})
