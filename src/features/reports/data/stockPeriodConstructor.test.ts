import { it, expect } from 'vitest'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, STOCK_PERIOD_CONSTRUCTOR_FILE } from './bug1274WorkbookLaunch'
import { defaultDatasetRequest, datasetConfigurationError } from './reportDatasets'
import type { ReportDataset } from '../types'

it('opens all twelve stock measures with warehouse, product and receipt rows', () => {
  const dataset: ReportDataset = {
    DataSource: 45, Name: 'Залишки', Description: '', PeriodRequired: true, PeriodSupported: true, Limitations: [],
    Groupings: [0,1,2,3,5,6,24,28,29,34].map(Type=>({Type,Name:String(Type)})),
    Measurements: Array.from({length:12},(_,i)=>({Type:97+i,Name:String(97+i)})),
    Filters: [0,1,2,19,20,21,23].map(Type=>({Type,Name:String(Type)})),
  }
  const [launch]=availableBug1274WorkbookLaunches([dataset])
  expect(launch.fileName).toBe(STOCK_PERIOD_CONSTRUCTOR_FILE)
  const request=bug1274WorkbookRequest(defaultDatasetRequest(dataset,'2026-10-01','2026-10-31'),launch)
  expect(request.sorted.Row.map(field=>field.type)).toEqual([29,5,24])
  expect(request.sorted.Col).toEqual([])
  expect(request.sorted.Measurements.map(field=>field.Type)).toEqual(Array.from({length:12},(_,i)=>97+i))
  expect(datasetConfigurationError(request,dataset)).toBeNull()
})
