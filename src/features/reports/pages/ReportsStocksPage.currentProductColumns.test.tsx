import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { productColumnsCapability, productColumnsDataset, productColumnsPreview, productColumnsRequest } from '../data/currentProductColumns.test-fixtures'
import { detailDataset, detailGrouping } from '../data/reportDocumentDetails.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
const dataset = { ...detailDataset, currentProductGroupLists: productColumnsDataset.currentProductGroupLists, currentProductColumns: productColumnsCapability }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: normalizeNativeReportPreview({ Preview: productColumnsPreview() }) })
})
afterEach(cleanup)
async function ready() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  fireEvent.click(screen.getByText('Додатково', { exact: true }))
  return view
}
it('keeps ordered new notes and deepest detail across date edits and blocks a missing product row without clearing groups', async () => {
  const view = await ready()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Детальні записи' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Нотатки (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити поле Нотатки (поточний товар) вище' }))
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-27' })
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ from: '2026-10-18', to: '2026-10-27', reportProfile: 'sales', workbookPresentation: { version: 4, additionalFields: [70, 66, 2], ordering: null } })
  expect(request.sorted.Row.map(row => row.type)).toEqual([4, 7, 84])
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Назва товару' }))
  expect(screen.getAllByText(/Додайте «Товар» або «Назва товару»/).length).toBeGreaterThan(0)
  expect(screen.getByRole('checkbox', { name: 'Нотатки (поточний товар)' })).toHaveProperty('checked', true)
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
})
it.each([2, 3, 4])('restores version%i saved current columns with the same bytes and period independent of current capability', async version => {
  const saved = productColumnsRequest(); saved.reportProfile = 'grossProfit'; saved.sorted.Row.push(detailGrouping)
  delete (saved as { workbookPresentation?: unknown }).workbookPresentation
  const selection = { Version: version, AdditionalFields: version === 4 ? [70, 66, 2] : version === 3 ? [67, 66, 2] : [66, 2], Ordering: null }
  const template = normalizeSavedTemplate({ Id: 'group-template', Revision: 1, Name: 'Групи з деталями', UpdatedAtUtc: '2026-10-29T00:00:00Z', Data: { DataSource: saved.dataSource, ReportProfile: saved.reportProfile, From: saved.from, To: saved.to, Sorted: saved.sorted, Selections: saved.selections, WorkbookPresentation: selection } })
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  const view = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Групи з деталями' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' })).toHaveProperty('checked', true))
  expect(screen.getByRole('checkbox', { name: 'Нотатки (поточний товар)' })).toHaveProperty('checked', version === 4)
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ reportProfile: 'grossProfit', from: '2026-09-01', workbookPresentation: selection })
})
it('does not offer new notes on the old v2 server', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([detailDataset])
  await ready()
  expect(screen.queryByRole('checkbox', { name: 'Нотатки (поточний товар)' })).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' })).toBeTruthy()
})

it('opens valid new-field templates on an old server for explicit repair while date changes preserve the unsupported selection', async()=>{
 vi.mocked(getReportDatasets).mockResolvedValue([detailDataset])
 const request=productColumnsRequest()
 const template=normalizeSavedTemplate({Id:'new-fields',Revision:1,Name:'Нові реквізити',UpdatedAtUtc:'2026-10-30T00:00:00Z',Data:{DataSource:2,ReportProfile:'sales',From:request.from,To:request.to,Sorted:request.sorted,Selections:[],WorkbookPresentation:{Version:4,AdditionalFields:[70,2],Ordering:null}}})
 vi.mocked(getServerReportTemplates).mockResolvedValue([template])
 const view=await ready();fireEvent.click(screen.getByRole('button',{name:'Шаблони'}))
 fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Нові реквізити'}))
 const comment=await screen.findByRole('checkbox',{name:'Нотатки (поточний товар)'})
 expect(comment).toHaveProperty('checked',true)
 changeReportPeriod({from:'2026-09-01',to:'2026-09-30'})
 expect(comment).toHaveProperty('checked',true)
 expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}))
 const dialog=screen.getByRole('dialog',{name:'Шаблони звіту'})
 expect(within(dialog).getByRole('button',{name:'Новий шаблон'})).toHaveProperty('disabled',true)
 expect(within(dialog).getByRole('button',{name:'Оновити шаблон'})).toHaveProperty('disabled',true)
 fireEvent.click(within(dialog).getByRole('button',{name:'Закрити'}))
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));expect(previewStockReport).not.toHaveBeenCalled()
 fireEvent.click(comment)
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce())
 expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({from:'2026-09-01',to:'2026-09-30',workbookPresentation:{version:2,additionalFields:[2],ordering:null}})
 expect(template.Data.WorkbookPresentation).toEqual({Version:4,AdditionalFields:[70,2],Ordering:null})
})
