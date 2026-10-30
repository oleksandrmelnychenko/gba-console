import { returnStatusDataset } from '../data/returnItemStatuses.test-fixtures'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { grossDataset, netDataset } from '../data/reportDatasets.test-fixtures'
import { customerReturnRequest } from '../data/customerReturnReport'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...netDataset, reportProfiles: ['sales', 'grossProfit'], constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] }, Groupings: grossDataset.Groupings }])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null, Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
})
afterEach(cleanup)

it('repairs manual text explicitly, selects enum zero, and keeps typed data through dates and Generate', async () => {
 const data=customerReturnRequest(defaultDatasetRequest(returnStatusDataset,'2026-10-01','2026-10-27'),returnStatusDataset)
 data.selections=[{IsChecked:true,SelectedField:{Type:64,Name:'Причина повернення'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[{Data:{Name:'БРАК'},Name:'БРАК',Value:0}]}]
 vi.mocked(getReportDatasets).mockResolvedValue([returnStatusDataset])
 vi.mocked(getServerReportTemplates).mockResolvedValue([{Id:crypto.randomUUID(),Revision:1,Name:'Старий текст',Data:data}])
 const {container}=render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
 await screen.findByRole('button',{name:/Відкрити Звіт повернення/})
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Старий текст'}))
 expect(screen.getAllByText(/Довільний текст не є значенням причини/).length).toBeGreaterThan(0)
 await act(async()=>fireEvent.submit(container.querySelector('form')!));expect(previewStockReport).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Очистити причини'}))
 fireEvent.click(screen.getByRole('combobox',{name:'Причина повернення'}));fireEvent.click(await screen.findByRole('option',{name:'Причина 0'}))
 changeReportPeriod({from:'2026-09-01',to:'2026-09-30'})
 await act(async()=>fireEvent.submit(container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce())
 expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({dataSource:2,returnsOnly:true,from:'2026-09-01',selections:[{Values:[{Data:{ReturnItemStatus:0},Name:'Причина 0',Value:0}]}]})
 expect(searchDatasetReportValues).not.toHaveBeenCalled()
})
it('keeps typed saved values on an old server visible and blocks Generate until the condition is disabled', async()=>{
 const data=customerReturnRequest(defaultDatasetRequest(returnStatusDataset,'2026-10-01','2026-10-27'),returnStatusDataset)
 data.selections=[{IsChecked:true,SelectedField:{Type:64,Name:'Причина повернення'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[{Data:{ReturnItemStatus:6},Name:'Брак',Value:0}]}]
 vi.mocked(getReportDatasets).mockResolvedValue([{...returnStatusDataset,returnItemStatuses:undefined}])
 vi.mocked(getServerReportTemplates).mockResolvedValue([{Id:crypto.randomUUID(),Revision:1,Name:'Новий тип',Data:data}])
 const {container}=render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
 await screen.findByRole('button',{name:/Відкрити Звіт повернення/});fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Новий тип'}))
 await act(async()=>fireEvent.submit(container.querySelector('form')!));expect(previewStockReport).not.toHaveBeenCalled()
 expect(screen.getAllByText(/Сервер не підтримує вибрані причини/).length).toBeGreaterThan(0)
 fireEvent.click(screen.getByRole('checkbox',{name:'Увімкнути умову 1'}))
 await act(async()=>fireEvent.submit(container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce())
 expect(vi.mocked(previewStockReport).mock.calls[0][0].selections).toEqual([])
 expect(screen.getByText(/Збережені причини: Брак/)).toBeTruthy()
 fireEvent.click(screen.getByRole('checkbox',{name:'Увімкнути умову 1'}))
 await act(async()=>fireEvent.submit(container.querySelector('form')!));expect(previewStockReport).toHaveBeenCalledOnce()
 expect(screen.getAllByText(/Сервер не підтримує вибрані причини/).length).toBeGreaterThan(0)
})
