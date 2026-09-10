import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserTemplateImportId, useServerReportTemplates } from './useServerReportTemplates'
import { deleteServerReportTemplate, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { valuationDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { createSalesReportPreset } from '../data/reportPresets'
import { orderedAccountDataset, orderedAccountRequest } from '../data/reportOrdering.test-fixtures'

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

  it('retains a malformed local ordering without posting a sanitized template', async () => {
    const template = { Name: 'Невідоме сортування', Data: { ...orderedAccountRequest(), ordering: { Version: 2, Rows: [], Columns: [], Future: true } } }
    const raw = JSON.stringify([template])
    localStorage.setItem('app_configs_reports_template:v1', raw)
    const { result } = renderHook(() => useServerReportTemplates(true, [orderedAccountDataset]))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(() => result.current.importBrowserTemplate(template))
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
    expect(result.current.notice).toContain('правила сортування')
    expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
  })

  it('imports exact ordering and refuses a later save with its measure disabled', async () => {
    const template = { Name: 'Залишки за сумою', Data: orderedAccountRequest() }
    vi.mocked(saveServerReportTemplate).mockImplementation(async request => ({ ...request, Revision: 1 }))
    const { result } = renderHook(() => useServerReportTemplates(true, [orderedAccountDataset]))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(() => result.current.importBrowserTemplate(template))
    expect(saveServerReportTemplate).toHaveBeenCalledWith({ ...template, Id: await browserTemplateImportId(template), Revision: 0 })
    const disabled = { ...template.Data, sorted: { ...template.Data.sorted, Measurements: template.Data.sorted.Measurements.map(measure => ({ ...measure, IsChecked: false })) } }
    await act(() => result.current.save(template.Name, disabled))
    expect(saveServerReportTemplate).toHaveBeenCalledTimes(1)
    expect(result.current.notice).toContain('Правило збережено')
  })
  it('renames using the stored settings, preserving contract identity and complete unsupported inactive filters', async () => {
    const template = { Name: 'Договір 42', Id: crypto.randomUUID(), Revision: 7,
      Data: { ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: 456246,
        selections: [{ SelectedField: { Name: 'Future', Type: 999 }, FilterCondition: { Name: 'InGroup', Type: 6 },
          IsChecked: false, Values: [{ Name: 'exact', Value: 42, Data: { Id: 42, Future: ['retain'] } }] }] } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(saveServerReportTemplate).mockImplementation(async request => ({ ...request, Revision: 8 }))
    const { result } = renderHook(() => useServerReportTemplates(true, [valuationDataset]))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => { expect(await result.current.rename(template, '  Новий заголовок  ')).toMatchObject({ ok: true }) })
    expect(saveServerReportTemplate).toHaveBeenCalledWith({ ...template, Name: 'Новий заголовок' })
    expect(template.Name).toBe('Договір 42')
    expect(result.current.templates[0].Data).toEqual(template.Data)
  })

  it('copies stored data to an independent id and revision, including unknown nested settings', async () => {
    const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', []), Id: crypto.randomUUID(), Revision: 5 }
    const data = { ...template.Data, futureOptions: { value: false, full: [0, null, '42'] } }
    template.Data = data
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(saveServerReportTemplate).mockImplementation(async request => ({ ...request, Revision: 1 }))
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => { expect(await result.current.copy(template, 'Копія')).toMatchObject({ ok: true }) })
    const request = vi.mocked(saveServerReportTemplate).mock.calls[0][0]
    expect(request).toMatchObject({ Name: 'Копія', Revision: 0, Data: data })
    expect(request.Id).not.toBe(template.Id)
    expect(request.Data).not.toBe(template.Data)
    expect(result.current.templates.find(item => item.Id === template.Id)).toEqual(template)
  })

  it('rejects a stale opened revision after a reload rather than silently rebasing its draft', async () => {
    const template = { ...createSalesReportPreset('daily', '', '', []), Id: crypto.randomUUID(), Revision: 1 }
    vi.mocked(getServerReportTemplates).mockResolvedValueOnce([template]).mockResolvedValueOnce([{ ...template, Revision: 2 }])
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.templates[0].Revision).toBe(2))
    await act(async () => { expect(await result.current.update(template, template.Data)).toEqual({ ok: false }) })
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
    expect(result.current.notice).toContain('Відкрийте його знову')
    await act(async () => { expect(await result.current.remove(template.Id, template.Revision)).toEqual({ ok: false }) })
    expect(deleteServerReportTemplate).not.toHaveBeenCalled()
  })

  it('keeps the saved value and returns failure on an update conflict', async () => {
    const template = { ...createSalesReportPreset('daily', '', '', []), Id: crypto.randomUUID(), Revision: 3 }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(saveServerReportTemplate).mockRejectedValue(new Error('Шаблон змінився. Оновіть список.'))
    const { result } = renderHook(() => useServerReportTemplates(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => { expect(await result.current.update(template, { ...template.Data, from: '2026-09-01' })).toEqual({ ok: false }) })
    expect(saveServerReportTemplate).toHaveBeenCalledWith({ ...template, Data: { ...template.Data, from: '2026-09-01' } })
    expect(result.current.templates).toEqual([template])
  })

  it('keeps unsupported ordering intact when copy validation refuses it', async () => {
    const template = { Name: 'Future ordering', Id: crypto.randomUUID(), Revision: 3,
      Data: { ...orderedAccountRequest(), ordering: { Version: 2, Rows: [], Future: false } } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { result } = renderHook(() => useServerReportTemplates(true, [orderedAccountDataset]))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => { expect(await result.current.copy(template, 'Копія')).toEqual({ ok: false }) })
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
    expect(result.current.templates[0].Data.ordering).toEqual(template.Data.ordering)
  })

  it('serializes mutations and does not report success after permission is revoked', async () => {
    const template = { ...createSalesReportPreset('daily', '', '', []), Id: crypto.randomUUID(), Revision: 3 }
    let resolve!: (value: typeof template) => void
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    vi.mocked(saveServerReportTemplate).mockReturnValue(new Promise(done => { resolve = done }))
    const { result, rerender } = renderHook(({ enabled }) => useServerReportTemplates(enabled), { initialProps: { enabled: true } })
    await waitFor(() => expect(result.current.ready).toBe(true))
    let pending!: ReturnType<typeof result.current.rename>
    act(() => { pending = result.current.rename(template, 'Перейменовано') })
    await act(async () => { expect(await result.current.copy(template, 'Копія')).toEqual({ ok: false }) })
    expect(saveServerReportTemplate).toHaveBeenCalledTimes(1)
    rerender({ enabled: false })
    await act(async () => { resolve({ ...template, Revision: 4 }); expect(await pending).toEqual({ ok: false }) })
    expect(result.current.ready).toBe(false)
    expect(result.current.templates).toEqual([])
  })

})
