import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserTemplateImportId, useServerReportTemplates } from './useServerReportTemplates'
import { deleteServerReportTemplate, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { valuationDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { createSalesReportPreset } from '../data/reportPresets'

vi.mock('../api/reportWorkspaceApi', () => ({
  getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(), deleteServerReportTemplate: vi.fn(),
}))

describe('server report templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
  })

  it('does not read or write templates without report permission', async () => {
    const { result } = renderHook(() => useServerReportTemplates(false))
    await act(() => result.current.save('test', createSalesReportPreset('agreements', '', '', []).Data))
    expect(getServerReportTemplates).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('preserves agreement filters and revision when updating a saved variant', async () => {
    const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', [{
      SelectedField: { Name: 'CustomerContract', Type: 9 }, FilterCondition: { Name: 'Equals', Type: 0 },
      IsChecked: true, Values: [{ Name: 'Договір №42', Value: 42, Data: { Id: 42 } }],
    }]), Id: crypto.randomUUID(), Revision: 4 }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(saveServerReportTemplate).mockResolvedValue({ ...template, Revision: 5 })
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(() => result.current.save(template.Name, template.Data, template.Id))
    expect(saveServerReportTemplate).toHaveBeenCalledWith(template)
    expect(result.current.templates[0].Revision).toBe(5)
    expect(result.current.templates[0].Data.selections[0].Values[0].Data.Id).toBe(42)
  })

  it('retains the current template and reports conflicts without retrying an overwrite', async () => {
    const template = { ...createSalesReportPreset('daily', '2026-09-01', '2026-09-07', []), Id: crypto.randomUUID(), Revision: 2 }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(deleteServerReportTemplate).mockRejectedValue(new Error('Шаблон змінився. Оновіть список.'))
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(() => result.current.remove(template.Id))
    expect(result.current.templates).toEqual([template])
    expect(result.current.notice).toContain('Шаблон змінився')
    expect(deleteServerReportTemplate).toHaveBeenCalledTimes(1)
  })

  it('imports explicitly without deleting local originals or dropping unsupported filters', async () => {
    const template = createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', [{
      SelectedField: { Name: 'CustomerContract', Type: 9 }, FilterCondition: { Name: 'InGroup', Type: 6 },
      IsChecked: true, Values: [{ Name: '42', Value: 42, Data: { Id: 42 } }],
    }])
    const raw = JSON.stringify([template])
    localStorage.setItem('app_configs_reports_template:v1', raw)
    vi.mocked(saveServerReportTemplate).mockRejectedValue(new Error('Умову не підтримано'))
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
    await act(() => result.current.importBrowserTemplate(template))
    expect(saveServerReportTemplate).toHaveBeenCalledWith({ ...template, Id: await browserTemplateImportId(template), Revision: 0 })
    expect(result.current.notice).toBe('Умову не підтримано')
    expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
  })

  it.each([undefined, 0])('refuses browser imports with absent or invalid valuation identity %s without altering local originals', async identity => {
    const template = { Name: 'Оцінка', Data: { ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: identity } }
    const raw = JSON.stringify([template])
    localStorage.setItem('app_configs_reports_template:v1', raw)
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(() => result.current.importBrowserTemplate(template))
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
    expect(result.current.notice).toContain('Виберіть точний договір')
    expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
  })

  it('imports the exact valuation scenario parameter with a distinct stable identity', async () => {
    const template = { Name: 'Оцінка', Data: { ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: 456246 } }
    vi.mocked(saveServerReportTemplate).mockImplementation(async request => ({ ...request, Revision: 1 }))
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(() => result.current.importBrowserTemplate(template))
    expect(saveServerReportTemplate).toHaveBeenCalledWith({ ...template, Id: await browserTemplateImportId(template), Revision: 0 })
    expect(await browserTemplateImportId(template)).not.toBe(await browserTemplateImportId({ ...template, Data: { ...template.Data, valuationClientAgreementId: 459018 } }))
  })

  it('uses stable import identities so a retried import cannot create another copy', async () => {
    const template = createSalesReportPreset('daily', '2026-09-01', '2026-09-07', [])
    expect(await browserTemplateImportId(template)).toBe(await browserTemplateImportId(structuredClone(template)))
    expect(await browserTemplateImportId(template)).not.toBe(await browserTemplateImportId({ ...template, Name: 'Інший' }))
  })
})
