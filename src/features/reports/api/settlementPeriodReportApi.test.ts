import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { settlementPeriodDataset as dataset, settlementPeriodRequest as request, settlementPeriodScope as scope } from '../data/settlementPeriod.test-fixtures'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'
import { settlementPeriodConfigurationError as error } from '../data/settlementPeriod'
import { retainStoredTemplateFields } from '../data/reportTemplateDraft'
import { datasetPresetRequest, datasetPresets } from '../data/reportDatasets'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('accepts only the server advertised settlement capability and exact fixed axes', async () => {
  api.mockResolvedValue([dataset])
  await expect(getReportDatasets()).resolves.toEqual([dataset])
  for (const patch of [
    { settlementPeriod: undefined }, { DataSource: 40 }, { PeriodRequired: false },
    { Filters: [{ Type: 40, Name: 'Unexpected' }] },
    { Groupings: dataset.Groupings.slice(1) }, { Measurements: dataset.Measurements.slice(1) },
  ]) {
    api.mockResolvedValue([{ ...dataset, ...patch }])
    await expect(getReportDatasets()).rejects.toThrow('некоректний список')
  }
})

it.each([
  { ManagementCurrencySupported: true }, { CurrentDaySupported: true }, { AllCounterpartiesSupported: true },
  { NonDocumentAgreementsSupported: true }, { RequiresAgreementNetUid: false },
  { RequiresOneCompleteClosingDayGeneration: false }, { CurrencyBasis: 'ManagementCurrency' },
  { PeriodCalendar: 'UTC' }, { MaximumDays: 32 }, { SourceWorlds: [['Fenix'], 'Amg'] },
  { NativeFamilies: ['ClientAgreement', 'ClientAgreement'] },
])('refuses incompatible capabilities: %j', async patch => {
  api.mockResolvedValue([{ ...dataset, settlementPeriod: { ...dataset.settlementPeriod as object, ...patch } }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})

it('uses inclusive completed Kyiv calendar days, including DST days', () => {
  expect(error(request(), dataset, '2026-09-27')).toBeNull()
  expect(error({ ...request(), from: '2026-03-01', to: '2026-03-31' }, dataset, '2026-04-01')).toBeNull()
  expect(error({ ...request(), from: '2026-10-01', to: '2026-10-31' }, dataset, '2026-11-01')).toBeNull()
  expect(error({ ...request(), from: '2026-09-01', to: '2026-10-02' }, dataset, '2026-10-03')).toMatch(/31 день/)
  expect(error({ ...request(), to: '2026-09-27' }, dataset, '2026-09-27')).toMatch(/завершені/)
  expect(error({ ...request(), from: '2026-02-30' }, dataset, '2026-09-27')).toMatch(/коректний/)
  expect(error({ ...request(), from: '2026-09-13' }, dataset, '2026-09-27')).toMatch(/коректний/)
})

it.each([
  { AgreementId: Number(scope.AgreementId) }, { AgreementId: '01' }, { AgreementNetUid: '' },
  { SourceWorld: 1 }, { NativeFamily: 'Buyer' }, { CurrencyBasis: 'ManagementCurrency' },
  { OwnerId: '1' }, { SourceWorld: undefined },
])('rejects incomplete, inferred or extended exact scope before report/save requests: %j', async patch => {
  const invalid = { ...request(), settlementPeriod: { ...scope, ...patch } }
  await expect(createStockReport(invalid)).rejects.toThrow('точний договір')
  await expect(saveServerReportTemplate({ Name: 'Invalid', Data: invalid })).rejects.toThrow('точний договір')
  expect(api).not.toHaveBeenCalled()
})

it('rejects extra filters, FX, duplicate aliases and foreign dataset scope', async () => {
  for (const patch of [{ fxRate: 1 }, { SettlementPeriod: scope }, { cashPeriod: {} }, { currentBalance: true }]) {
    await expect(createStockReport({ ...request(), ...patch })).rejects.toThrow('недоступні')
  }
  expect(error({ ...request(), sorted: { ...request().sorted, Col: [{ type: 4, key: 'Organization', label: 'Wrong' }] } }, dataset, '2026-09-27')).toMatch(/фіксована/)
  expect(error({ ...request(), dataSource: 36 }, undefined, '2026-09-27')).toMatch(/лише/)
  await expect(searchDatasetReportValues(41, 77, { value: '', offset: 0, limit: 30 })).rejects.toThrow('точний довідник')
  expect(api).not.toHaveBeenCalled()
})

it('roundtrips every world/family and exact ID/NetUID through PascalCase saved templates', async () => {
  for (const SourceWorld of ['Fenix', 'Amg'] as const) for (const NativeFamily of ['ClientAgreement', 'SupplyOrganizationAgreement'] as const) {
    const selected = { ...scope, SourceWorld, NativeFamily }
    const data = { ...request(), settlementPeriod: selected }
    const wire = { Id: crypto.randomUUID(), Revision: 2, Name: 'Settlement period', Data: {
      DataSource: 41, From: data.from, To: data.to, Sorted: data.sorted, Selections: [], SettlementPeriod: selected,
    } }
    api.mockResolvedValue([wire])
    const [template] = await getServerReportTemplates()
    expect(template.Data).toEqual(data)
    api.mockResolvedValue(wire)
    await saveServerReportTemplate(template)
    expect(api).toHaveBeenLastCalledWith('/report/templates/save', {
      method: 'POST', body: { Id: wire.Id, Revision: 2, Name: wire.Name, Data: data },
    })
  }
})

it('retains duplicate stored aliases for rejection and never resurrects a cleared selection', async () => {
  api.mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Duplicate', Data: { DataSource: 41, From: request().from, To: request().to, Sorted: request().sorted, Selections: [], settlementPeriod: scope, SettlementPeriod: scope } }])
  const [template] = await getServerReportTemplates()
  expect(error(template.Data, dataset, '2026-09-27')).toMatch(/недоступні/)
  const merged = retainStoredTemplateFields(request(), { ...request(), settlementPeriod: undefined })
  expect(merged.settlementPeriod).toBeUndefined()
  expect(error(merged, dataset, '2026-09-27')).toMatch(/точний договір/)
  const preset = datasetPresetRequest(dataset, datasetPresets(dataset)[0].id, request())
  expect(preset?.Data.settlementPeriod).toEqual(scope)
})

it('requires own dataset attribution for preview and freezes caller scope before awaiting the server', async () => {
  const Preview = currentVparivaniePreview()
  Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts')
  Preview.Request.DataSource = 'NativeSettlementPeriod'
  let complete!: (value: unknown) => void
  api.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const data = { ...request(), settlementPeriod: { ...scope } }
  const pending = previewStockReport(data)
  data.settlementPeriod.AgreementNetUid = '87654321-1234-1234-1234-1234567890ab'
  complete({ Preview })
  await expect(pending).resolves.toMatchObject({ preview: { Request: { DataSource: 'NativeSettlementPeriod' } } })
  expect(api.mock.calls[0][1]?.body).toMatchObject({ settlementPeriod: scope })
  Preview.Request.DataSource = 'NativeAccountBalances'
  api.mockResolvedValue({ Preview })
  await expect(previewStockReport(request())).rejects.toThrow('інший набір')
})
