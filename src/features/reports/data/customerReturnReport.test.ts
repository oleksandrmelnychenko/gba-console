import { describe, expect, it } from 'vitest'
import type { ReportDataset } from '../types'
import { CUSTOMER_RETURN_FILTERS, CUSTOMER_RETURN_WORKBOOK, supportsCustomerReturnReport } from './customerReturnReport'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { returnsOnlyFilterExpressionSupported, returnsOnlyFilterTypes } from './reportConfiguration'

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
  it('admits the widened return-line fields and І/АБО only when the server advertises them', () => {
    const widened = [0, 1, 2, 3, 4, 20, 6, 7, 8, 9, 10, 14, 21, 64]
    const withVariant = (filters: unknown): ReportDataset => ({ ...dataset,
      FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] },
      Groupings: [12, 5, 3, 0].map(Type => ({ Type, Name: String(Type) })),
      Filters: [...new Set([...widened, 11, 12, 15, 16])].map(Type => ({ Type, Name: String(Type) })),
      configuration: { version: 1, axisMode: 'flexible', allowedRows: [12, 5, 3, 0], allowedColumns: [12, 5, 3, 0], minimumRows: 1, maximumRows: 4,
        allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [], period: { required: true, supported: true, maximumDays: null, maximumMonths: null, minimumDate: null },
        variants: [{ key: 'returnsOnly', axisMode: 'fixedLayouts', allowedRows: [12, 5, 3], allowedColumns: [], minimumRows: 3, maximumRows: 3, rowLayouts: [[12, 5, 3]], columnLayouts: [[]], filters, maximumColumns: 0 }] } })
    const current = withVariant(widened)
    expect(returnsOnlyFilterTypes(current)).toEqual(widened)
    expect(returnsOnlyFilterExpressionSupported(current)).toBe(true)
    const request = bug1274WorkbookRequest(defaultDatasetRequest(current, '2026-10-01', '2026-10-31'), availableBug1274WorkbookLaunches([current])[0])
    const selection = (Type: number) => ({ IsChecked: true, SelectedField: { Type, Name: String(Type) }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Name: 'x', Data: { Id: 7 }, Value: 7 }] })
    for (const type of widened) expect(datasetConfigurationError({ ...request, selections: [selection(type)] }, current)).toBeNull()
    const grouped = { ...request, selections: [selection(0), selection(7)], filterExpression: { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } } }
    expect(datasetConfigurationError(grouped, current)).toBeNull()
    for (const type of [11, 12, 15, 16]) expect(datasetConfigurationError({ ...request, selections: [selection(type)] }, current)).not.toBeNull()
    expect(datasetConfigurationError({ ...request, selections: [{ ...selection(12), IsChecked: false }] }, current)).toBeNull()
    const previous = withVariant([...CUSTOMER_RETURN_FILTERS])
    expect(returnsOnlyFilterExpressionSupported(previous)).toBe(false)
    expect(datasetConfigurationError({ ...grouped, selections: [selection(6), selection(1)] }, previous)).toBe('Вибраний відбір недоступний у звіті повернення.')
    expect(datasetConfigurationError({ ...request, selections: [selection(9)] }, previous)).not.toBeNull()
    expect(returnsOnlyFilterTypes(withVariant([6, 1, 'x']))).toEqual(CUSTOMER_RETURN_FILTERS)
    expect(returnsOnlyFilterTypes(withVariant([0, 3]))).toEqual(CUSTOMER_RETURN_FILTERS)
    expect(returnsOnlyFilterTypes(dataset)).toEqual(CUSTOMER_RETURN_FILTERS)
  })
})
