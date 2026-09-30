import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ownPriceAnalysisDataset } from '../data/ownPriceAnalysis.test-fixtures'
import type { ReportDataset } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const source: ReportDataset = {
  DataSource: 23, Name: '1С: Аналіз знижок і націнок номенклатури', Description: 'Локальні зрізи',
  Groupings: [57, 55, 53].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [{ Type: 64, Name: 'Відсоток знижки' }],
  Filters: [{ Type: 45, Name: 'Договір 1С' }], Limitations: [],
  PeriodRequired: false, PeriodSupported: false,
  discountMarkup: { Version: 1, SourceWorlds: [1, 2] },
}
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, source])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '0xA0000000000000000000000000000001', Name: 'Договір 1С' }])
})

it('edits and submits the server-supported OUR-rate analysis without a period', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ownPriceAnalysisDataset])
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: ownPriceAnalysisDataset.Name }))
  const input = screen.getByLabelText('Дата аналізу цін')
  expect(input).not.toHaveProperty('disabled', true)
  expect(screen.queryByText(/Налаштування мають невідому версію/)).toBeNull()
  expect(screen.getByText(/курси нашої бази на дату звіту/)).toBeTruthy()
  fireEvent.change(input, { target: { value: '2026-09-21' } })
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
    dataSource: 28, from: '', to: '', priceAnalysis: { Version: 2, SourceWorld: 1, AsOf: '2026-09-21' },
  })
})

it('passes the selected AMG world to the exact source lookup and report request', async () => {
  const user = userEvent.setup()
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: source.Name }))
  fireEvent.click(screen.getByRole('combobox', { name: 'База джерела 1С' }))
  fireEvent.click(await screen.findByRole('option', { name: 'AMG' }))
  fireEvent.change(screen.getByLabelText('Дата стану знижок'), { target: { value: '2026-09-21' } })
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Договір 1С' }))
  await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), 'дог')
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(23, 45,
    { limit: 30, offset: 0, value: 'дог' }, expect.any(AbortSignal), 2))
  fireEvent.click(await screen.findByRole('option', { name: 'Договір 1С' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
    dataSource: 23, from: '', to: '', discountMarkup: { Version: 1, SourceWorld: 2, DateEnd: '2026-09-21' },
    selections: [{ SelectedField: { Type: 45 }, Values: [{ Value: 0, Data: { Id: '0xA0000000000000000000000000000001' } }] }],
  })
})
