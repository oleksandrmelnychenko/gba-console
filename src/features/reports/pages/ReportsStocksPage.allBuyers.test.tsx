import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { previewStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import catalog from '../data/constructorDatasets.dev-fixture.json'
import serverCatalog from '../data/reportCatalog.server-fixture.json'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { createFilterExpression } from '../data/reportFilterExpression'
import type { ReportSelection } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const buyers = ([
  [633122, 901645, "ОК-АВТО ТОВ", "BCK02805"],
  [632723, 901404, "Передоплата - ЕНКОМ ПАРТС ТОВ", "BCK05803"],
  [632752, 901421, "КУЛИК ВОЛОДИМИР ВАСИЛЬОВИЧ ФОП", "BCK06603"],
  [632247, 901058, "АВТОСЕРВІС \"РУХ\" ТОВ", "BDP12201"],
  [633362, 901782, "РУБІН-92 ПП", "BDP15101"],
  [632740, 901412, "БАРВ ТІР ПАРТС ТОВ", "BGT01505"],
  [633501, 901851, "ІНТЕР ЛОГІСТИК ЛТД ТОВ", "BGT05401"],
  [632501, 901254, "АНІЦОЙ ІГОР ОЛЕКСАНДРОВИЧ ФОП", "BKD04001"],
  [633044, 901593, "ТРАКПОСТ ТІР ТОВ", "BKI04906"],
  [631639, 900528, "Київ - ТОВ \"Торговий дім \"Авторезерв\"", "BKI45002"],
  [631289, 900226, "СКУБА УКРАЇНА ТОВ", "BKI52901"],
  [631969, 900819, "ЄФРЕМЕНКО ЮРІЙ СЕРГІЙОВИЧ ФОП", "BKI59901"],
  [632076, 900912, "ВЛАД ТРАНС ТОВ", "BKI61801"],
  [632315, 901113, "ОНТРАК ТОВ", "BKI64501"],
  [632374, 901156, "ТК С.В.С.-2006 ТОВ", "BKI64901"],
  [632593, 901328, "АВТОТРАНС АВК ТОВ", "BKI66801"],
  [632826, 901475, "ТРАК СПЕЙС СЕРВІС ТОВ", "BKI68701"],
  [633176, 901673, "ТРАК СПЕЙС СЕРВІС + ТОВ", "BKI68702"],
  [632911, 901518, "СОЛЮШЕНЗ ХАБ ТОВ", "BKI69101"],
  [632995, 901566, "ЮРИДИЧНА ФІРМА \"ІНЮРКОНСАЛТ\" ТОВ", "BKI69801"],
  [633236, 901711, "АВТОСІТІ-БЦ ПЛЮС ПЛЮС ТОВ", "BKI70302"],
  [633321, 901757, "СБ ПЛЮС ПП", "BKI72201"],
  [633345, 901769, "ТРАК СТАЙЛ ТОВ", "BKI72301"],
  [633422, 901811, "ЛЕГІОН РЕПАІР ТРАК ТОВ", "BKI73001"],
  [633481, 901839, "ПК ТРАНС ЛОГІСТ ТОВ", "BKI73401"],
  [632722, 901403, "ЛІДЕРТРАНСАГРО ТОВ", "BMI03505"],
  [631325, 900260, "Миколаїв - ФОП Вакуленко Валентин Миколайович", "BMI04502"],
  [632939, 901532, "ЛЕЩУК ВІКТОРІЯ ОЛЕКСАНДРІВНА ФОП", "BOD01704"],
  [632716, 901398, "3В ГРУП ОДЕСА ТОВ", "BOD03404"],
  [631567, 900473, "///ТРАК///СЕТ  ТОВ", "BOD05702"]
] as const).map(([Id, RegionCodeId, Name, Value]) => ({ Id, Name, RegionCodeId, RegionCode: { Id: RegionCodeId, Value } }))
const buyer = buyers[0]
const organization: ReportSelection = { IsChecked: true, SelectedField: { Type: 0, Name: 'Організація' },
  FilterCondition: { Type: 0, Name: 'Рівне' }, Values: [{ Name: 'ТОВ «АМГ «КОНКОРД»', Value: 10565, Data: { Id: 10565 } }] }
const fields = [{ Type: 6, Name: 'Покупець. Контрагент' }, { Type: 8, Name: 'Код по регіону' }]

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(catalog))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(apiRequest).mockImplementation(async path => path === '/clients/reports/stocks/search' ? buyers : [])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})
afterEach(cleanup)

async function open(profile: 'sales' | 'grossProfit' | 'settlements') {
  const view = render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
  const nav = await screen.findByRole('navigation', { name: 'Розділи звітів' })
  const section = within(nav).getByRole('button', { name: profile === 'settlements' ? 'Грошові кошти' : 'Продажі' })
  await waitFor(() => expect(section).toHaveProperty('disabled', false))
  fireEvent.click(section)
  const names = { sales: 'Звіт по продажам', grossProfit: 'Валовий прибуток', settlements: 'Взаєморозрахунки всі' }
  fireEvent.click(await screen.findByRole('menuitem', { name: names[profile] }))
  return view
}

async function addBuyer(field: typeof fields[number]) {
  fireEvent.click(await screen.findByRole('button', { name: 'Додати відбір' }))
  const row = screen.getByRole('group', { name: 'Умова відбору 1' })
  fireEvent.click(within(row).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: field.Name.replace(/ \[\d+\]$/,'') }))
  return within(row)
}

it.each(['sales', 'grossProfit'] as const)('includes all buyers in %s without selecting a truncated lookup page and restores specific selection', async profile => {
  const { container } = await open(profile)
  const row = await addBuyer(fields[1])
  const search = row.getByPlaceholderText('Пошук значення')
  act(() => search.focus())
  fireEvent.change(search, { target: { value: '45' } })
  const option = await screen.findByRole('option', { name: 'BCK02805 — ОК-АВТО ТОВ' }, { timeout: 4000 })
  expect(screen.getAllByRole('option')).toHaveLength(30)
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  expect(previewStockReport).not.toHaveBeenCalled()
  fireEvent.click(row.getByRole('button', { name: 'Усі покупці' }))
  expect(row.getByRole('button', { name: 'Усі покупці' }).getAttribute('aria-pressed')).toBe('true')
  expect(row.getByRole('checkbox', { name: 'Увімкнути умову 1' })).toHaveProperty('checked', false)
  expect(row.queryByText('Усі покупці за цим полем. Інші умови відбору діють.')).toBeNull()
  expect(row.queryByPlaceholderText('Пошук значення')).toBeNull()
  expect(option.isConnected).toBe(false)
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const allRequest = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(allRequest).toMatchObject({ dataSource: 2, reportProfile: profile, selections: [] })
  fireEvent.click(row.getByRole('button', { name: 'Вибрати покупців' }))
  expect(row.getByRole('checkbox', { name: 'Увімкнути умову 1' })).toHaveProperty('checked', true)
  const restoredSearch = row.getByPlaceholderText('Пошук значення')
  act(() => restoredSearch.focus())
  fireEvent.change(restoredSearch, { target: { value: '45' } })
  fireEvent.click(await screen.findByRole('option', { name: 'BCK02805 — ОК-АВТО ТОВ' }, { timeout: 4000 }))
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(previewStockReport).mock.calls[1][0].selections).toMatchObject([{ IsChecked: true,
    SelectedField: { Type: 8 }, Values: [{ Value: 901645, Data: { Id: 901645, RegionCodeId: 901645 } }] }])
  expect(vi.mocked(apiRequest).mock.calls.filter(([path]) => path === '/clients/reports/stocks/search')
    .every(([, options]) => options?.query?.offset === 0 && options.query.limit === 30)).toBe(true)
})

it.each(fields)('preserves exact identities and other AND/OR filters when switching all buyers for $Name', async field => {
  const dataset = parseReportDatasets(catalog).find(item => item.DataSource === 2)!
  const data = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-31')
  data.reportProfile = 'grossProfit'
  const buyerSelection: ReportSelection = { IsChecked: true, SelectedField: field, FilterCondition: { Type: 0, Name: 'Рівне' },
    Values: [{ Name: 'BCK02805 — ОК-АВТО ТОВ', Value: field.Type === 6 ? buyer.Id : buyer.RegionCodeId,
      Data: field.Type === 6 ? buyer : buyer.RegionCode }] }
  data.selections = [organization, buyerSelection]
  data.filterExpression = createFilterExpression(data.selections, 2)
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'buyers', Revision: 1, Name: 'Покупці', Data: data }])
  const { container } = await open('grossProfit')
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Покупці' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 2' }))
  expect(within(screen.getByRole('group', { name: 'Умова відбору 1' })).queryByRole('button', { name: 'Усі покупці' })).toBeNull()
  fireEvent.click(row.getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Постачальник послуг (довідник)' }))
  const directory = within(await screen.findByRole('dialog', { name: 'Постачальник послуг' }))
  fireEvent.click(directory.getByRole('button', { name: 'Закрити' }))
  fireEvent.click(row.getByRole('button', { name: 'Усі покупці' }))
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const allRequest = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(allRequest.selections).toEqual([organization, { ...buyerSelection, IsChecked: false }])
  expect(allRequest.filterExpression).toEqual(data.filterExpression)
  fireEvent.click(row.getByRole('button', { name: 'Вибрати покупців' }))
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  const specificRequest = vi.mocked(previewStockReport).mock.calls[1][0]
  expect(specificRequest.selections).toEqual(data.selections)
  expect(specificRequest.filterExpression).toEqual(data.filterExpression)
})

it('asks to choose a field for a new row without empty brackets', async () => {
  await open('sales')
  fireEvent.click(await screen.findByRole('button', { name: 'Додати відбір' }))
  expect(await screen.findByText('Умова відбору 1: оберіть поле або зніміть галочку')).toBeTruthy()
  expect(screen.queryByText(/Умова відбору 1 \(\)/)).toBeNull()
})

it('preserves both sales filter IDs when opening the service directory on a selected row', async () => {
  const datasets = parseReportDatasets(catalog)
  const sales = datasets.find(dataset => dataset.DataSource === 2)!
  sales.Filters.push({ Type: 17, Name: 'Постачальник товару', Selectable: true })
  vi.mocked(getReportDatasets).mockResolvedValue(datasets)
  const parties = [
    { field: 6, label: 'Покупець', item: { Id: 632374, Name: 'BKI64901 — ТК С.В.С.-2006 ТОВ' } },
    { field: 17, label: 'Постачальник товару', item: { Id: 635333, Name: 'Fenix 8095 — ПЛА-ТАН І К ТОВ (MARS+AYFAR)' } },
  ]
  vi.mocked(apiRequest).mockImplementation(async (path, options) =>
    path === '/report/datasets/lookup' ? parties.filter(party => party.field === options?.query?.field).map(party => party.item) : [])
  const { container } = await open('sales')
  for (const [index, party] of parties.entries()) {
    fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
    const row = within(screen.getByRole('group', { name: `Умова відбору ${index + 1}` }))
    fireEvent.click(row.getByRole('combobox', { name: 'Поле' }))
    const group = await screen.findByRole('group', { name: 'Контрагент' })
    const option = within(group).getByRole('option', { name: party.label })
    fireEvent.click(option)
    fireEvent.click(row.getByPlaceholderText('Пошук значення'))
    fireEvent.click(await screen.findByRole('option', { name: party.item.Name }))
  }
  const buyerRow = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  const field = buyerRow.getByRole('combobox', { name: 'Поле' })
  fireEvent.click(field)
  fireEvent.click(screen.getByRole('option', { name: 'Постачальник послуг (довідник)' }))
  const directory = await screen.findByRole('dialog', { name: 'Постачальник послуг' })
  expect(buyerRow.getByRole('checkbox', { name: 'Увімкнути умову 1' })).toHaveProperty('checked', true)
  expect(field).toHaveProperty('value', 'Покупець')
  fireEvent.click(within(directory).getByRole('button', { name: 'Закрити' }))
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 2, reportProfile: 'sales',
    selections: parties.map(party => ({ SelectedField: { Type: party.field }, Values: [{ Data: { Id: party.item.Id }, Name: party.item.Name }] })) })
})

it('saves a choice in the separate buyer directory without changing the active buyer filter', async () => {
  const directoryBuyer = buyers[16]
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path === '/report/datasets/lookup' && options?.query?.field === 6) return [buyer]
    if (path === '/clients/registry/all/filtered' && options?.query?.value === directoryBuyer.RegionCode.Value) return [directoryBuyer]
    return []
  })
  const { container } = await open('sales')
  const row = await addBuyer({ Type: 6, Name: 'Покупець' })
  fireEvent.click(row.getByRole('button', { name: 'Вибрати значення умови 1' }))
  const active = within(await screen.findByRole('dialog', { name: 'Покупець' }))
  fireEvent.click(await active.findByRole('checkbox', { name: /ОК-АВТО ТОВ/ }))
  fireEvent.click(active.getByRole('button', { name: 'Застосувати' }))

  const field = row.getByRole('combobox', { name: 'Поле' })
  const openDirectory = async () => {
    fireEvent.click(field)
    fireEvent.click(await screen.findByRole('option', { name: 'Покупець (довідник)' }))
    return within(await screen.findByRole('dialog', { name: 'Покупець' }))
  }
  const directory = await openDirectory()
  const label = `${directoryBuyer.RegionCode.Value} — ${directoryBuyer.Name}`
  fireEvent.change(directory.getByRole('textbox', { name: 'Код або назва' }), { target: { value: directoryBuyer.RegionCode.Value } })
  fireEvent.click(await directory.findByRole('checkbox', { name: label }))
  expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/clients/registry/all/filtered', expect.objectContaining({
    query: expect.objectContaining({ typeRoleFilter: '1', value: directoryBuyer.RegionCode.Value }),
  }))
  fireEvent.click(directory.getByRole('button', { name: 'Зберегти вибір' }))
  expect(field).toHaveProperty('value', 'Покупець')
  const reopened = await openDirectory()
  expect(reopened.getByText('Вибрано: 1')).toBeTruthy()
  fireEvent.click(reopened.getByRole('button', { name: 'Закрити' }))

  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0].selections).toMatchObject([
    { IsChecked: true, SelectedField: { Type: 6 }, Values: [{ Data: { Id: buyer.Id } }] },
  ])
})

it('opens the service directory in current-document settlements and leaves the new row empty', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(serverCatalog))
  await open('settlements')
  fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  fireEvent.click(row.getByRole('combobox', { name: 'Поле' }))
  const group = await screen.findByRole('group', { name: 'Контрагент' })
  expect(within(group).getByRole('option', { name: 'Покупець' }).getAttribute('aria-disabled')).not.toBe('true')
  const service = within(group).getByRole('option', { name: 'Постачальник послуг (довідник)' })
  fireEvent.click(service)
  expect(await screen.findByRole('dialog', { name: 'Постачальник послуг' })).toBeTruthy()
  expect(row.getByRole('combobox', { name: 'Поле' })).toHaveProperty('value', '')
  expect(previewStockReport).not.toHaveBeenCalled()
})

it('keeps service choices across pages of the gross profit directory without replacing the goods supplier filter', async () => {
  const datasets = parseReportDatasets(serverCatalog)
  datasets.find(dataset => dataset.DataSource === 2)!.Filters.push({ Type: 17, Name: 'Постачальник товару', Selectable: true })
  vi.mocked(getReportDatasets).mockResolvedValue(datasets)
  const bank = { Id: '32750', Name: 'Fenix 5918 — % банку' }
  const next = { Id: '32755', Name: '20474912 — АТ "СК"ARX"' }
  const goods = { Id: 635333, Name: 'Fenix 8095 — ПЛА-ТАН І К ТОВ (MARS+AYFAR)' }
  const firstPage = [bank, ...Array.from({ length: 29 }, (_, index) => ({ Id: String(index + 1), Name: `Послуги ${index}` })), next]
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path !== '/report/datasets/lookup') return []
    const query = options?.query
    if (query?.dataSource === 2 && query.field === 17) return [goods]
    if (query?.dataSource === 40 && query.field === 17) return query.offset === 30 ? [next] : firstPage
    return []
  })
  const { container } = await open('grossProfit')
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  fireEvent.click(await screen.findByRole('button', { name: 'Додати відбір' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  const field = row.getByRole('combobox', { name: 'Поле' })
  fireEvent.click(field)
  fireEvent.click(await screen.findByRole('option', { name: 'Постачальник товару' }))
  fireEvent.click(row.getByRole('button', { name: 'Вибрати значення умови 1' }))
  const goodsList = within(await screen.findByRole('dialog', { name: 'Постачальник товару' }))
  fireEvent.click(await goodsList.findByRole('checkbox', { name: goods.Name }))
  fireEvent.click(goodsList.getByRole('button', { name: 'Застосувати' }))
  const openService = async () => {
    fireEvent.click(field)
    fireEvent.click(await screen.findByRole('option', { name: 'Постачальник послуг (довідник)' }))
    return within(await screen.findByRole('dialog', { name: 'Постачальник послуг' }))
  }
  let service = await openService()
  fireEvent.click(await service.findByRole('checkbox', { name: bank.Name }))
  fireEvent.click(service.getByRole('button', { name: 'Далі' }))
  fireEvent.click(await service.findByRole('checkbox', { name: next.Name }))
  expect(service.getByText('Вибрано: 2')).toBeTruthy()
  fireEvent.click(service.getByRole('button', { name: 'Зберегти вибір' }))
  service = await openService()
  expect(await service.findByRole('checkbox', { name: bank.Name })).toHaveProperty('checked', true)
  fireEvent.click(service.getByRole('button', { name: 'Вибрати всі' }))
  fireEvent.click(service.getByRole('button', { name: 'Далі' }))
  expect(await service.findByRole('checkbox', { name: next.Name })).toHaveProperty('checked', true)
  fireEvent.click(service.getByRole('button', { name: 'Закрити' }))
  service = await openService()
  expect(service.getByText('Вибрано: 2')).toBeTruthy()
  fireEvent.click(service.getByRole('button', { name: 'Закрити' }))
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(previewStockReport).mock.calls[1][0]).toMatchObject({ dataSource: 2, reportProfile: 'grossProfit',
    selections: [{ SelectedField: { Type: 17 }, Values: [{ Data: { Id: goods.Id }, Name: goods.Name }] }] })
})
