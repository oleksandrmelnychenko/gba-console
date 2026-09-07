import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createSalesReportPreset } from '../data/reportPresets'
import { reportDatasets, stockDataset, currentStockDatasets, valuationDataset, nativeDocumentDatasets, currentDebtDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { accountBalanceDataset, accountBalanceSelections } from '../data/accountBalances.test-fixtures'
import { catalogueFixture } from '../data/reportMigration.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

describe('report workspace wire contract', () => {
  it('loads exact per-world migration metadata without changing the source inventory or cancellation', async () => {
    const controller = new AbortController(), catalogue = catalogueFixture()
    vi.mocked(apiRequest).mockResolvedValue(catalogue)
    await expect(getReportCatalogue(controller.signal)).resolves.toEqual(catalogue)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/catalogue', { signal: controller.signal })
  })

  it('preserves an old catalogue without fabricating migration metadata', async () => {
    const catalogue = { ...catalogueFixture(), Migration: undefined }
    vi.mocked(apiRequest).mockResolvedValue(catalogue)
    await expect(getReportCatalogue()).resolves.toEqual(catalogue)
  })

  it('rejects duplicate exact implementation identities instead of dropping source rows', async () => {
    const catalogue = catalogueFixture()
    catalogue.Reports[0].Sources.push(catalogue.Reports[0].Sources[0])
    vi.mocked(apiRequest).mockResolvedValue(catalogue)
    await expect(getReportCatalogue()).rejects.toThrow('некоректний каталог джерельних звітів')
  })

  it('loads native capabilities and passes cancellation to the authenticated request', async () => {
    const controller = new AbortController()
    vi.mocked(apiRequest).mockResolvedValue(reportDatasets)
    await expect(getReportDatasets(controller.signal)).resolves.toEqual(reportDatasets)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/datasets', { signal: controller.signal })
  })

  it.each([
    [],
    [reportDatasets[0], reportDatasets[0]],
    [{ ...reportDatasets[0], DataSource: 1 }],
    [{ ...reportDatasets[0], Measurements: [{ Type: '0', Name: 'Кількість' }] }],
    [{ ...reportDatasets[0], Measurements: [{ Type: 0, Name: 'Кількість', Selectable: 'false' }] }],
    [{ ...stockDataset, PeriodSupported: 'false' }],
    [{ ...stockDataset, PeriodRequired: true }],
    [{ ...currentDebtDataset, PeriodSupported: true }],
    [{ ...currentDebtDataset, PeriodSupported: undefined }],
    [{ ...accountBalanceDataset, PeriodSupported: true }],
    [{ ...accountBalanceDataset, PeriodSupported: undefined }],
  ].map(value => ({ value })))('rejects malformed or retired dataset catalogues %#', async ({ value }) => {
    vi.mocked(apiRequest).mockResolvedValue(value)
    await expect(getReportDatasets()).rejects.toThrow('некоректний список наборів даних')
  })

  it.each(currentStockDatasets)('retains no-period capability and null wire dates in current source $DataSource templates', async dataset => {
    vi.mocked(apiRequest).mockResolvedValue([...reportDatasets, ...currentStockDatasets])
    expect((await getReportDatasets()).find(item => item.DataSource === dataset.DataSource)?.PeriodSupported).toBe(false)
    const data = defaultDatasetRequest(dataset, '', '')
    data.selections = [{ IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Data: { Id: 42 }, Name: 'Договір', Value: 42 }] }]
    vi.mocked(apiRequest).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Залишки',
      Data: { DataSource: dataset.DataSource, From: null, To: null, Sorted: data.sorted, Selections: data.selections } }])
    expect((await getServerReportTemplates())[0].Data).toEqual(data)
  })

  it.each(currentStockDatasets)('refuses missing or historical period semantics for current source $DataSource', async dataset => {
    for (const PeriodSupported of [undefined, true]) {
      vi.mocked(apiRequest).mockResolvedValue([{ ...dataset, PeriodSupported }])
      await expect(getReportDatasets()).rejects.toThrow('некоректний список наборів даних')
    }
  })

  it('preserves the separate exact valuation agreement through wire template load and save', async () => {
    vi.mocked(apiRequest).mockResolvedValue([valuationDataset])
    await expect(getReportDatasets()).resolves.toEqual([valuationDataset])
    const data = { ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: 459018 }
    const wire = { Id: crypto.randomUUID(), Revision: 2, Name: 'Оцінка', Data: { DataSource: 8, From: null, To: null, Sorted: data.sorted, Selections: [], ValuationClientAgreementId: 459018 } }
    vi.mocked(apiRequest).mockResolvedValue([wire])
    const [template] = await getServerReportTemplates()
    expect(template.Data).toEqual(data)
    vi.mocked(apiRequest).mockResolvedValue(wire)
    await saveServerReportTemplate(template)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: { Id: wire.Id, Revision: 2, Name: 'Оцінка', Data: data } })
  })

  it('normalizes .NET names while retaining agreement identities and disabled selections', async () => {
    const preset = createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', [{
      IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'Equals', Type: 0 }, Values: [{ Name: '42', Value: 42, Data: { Id: 42 } }],
    }])
    const wire = { Id: crypto.randomUUID(), Revision: 2, Name: preset.Name, UpdatedAtUtc: '2026-09-07T13:00:00Z', Data: {
      From: preset.Data.from, To: preset.Data.to, Sorted: preset.Data.sorted, Selections: preset.Data.selections, DataSource: 0,
    } }
    vi.mocked(apiRequest).mockResolvedValue([wire])
    const [template] = await getServerReportTemplates()
    expect(template.Data).toEqual({ ...preset.Data, dataSource: 0 })
    vi.mocked(apiRequest).mockResolvedValue({ ...wire, Revision: 3 })
    await saveServerReportTemplate(template)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: {
      Id: wire.Id, Revision: 2, Name: wire.Name, Data: template.Data,
    } })
  })
  it.each(nativeDocumentDatasets)('preserves source $DataSource capability, exact filters and dates through template wire save/load',async dataset=>{
    vi.mocked(apiRequest).mockResolvedValue([dataset]);await expect(getReportDatasets()).resolves.toEqual([dataset])
    const data=defaultDatasetRequest(dataset,'2026-06-01','2026-06-30')
    data.selections=[{IsChecked:true,SelectedField:{Name:dataset.DataSource===9?'SupplierReturnDocument':'CustomerContract',Type:dataset.DataSource===9?24:9},FilterCondition:{Name:'Дорівнює',Type:0},Values:[{Data:{Id:42},Name:'42',Value:42}]}]
    const wire={Id:crypto.randomUUID(),Revision:1,Name:'Мій документний звіт',Data:{DataSource:dataset.DataSource,From:data.from||null,To:data.to||null,Sorted:data.sorted,Selections:data.selections}}
    vi.mocked(apiRequest).mockResolvedValue([wire]);const [template]=await getServerReportTemplates();expect(template.Data).toEqual(data)
    vi.mocked(apiRequest).mockResolvedValue({...wire,Revision:2});await saveServerReportTemplate(template)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save',{method:'POST',body:{Id:wire.Id,Revision:1,Name:wire.Name,Data:data}})
  })

  it('preserves source11 exact payment fields and disabled contract through private template wire load/save', async () => {
    vi.mocked(apiRequest).mockResolvedValue([accountBalanceDataset])
    await expect(getReportDatasets()).resolves.toEqual([accountBalanceDataset])
    const data = { ...defaultDatasetRequest(accountBalanceDataset, '', ''), selections: structuredClone(accountBalanceSelections) }
    const wire = { Id: crypto.randomUUID(), Revision: 2, Name: 'Мої рахунки', Data: { DataSource: 11, From: null, To: null, Sorted: data.sorted, Selections: data.selections } }
    vi.mocked(apiRequest).mockResolvedValue([wire]); const [template] = await getServerReportTemplates()
    expect(template.Data).toEqual(data)
    vi.mocked(apiRequest).mockResolvedValue({ ...wire, Revision: 3 }); await saveServerReportTemplate(template)
    expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: { Id: wire.Id, Revision: 2, Name: wire.Name, Data: data } })
  })

})
