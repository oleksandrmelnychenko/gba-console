import { expect, it } from 'vitest'
import { profitDayDataset, profitSupplierDataset } from './profitReadMode.test-fixtures'
import { cashModeDataset } from './cashReadMode.test-fixtures'
import { settlementModeDataset } from './settlementReadMode.test-fixtures'
import { currentVparivanieDataset, exactSelection } from './currentVparivanie.test-fixtures'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { validateStockReportRequest } from '../api/reportsApi'
import { requestNumberPresentation } from './reportNumberPresentation'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
const numberPresentation = { version: 1, moneyScale: 1000, decimalPlacesByKind: { money: 3, quantity: 2 } }
const capability = { version: 1, moneyScales: [1, 1000, 1000000], minimumDecimalPlaces: 0, maximumDecimalPlaces: 6 }
it.each([profitDayDataset, profitSupplierDataset, currentVparivanieDataset, cashModeDataset, settlementModeDataset])('accepts display-only numbers without weakening source$DataSource financial shape validation', source => {
 const dataset = { ...source, numberPresentation: capability }
 const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-21')
 if (source.DataSource === 39) request.selections = [exactSelection(1)]
 expect(datasetConfigurationError(request, dataset)).toBeNull()
 const configured = { ...request, numberPresentation }
 expect(datasetConfigurationError(configured, dataset)).toBeNull()
 expect(() => validateStockReportRequest(configured, dataset)).not.toThrow()
 expect(datasetConfigurationError({ ...configured, numberPresentation: { ...numberPresentation, version: 2 } }, dataset)).toMatch(/Непідтримуваний/)
})
it('round trips optional precision and supplier warehouse from PascalCase saved templates without injecting defaults into legacy requests', () => {
 const data = defaultDatasetRequest(profitSupplierDataset, '2026-09-01', '2026-09-21')
 const wire = { Id: '10000000-0000-4000-8000-000000000001', Revision: 1, UpdatedAtUtc: "2026-10-21T12:00:00Z", Name: 'Шаблон', Data: { DataSource: 38, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections } }
 expect(normalizeSavedTemplate(wire).Data).not.toHaveProperty('numberPresentation')
 const template = normalizeSavedTemplate({ ...wire, Data: { ...wire.Data, NumberPresentation: numberPresentation, SupplierWarehouse: 78 } } as Parameters<typeof normalizeSavedTemplate>[0])
 expect(requestNumberPresentation(template.Data)).toEqual(numberPresentation)
 expect(template.Data.supplierWarehouse).toBe(78)
})
