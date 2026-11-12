import fixture from '../data/constructorDatasets.dev-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { NATIVE_PRICE_COMPARISON_WORKBOOK } from '../data/nativePriceComparison'
import { workbookDisplayFileName } from '../data/bug1274WorkbookGuide'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const warning = 'Оберіть тип ціни для порівняння.'
const hint = 'Оберіть тип ціни для порівняння, щоб сформувати звіт.'
const prices = [{ Id: '844', Name: 'ЦЗ' }, { Id: '846', Name: 'ЦЗ (Фіксована націнка)' },
  { Id: '852', Name: 'ЦО1' }, { Id: '847', Name: 'ЦО1 (НДС)' }, { Id: '849', Name: 'ЦО2' },
  { Id: '845', Name: 'ЦО2 (НДС)' }, { Id: '853', Name: 'ЦР' }, { Id: '848', Name: 'ЦР (НДС)' }]

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(fixture))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue(prices)
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})
afterEach(cleanup)

async function openReport() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: `Відкрити ${workbookDisplayFileName(NATIVE_PRICE_COMPARISON_WORKBOOK)}` }))
  await screen.findByRole('combobox', { name: 'Тип ціни для порівняння' })
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(46, 46, { value: '', offset: 0, limit: 30 }, expect.any(AbortSignal)))
  return view
}

async function selectPrice() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Тип ціни для порівняння' }))
  expect(await screen.findAllByRole('option')).toHaveLength(8)
  fireEvent.click(screen.getByRole('option', { name: 'ЦЗ' }))
}

function expectBlocked() {
  for (const button of screen.getAllByRole('button', { name: /^Сформувати(?: Excel| PDF)?$/ }))
    expect(button).toHaveProperty('disabled', true)
}

it('does not warn before the empty price selector changes and still blocks generation', async () => {
  const view = await openReport()
  expect(screen.queryByText(warning)).toBeNull()
  expectBlocked()
  fireEvent.submit(view.container.querySelector('form.workbook-desk__form')!)
  expect(previewStockReport).not.toHaveBeenCalled()
})

it('enables generation with the exact native price ID from the DEV catalogue', async () => {
  const view = await openReport()
  await selectPrice()
  expect(screen.queryByText(warning)).toBeNull()
  for (const button of screen.getAllByRole('button', { name: 'Сформувати' }))
    expect(button).toHaveProperty('disabled', false)
  fireEvent.submit(view.container.querySelector('form.workbook-desk__form')!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 46, nativePriceComparison: { Version: 2, PricingId: '844' } })
})

it('warns after clearing a selection and returns to pristine validation after reset', async () => {
  const view = await openReport()
  await selectPrice()
  const input = screen.getByRole('combobox', { name: 'Тип ціни для порівняння' })
  fireEvent.click(input.closest('.mantine-Select-wrapper')!.querySelector('button')!)
  expect(await screen.findByText(warning)).toBeTruthy()
  expectBlocked()
  fireEvent.submit(view.container.querySelector('form.workbook-desk__form')!)
  expect(previewStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  await waitFor(() => expect(screen.queryByText(warning)).toBeNull())
  expectBlocked()
})

it('keeps catalogue loading failures visible before a price has been selected', async () => {
  vi.mocked(searchDatasetReportValues).mockRejectedValue(new Error('Unavailable'))
  await openReport()
  expect(await screen.findByText('Не вдалося завантажити типи цін GBA.')).toBeTruthy()
  expectBlocked()
})

it('explains the inactive button with a neutral hint before the first touch and drops it once a price is chosen', async () => {
  await openReport()
  expect(screen.getByText(hint).className).toContain('mantine-Select-description')
  expect(screen.queryByText(warning)).toBeNull()
  expectBlocked()
  await selectPrice()
  await waitFor(() => expect(screen.queryByText(hint)).toBeNull())
  const input = screen.getByRole('combobox', { name: 'Тип ціни для порівняння' })
  fireEvent.click(input.closest('.mantine-Select-wrapper')!.querySelector('button')!)
  expect(await screen.findByText(warning)).toBeTruthy()
  expect(screen.getByText(hint)).toBeTruthy()
})

it('names the missing price type next to the changed-settings notice instead of asking to apply the set', async () => {
  await openReport()
  changeReportPeriod({ from: '2026-09-02' })
  expect((await screen.findByText(`Налаштування змінено. Звіт поки не можна сформувати: ${warning}`)).closest('[role=status]')).toBeTruthy()
  expect(screen.queryByText(/Застосуйте весь набір/)).toBeNull()
  expect(screen.getByRole('combobox', { name: 'Тип ціни для порівняння' }).getAttribute('aria-invalid')).toBe('true')
  expectBlocked()
  expect(screen.getByRole('button', { name: 'Скасувати зміни' })).toHaveProperty('disabled', false)
})

it('lets a changed valid set be formed and exported straight away', async () => {
  await openReport()
  changeReportPeriod({ from: '2026-09-02' })
  await selectPrice()
  const notice = await screen.findByText('Налаштування змінено. Натисніть «Сформувати», щоб оновити звіт.')
  expect(notice).toBeTruthy()
  expect(screen.getByRole('combobox', { name: 'Тип ціни для порівняння' }).getAttribute('aria-invalid')).not.toBe('true')
  for (const button of screen.getAllByRole('button', { name: /^Сформувати(?: Excel| PDF)?$/ }))
    expect(button).toHaveProperty('disabled', false)
})
