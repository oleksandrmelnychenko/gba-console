import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { getSettlementPeriodAgreements } from '../api/settlementPeriodApi'
import { groupedSettlementDataset as dataset } from '../data/groupedSettlementPeriod.test-fixtures'
import { settlementPeriodAgreement, settlementPeriodRequest } from '../data/settlementPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
vi.mock('../api/settlementPeriodApi', () => ({ getSettlementPeriodAgreements: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getSettlementPeriodAgreements).mockResolvedValue([settlementPeriodAgreement])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
})

async function ready() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}

it('opens the debtor workbook directly with grouped current Buyers and no exact-agreement lookup', async () => {
  const { container } = await ready()
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Дебіторка за період' }))
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Поточні договори покупців')
  expect((screen.getByRole('combobox', { name: 'Форма взаєморозрахунків' }) as HTMLInputElement).value).toBe('Організація → контрагент')
  expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).checked).toBe(true)
  expect(getSettlementPeriodAgreements).not.toHaveBeenCalled()
  expect(screen.getAllByText(/Договори без повних даних за період залишаються з порожніми сумами/).length).toBeGreaterThan(0)
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const submitted = vi.mocked(createStockReport).mock.calls[0][0]
  expect(submitted.groupedSettlementPeriod).toEqual({ Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency' })
  expect(submitted.sorted.Row.map(field => field.type)).toEqual([4, 76])
  expect(submitted).not.toHaveProperty('settlementPeriod')
})

it.each([undefined, null])('keeps saved exact-agreement templates with grouped omission %s stable through submit/update', async grouped => {
  const data = settlementPeriodRequest()
  if (grouped === null) data.GroupedSettlementPeriod = null
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 2, Name: 'Exact saved settlement', Data: data }])
  const { container } = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Exact saved settlement/ }))
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Один точний договір')
  expect(screen.queryByRole('combobox', { name: 'База взаєморозрахунків' })).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const submitted = vi.mocked(createStockReport).mock.calls[0][0]
  expect(submitted.groupedSettlementPeriod).toBe(grouped)
  expect(submitted.settlementPeriod).toEqual(data.settlementPeriod)
  expect(submitted.sorted.Row.map(field => field.type)).toEqual([4, 41, 76, 77])
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(saved.groupedSettlementPeriod).toBe(grouped)
  expect(saved).not.toHaveProperty('GroupedSettlementPeriod')
  if (grouped === undefined) expect(saved).not.toHaveProperty('groupedSettlementPeriod')
})

it('invalidates stale XLSX/PDF links when the grouped workbook layout or source world changes', async () => {
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/grouped.xlsx', PdfDocumentURL: '/files/grouped.pdf' }, raw: {} })
  const { container } = await ready()
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: dataset.Name }))
  fireEvent.submit(container.querySelector('form')!)
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('combobox', { name: 'Форма взаєморозрахунків' }))
  fireEvent.click(screen.getByRole('option', { name: 'Організація → контрагент' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0].sorted.Row.map(field => field.type)).toEqual([4, 76])
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('combobox', { name: 'База взаєморозрахунків' }))
  fireEvent.click(screen.getByRole('option', { name: 'AMG' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
  const amg = vi.mocked(createStockReport).mock.calls[2][0]
  expect(amg.groupedSettlementPeriod).toMatchObject({ SourceWorld: 'Amg' })
  expect(amg).not.toHaveProperty('sourceBuyerSubtree')
})
