import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeSavedTemplate, saveServerReportTemplate } from './reportWorkspaceApi'
import { customerCommonFieldsDataset as dataset } from '../data/customerGroupCommonFields.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportEntity, ReportTemplate } from '../types'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
it('round-trips raw legacy author/document IDs and typed mixed Product groups through the actual template wire adapter', async () => {
  const Data = defaultDatasetRequest(dataset, '2026-10-18', '2026-10-27')
  Data.customerGroups = { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [71] }, { Name: 'Набір B', ClientIds: [72] }] }
  Data.selections = [12, 14, 15, 16].map(Type => ({ IsChecked: true, SelectedField: { Type, Name: String(Type) }, FilterCondition: { Type: 2, Name: 'У списку' },
    Values: [{ Data: '{"Id":"9007199254740993"}' as unknown as ReportEntity, Name: 'Стара назва', Value: 0 }] }))
  Data.selections.push({ IsChecked: true, SelectedField: { Type: 1, Name: 'Товар' }, FilterCondition: { Type: 3, Name: 'У групі зі списку' }, Values: [
    { Data: { kind: 'productGroup', id: '9223372036854775807' }, Name: 'Група', Value: 0 }, { Data: { kind: 'product', id: '9007199254740993' }, Name: 'Товар', Value: 0 },
  ] })
  const template: ReportTemplate = { Name: 'Спільні відбори', Data }, original = structuredClone(template)
  api.mockImplementation(async (_path, options) => {
    const body = options?.body as ReportTemplate
    return { Id: 'template', Revision: 1, UpdatedAtUtc: '2026-10-30T00:00:00Z', Name: body.Name,
      Data: { DataSource: body.Data.dataSource, From: body.Data.from, To: body.Data.to, Sorted: body.Data.sorted, Selections: body.Data.selections, CustomerGroups: body.Data.customerGroups } }
  })
  const saved = await saveServerReportTemplate(template, undefined, dataset)
  expect(saved.Data.selections).toEqual(original.Data.selections); expect(template).toEqual(original)
  expect(api).toHaveBeenCalledOnce()
  const wire = { Id: 'template', Revision: 1, UpdatedAtUtc: '2026-10-30T00:00:00Z', Name: saved.Name, Data: { DataSource: 44, From: Data.from, To: Data.to, Sorted: Data.sorted, Selections: Data.selections, CustomerGroups: Data.customerGroups } }
  expect(normalizeSavedTemplate(wire).Data.selections).toEqual(original.Data.selections)
})
it.each([12, 14, 15, 16])('blocks field%d invalid single cardinality before any save request', async Type => {
  const Data = defaultDatasetRequest(dataset, '2026-10-18', '2026-10-27')
  Data.selections = [{ IsChecked: true, SelectedField: { Type, Name: 'Документ або автор' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
    Values: [{ Data: { Id: '10' }, Name: 'A', Value: 0 }, { Data: { Id: '20' }, Name: 'B', Value: 0 }] }]
  await expect(saveServerReportTemplate({ Name: 'Не зберігати', Data }, undefined, dataset)).rejects.toThrow('одне значення')
  expect(api).not.toHaveBeenCalled()
})
