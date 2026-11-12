import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const groups = ([
  [4425, "AL-KO", "c6fd7335-9bf2-47de-bb94-adb16d125be8"],
  [4404, "ArvinMeritor", "cff79ead-3f85-4593-a7a5-378824f7e5d6"],
  [4398, "AUGER", "a880743d-c905-4606-90dc-fa84dcd7d1fe"],
  [4373, "AVA СOOLING", "6d008cf7-d48b-4b9c-935c-adede0e0d55a"],
  [4428, "AYDINSAN", "27b3ee85-544c-45fd-8597-b0b4bc0b5acc"],
  [4384, "AYFAR", "ddfd118f-37d7-4f53-bc07-e5ef5cbb93a5"],
  [4414, "BOSCH", "5c147983-c087-4186-8688-b7cd17a497c4"],
  [4401, "BPW", "c19551b3-63ef-4be6-b9e4-097caeb7e611"],
  [4412, "BSG", "04dc48ba-5723-4476-9106-849c5a50a37d"],
  [4429, "CEI", "9266dfd2-61a6-490f-8ed4-4b2786a4121c"],
  [4403, "CONTECH", "c0018ffc-8a88-4e41-a6d1-28eab255f986"],
  [4433, "CRAFT", "ad5c15c4-712f-4bcc-8e65-3dfc25fb02ec"],
  [4389, "DASTECH", "4b56070f-4683-4f20-8674-28f97329d95d"],
  [4420, "DELSA", "3fa3a3f4-ec33-41c9-8631-9723312521b3"],
  [4369, "Diesel Technic", "ac2c9961-0575-4611-aaa7-bf06e18b5408"],
  [4397, "DPH сальники", "429072df-fc39-4ded-b6f6-882f06df20d6"],
  [4423, "ENI", "e98ec279-caa4-4185-b204-7ba0e0255661"],
  [4387, "FAN MARKET", "33ee462c-4e89-4ff7-be5a-837aa89669ee"],
  [4395, "FEBI", "9649b908-53c1-43bc-8271-0a03fb7c4fe4"],
  [4445, "FERBE", "c65d6a53-1018-44e2-9d29-549e296e302c"],
  [4421, "FLASH", "78af56a0-1490-448d-b9c7-cbef66974445"],
  [4444, "FOSSER", "3494f6e7-9652-4602-bccc-d40737f9f2f5"],
  [4422, "FRENKA", "20587ad2-48ae-4b1c-b334-b6c40911ca14"],
  [4408, "FSS", "7ca91db0-2838-4cf3-815a-a24b18c7798c"],
  [4416, "HAMMER", "38014f5d-c06c-4eac-876c-9486e919e6dd"],
  [4374, "HELLA", "6c72b7cf-5c6f-42ec-9e0a-39538403b37e"],
  [4379, "HOBI", "e0098b8d-e478-4a7a-9418-de0536685169"],
] satisfies [number, string, string][]).map(([Id, Name, NetUid]) => ({ Id, Name, NetUid }))
const hobi = groups[26]

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const dataset = { ...netDataset, reportProfiles: ['sales', 'grossProfit'], Groupings: grossDataset.Groupings, Filters: grossDataset.Filters }
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  const Data = salesConstructorRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-11-12'), SALES_CONSTRUCTOR_WORKBOOK, dataset)
  Data.selections = [{ IsChecked: true, SelectedField: { Type: 4, Name: 'Товарна група' }, FilterCondition: { Type: 2, Name: 'В списку' }, Values: groups.slice(0, 3).map(group => ({ Data: group, Name: group.Name, Value: group.Id })) }]
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'group-order', Revision: 1, Name: 'Товарні групи', Data }])
  vi.mocked(saveServerReportTemplate).mockImplementation(async value => ({ ...value, Revision: 2 }))
  vi.mocked(apiRequest).mockImplementation(async path => path === '/products/groups/filtered/get' ? { ProductGroups: groups } : [])
})
afterEach(cleanup)

it('keeps a lower product group in place when checked and unchecked in the sales report filter', async () => {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Товарні групи' }))
  const row = await screen.findByRole('group', { name: 'Умова відбору 1' })
  const input = within(row).getByPlaceholderText('Пошук значення')
  await userEvent.click(input)
  let lookups = -1
  await waitFor(() => {
    const settled = vi.mocked(apiRequest).mock.calls.length === lookups
    lookups = vi.mocked(apiRequest).mock.calls.length
    expect(settled).toBe(true)
  }, { interval: 600 })
  await waitFor(() => expect(screen.getByRole('option', { name: hobi.Name }).closest('.mantine-ScrollArea-viewport')).toBeTruthy())
  const option = screen.getByRole('option', { name: hobi.Name })
  const viewport = option.closest('.mantine-ScrollArea-viewport') as HTMLElement
  expect(viewport).toBeTruthy()
  const order = () => screen.getAllByRole('option').map(item => item.textContent)
  expect(order()).toEqual(groups.map(group => group.Name))
  viewport.scrollTop = 520
  fireEvent.scroll(viewport)
  vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear()
  await userEvent.click(option)
  expect(within(option).getByRole('checkbox', { hidden: true })).toHaveProperty('checked', true)
  expect(order()).toEqual(groups.map(group => group.Name))
  expect(screen.getAllByRole('option')[26]).toBe(option)
  expect(viewport.scrollTop).toBe(520)
  expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
  expect(input).toHaveProperty('value', '')
  expect(within(row).getByRole('button', { name: 'Вибрано: 4' })).toBeTruthy()
  await userEvent.click(option)
  expect(within(option).getByRole('checkbox', { hidden: true })).toHaveProperty('checked', false)
  expect(order()).toEqual(groups.map(group => group.Name))
  expect(viewport.scrollTop).toBe(520)
  expect(within(row).getByRole('button', { name: 'Вибрано: 3' })).toBeTruthy()
  await userEvent.click(option)
  fireEvent.keyDown(input, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data.selections[0].Values).toEqual(
    [...groups.slice(0, 3), hobi].map(group => ({ Data: group, Name: group.Name, Value: group.Id })),
  )
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/groups/filtered/get', { query: { value: '' } }))
})
