import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { grossDataset, netDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { SALES_CONSTRUCTOR_WORKBOOK, salesConstructorRequest } from '../data/salesConstructorProfiles'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
const client = { Id: 633729, Name: 'XM06001 — Хмельницький - ПП Муляр Ю.А. [633729]' }
const other = { Id: 633222, Name: 'Муляр Іван Сергійович [633222]' }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const dataset = { ...netDataset, reportProfiles: ['sales', 'grossProfit'], Groupings: grossDataset.Groupings }
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  const Data = salesConstructorRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27'), SALES_CONSTRUCTOR_WORKBOOK, dataset)
  Data.selections = [{ IsChecked: true, SelectedField: { Type: 6, Name: 'Покупець' }, FilterCondition: { Type: 2, Name: 'В списку' }, Values: [{ Data: other, Name: other.Name, Value: other.Id }] }]
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'buyer-codes', Revision: 1, Name: 'Покупці звіту', Data }])
  vi.mocked(saveServerReportTemplate).mockImplementation(async value => ({ ...value, Revision: 2 }))
  vi.mocked(apiRequest).mockImplementation(async (path, options) => path === '/report/datasets/lookup' && ['Муляр', 'XM06001'].includes(String(options?.query?.value)) ? [client] : [])
})
afterEach(cleanup)
it.each(['Муляр', 'XM06001'])('searches the sales buyer by %s, shows code and name, preserves both exact selections when saved', async query => {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Покупці звіту' }))
  const row = await screen.findByRole('group', { name: 'Умова відбору 1' })
  const input = within(row).getByPlaceholderText('Пошук значення')
  fireEvent.change(input, { target: { value: query } })
  fireEvent.click(input)
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({ query: { dataSource: 2, field: 6, value: query, offset: 0, limit: 30 } })))
  fireEvent.click(await screen.findByRole('option', { name: client.Name }))
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(within(row).getByRole('button', { name: `Видалити ${client.Name}` })).toBeTruthy()
  expect(within(row).getByRole('button', { name: `Видалити ${other.Name}` })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data.selections[0].Values).toEqual([
    { Data: other, Name: other.Name, Value: other.Id }, { Data: client, Name: client.Name, Value: client.Id },
  ])
})
