import { describe, expect, it } from 'vitest'
import type { ReportDataset } from '../types'
import { CUSTOMER_RETURN_FILTERS, CUSTOMER_RETURN_WORKBOOK, supportsCustomerReturnReport } from './customerReturnReport'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'

const dataset: ReportDataset = { DataSource: 2, Name: 'Продажі мінус повернення', Description: '',
  productClassification: { Version: 1, SourceWorld: 0, RequiresIsService: true, RequiresProductKindId: true, ProductKindIdFormat: '32 hexadecimal characters (16 bytes)' },
  sourceOrganizations: { Version: 1, SourceWorlds: ['fenix'], MaximumOrganizationIds: 64, OrganizationIdFormat: '32 hexadecimal characters (16 bytes)', RequiresDurableNativeBinding: true, RequiresCompleteFactLineage: true },
  PeriodRequired: true, PeriodSupported: true, returnsOnly: true, customerReturnFilters: true,
  Groupings: [12, 5, 3].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [{ Type: 0, Name: 'Кількість' }],
  Filters: CUSTOMER_RETURN_FILTERS.map(Type => ({ Type, Name: String(Type) })), Limitations: [] }

describe('customer return workbook', () => {
  it('opens exact returns, not sales or the two-period comparison', () => {
    const launch = availableBug1274WorkbookLaunches([dataset])[0]
    expect(launch.fileName).toBe(CUSTOMER_RETURN_WORKBOOK)
    const request = bug1274WorkbookRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-10-31'), launch)
    expect(request.returnsOnly).toBe(true)
    expect(request.dataSource).toBe(2)
    expect(request.sorted.Row.map(item => item.type)).toEqual([12, 5, 3])
    expect(request.sorted.Col).toEqual([])
    expect(datasetConfigurationError(request, dataset)).toBeNull()
    request.selections = [{ IsChecked: true, SelectedField: { Type: 64, Name: 'Причина' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Name: 'Брак', Data: { Id: 7, Name: 'Брак' }, Value: 7 }] }]
    expect(datasetConfigurationError(request, dataset)).toBeNull()
    expect(datasetConfigurationError(request, { ...dataset, customerReturnFilters: undefined })).not.toBeNull()
  })
  it('withholds unsupported or incomplete server capabilities', () => {
    expect(supportsCustomerReturnReport({ ...dataset, customerReturnFilters: undefined })).toBe(false)
    expect(supportsCustomerReturnReport({ ...dataset, Filters: dataset.Filters.filter(field => field.Type !== 64) })).toBe(false)
    expect(availableBug1274WorkbookLaunches([{ ...dataset, returnsOnly: false }])).toEqual([])
  })
})
