import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { useServerReportTemplates } from './useServerReportTemplates'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { customerCommonFieldsDataset as dataset } from '../data/customerGroupCommonFields.test-fixtures'
import type { ReportDataset, ReportEntity, ReportRequestBody, ReportTemplate } from '../types'

// Keep the hook and wire adapter real: only the HTTP transport is replaced.
vi.mock('../../../shared/api/apiClient', async importOriginal => ({
  ...await importOriginal<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn(),
}))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset(); localStorage.clear() })
function request(): ReportRequestBody {
  const data = defaultDatasetRequest(dataset, '2026-10-18', '2026-10-27')
  data.customerGroups = { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [71] }, { Name: 'Набір B', ClientIds: [72] }] }
  data.selections = [12, 14, 15, 16].map(Type => ({ IsChecked: true, SelectedField: { Type, Name: String(Type) },
    FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: '{"Id":"9007199254740993"}' as unknown as ReportEntity, Name: 'Збережений', Value: 0 }] }))
  data.selections.push({ IsChecked: true, SelectedField: { Type: 1, Name: 'Товар' }, FilterCondition: { Type: 3, Name: 'У групі зі списку' }, Values: [
    { Data: { kind: 'productGroup', id: '9223372036854775807' }, Name: 'Група', Value: 0 },
    { Data: { kind: 'product', id: '9007199254740993' }, Name: 'Товар', Value: 0 },
  ] })
  return data
}
function stubTransport() {
  let saved: unknown[] = []
  api.mockImplementation(async (path, options) => {
    if (path === '/report/templates') return saved
    if (path !== '/report/templates/save') throw new Error(`Unexpected transport ${path}`)
    const body = options?.body as ReportTemplate
    const wire = { Id: body.Id, Revision: (body.Revision ?? 0) + 1, Name: body.Name, UpdatedAtUtc: '2026-10-30T00:00:00Z',
      Data: { DataSource: 44, From: body.Data.from, To: body.Data.to, Sorted: body.Data.sorted,
        Selections: body.Data.selections, CustomerGroups: body.Data.customerGroups } }
    saved = [wire]; return wire
  })
}
it.each(['create', 'import', 'update', 'rename', 'copy'] as const)('passes source44 metadata through the real hook and adapter during %s', async operation => {
  stubTransport()
  const data = request(), before = structuredClone(data)
  const { result } = renderHook(() => useServerReportTemplates(true, [dataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => { expect(await result.current.save('Спільні відбори', data)).toMatchObject({ ok: true }) })
  expect(result.current.templates[0].Data).toMatchObject(before)
  if (operation !== 'create') {
    const template = result.current.templates[0]
    await act(async () => {
      const answer = operation === 'import' ? await result.current.importBrowserTemplate({ Name: 'Імпорт', Data: data })
        : operation === 'update' ? await result.current.update(template, data)
        : operation === 'rename' ? await result.current.rename(template, 'Перейменовано')
        : await result.current.copy(template, 'Копія')
      expect(answer).toMatchObject({ ok: true })
    })
  }
  const writes = api.mock.calls.filter(([path]) => path === '/report/templates/save')
  expect(writes).toHaveLength(operation === 'create' ? 1 : 2)
  expect((writes.at(-1)?.[1]?.body as ReportTemplate).Data).toEqual(before)
  expect(result.current.templates.at(-1)?.Data.selections).toEqual(before.selections)
  expect(data).toEqual(before)
})
it.each([undefined, { ...dataset, salesDocumentLookup: undefined }] as Array<ReportDataset | undefined>)('refuses active documents without capability and retains the draft when metadata is %j', async metadata => {
  stubTransport()
  const data = request(); data.selections = [data.selections[0]]
  const before = structuredClone(data)
  const { result } = renderHook(() => useServerReportTemplates(true, metadata ? [metadata] : []))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => { expect(await result.current.save('Не зберігати', data)).toEqual({ ok: false }) })
  expect(result.current.notice).toContain('не підтвердив довідник документів')
  expect(api.mock.calls.filter(([path]) => path === '/report/templates/save')).toHaveLength(0)
  expect(data).toEqual(before)
  data.selections[0].IsChecked = false
  await act(async () => { expect(await result.current.save('Неактивний відбір', data)).toMatchObject({ ok: true }) })
  expect(result.current.templates[0].Data.selections).toEqual(data.selections)
})
