import { describe, it, expect } from 'vitest'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, PURCHASES_CONSTRUCTOR_FILE } from './bug1274WorkbookLaunch'
import { defaultDatasetRequest, datasetConfigurationError } from './reportDatasets'
import { BUG_1274_ACTIVE_DATA_SOURCES } from './reportMigration'
import type { ReportDataset } from '../types'

const dataset: ReportDataset = {
  DataSource: 3, Name: 'Закупи', Description: '', PeriodRequired: true, PeriodSupported: true, Limitations: [],
  Groupings: [0,1,2,3,4,5,6,7,8,21,24,25,28].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [0,2,3,96].map(Type => ({ Type, Name: String(Type) })),
  Filters: [0,1,2,17,18,19,20].map(Type => ({ Type, Name: String(Type) })),
}

describe('purchases constructor', () => {
  it('enables the live four-measure dataset and applies supplier/document rows with exact agreement columns', () => {
    const launches = availableBug1274WorkbookLaunches([dataset])
    expect(launches).toHaveLength(1)
    expect(launches[0].fileName).toBe(PURCHASES_CONSTRUCTOR_FILE)
    const request = bug1274WorkbookRequest(defaultDatasetRequest(dataset,'2026-10-01','2026-10-31'), launches[0])
    expect(request.sorted.Row.map(field => field.type)).toEqual([21,24])
    expect(request.sorted.Col.map(field => field.type)).toEqual([25])
    expect(request.sorted.Measurements.filter(field => field.IsChecked !== false).map(field => field.Type)).toEqual([0,2])
    expect(datasetConfigurationError(request,dataset)).toBeNull()
    expect(BUG_1274_ACTIVE_DATA_SOURCES.has(3)).toBe(true)
  })
  it('does not expose a stale deployment without VAT or mass', () => {
    expect(availableBug1274WorkbookLaunches([{ ...dataset, Measurements: dataset.Measurements.filter(field=>field.Type!==96) }])).toEqual([])
  })
})
