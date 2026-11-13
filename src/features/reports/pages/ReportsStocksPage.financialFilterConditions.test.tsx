import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { financialFilterCapability } from '../data/currentFinancialFilterConditions.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
import { findOpenedWorkbook } from '../testing/workbookDesk'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'financial-filter-test' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '9007199254740993', Name: 'Точний товар' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/filter.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
function dataset(admitted: boolean) {
  return { ...profitDayDataset, profitReadModeLookup: true,
    Filters: profitDayDataset.Filters.map(field => ({ ...field, Name: field.Type === 1 ? 'Товар' : field.Name })),
    currentFinancialFilterConditions: admitted ? financialFilterCapability : undefined }
}

it.each([false, true])('gates the actual workbook inline condition selector on server admission: %s', async admitted => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(admitted)])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати відбір' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Товар' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Тип порівняння' }))
  for (const name of ['Рівне', 'В списку']) expect(screen.getByRole('option', { name })).toBeTruthy()
  for (const name of ['Не рівне', 'Не в списку']) {
    const option = screen.getByRole('option', { name })
    expect(option.getAttribute('data-combobox-disabled')).toBe(admitted ? null : 'true')
  }
})
