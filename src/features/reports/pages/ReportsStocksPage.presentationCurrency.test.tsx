import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportsStocksPage } from './ReportsStocksPage'
import { createStockReport, previewStockReport, exportStockReportPreview } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getReportPresentationCurrencies } from '../api/reportPresentationCurrencies'
import { currencyDataset, currencySelection, resolvedCurrency } from '../data/reportPresentationCurrency.test-fixtures'
import { documentPreviewPayload } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { changeReportPeriod } from '../testing/reportPeriod'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'currency-workspace' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), previewStockReport: vi.fn(), exportStockReportPreview: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportPresentationCurrencies', () => ({ getReportPresentationCurrencies: vi.fn() }))
beforeEach(() => {
 vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
 Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
 vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...currencyDataset, profitReadModeLookup: true }])
 vi.mocked(getServerReportTemplates).mockResolvedValue([])
 vi.mocked(getReportPresentationCurrencies).mockResolvedValue([{ value: currencySelection.currencyNetUid, code: 'UAH', label: 'UAH — Гривня' }])
 const preview = normalizeNativeReportPreview({ Preview: { ...documentPreviewPayload([3,4], []), Request: { ...documentPreviewPayload([3,4], []).Request, presentationCurrency: resolvedCurrency } } })
 preview.ResultSession = { ResultId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
 vi.mocked(previewStockReport).mockResolvedValue({ preview, result: { document: {}, raw: {} } })
 vi.mocked(exportStockReportPreview).mockResolvedValue({ document: { DocumentURL: '/uah.xlsx' }, raw: {} })
})
it('selects currency through the real form, preserves dates/axes, blocks unsupported mode and exports only a retained preview', async () => {
 vi.mocked(getReportDatasets).mockResolvedValueOnce([...reportDatasets, { ...currencyDataset, profitReadModeLookup: true, Measurements: currencyDataset.Measurements.map(field => field.Type === 10 ? { ...field, Name: 'Валовий прибуток без ПДВ, EUR' } : field) }])
 const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
 await screen.findByRole('button', { name: 'Продажі за днями' })
 fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
 const selector = await screen.findByRole('combobox', { name: 'Валюта звіту' })
 expect(screen.getByRole('checkbox', { name: 'Валовий прибуток без ПДВ, EUR' })).toBeTruthy()
 fireEvent.click(selector)
 fireEvent.click(await screen.findByRole('option', { name: 'UAH — Гривня' }))
 const measures = screen.getByRole('heading', { name: 'Показники' }).closest('section')!
 expect(within(measures).queryByText(/EUR|Євро/)).toBeNull()
 expect(measures.querySelector('[aria-label*="EUR"], [title*="EUR"]')).toBeNull()
 expect(within(measures).getByRole('checkbox', { name: 'Валовий прибуток без ПДВ, у валюті звіту' })).toBeTruthy()
 changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
 fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' })); fireEvent.click(screen.getByRole('option', { name: 'Збережені регістри 1С' }))
 expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', true)
 expect(screen.getByRole('button', { name: 'Сформувати' }).getAttribute('title')).toContain('Валюта звіту доступна лише')
 expect(previewStockReport).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' })); fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
 await waitFor(() => expect(screen.getByRole('combobox', { name: 'Валюта звіту' })).toHaveProperty('value', 'UAH — Гривня'))
 await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
 await waitFor(() => expect(exportStockReportPreview).toHaveBeenCalledTimes(1))
 expect(createStockReport).not.toHaveBeenCalled()
 const request = vi.mocked(previewStockReport).mock.calls[0][0]
 expect(request.presentationCurrency).toEqual(currencySelection)
 expect(request.from).toBe('2026-10-17'); expect(request.to).toBe('2026-10-23')
 expect(request.sorted.Row.map(row => row.type)).toEqual([3,4])
 expect(request.sorted.Col).toEqual([])
 expect(request.sorted.Measurements.find(field => field.Type === 10)?.Label).toBe('Валовий прибуток без ПДВ, EUR')
})

it('refuses a file action when preview does not retain an export identity', async () => {
 const preview = normalizeNativeReportPreview({ Preview: { ...documentPreviewPayload([3,4], []), Request: { ...documentPreviewPayload([3,4], []).Request, presentationCurrency: resolvedCurrency } } })
 vi.mocked(previewStockReport).mockResolvedValueOnce({ preview, result: { document: {}, raw: {} } })
 const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
 await screen.findByRole('button', { name: 'Продажі за днями' })
 fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
 fireEvent.click(await screen.findByRole('combobox', { name: 'Валюта звіту' }))
 fireEvent.click(await screen.findByRole('option', { name: 'UAH — Гривня' }))
 changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
 await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
 await screen.findByText(/Сервер не підтвердив збережений результат/)
 expect(exportStockReportPreview).not.toHaveBeenCalled()
 expect(createStockReport).not.toHaveBeenCalled()
})
