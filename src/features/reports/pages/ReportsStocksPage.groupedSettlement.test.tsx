import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate, normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { getSettlementPeriodAgreements } from '../api/settlementPeriodApi'
import { groupedSettlementDataset as dataset } from '../data/groupedSettlementPeriod.test-fixtures'
import { settlementPeriodAgreement, settlementPeriodRequest } from '../data/settlementPeriod.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { settlementAttributesDataset, settlementAttributesRequest } from '../data/settlementSourceAttributes.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
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
  vi.mocked(searchDatasetReportValues).mockReset().mockResolvedValue([])
  vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
})

it('selects genuine Fenix manager and region keys and submits them without numeric coercion', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, settlementAttributesDataset])
  vi.mocked(searchDatasetReportValues).mockImplementation(async (_source, field) => field === 60
    ? [{ Id: 'A'.repeat(32), Name: 'Source manager' }] : field === 61 ? [{ Id: 'region:00420020', Name: 'B ' }] : [])
  const { container } = await ready()
  fireEvent.click(screen.getByRole('combobox', { name: 'Звіт' }))
  fireEvent.click(await screen.findByRole('option', { name: settlementAttributesDataset.Name }))
  for (const [field, name, caption] of [[60, 'Основний менеджер покупця (ID джерела)', 'Source manager'],
    [61, 'Код по региону (джерело покупця)', 'B ']] as const) {
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(screen.getByRole('option', { name }))
    await waitFor(() => expect(vi.mocked(searchDatasetReportValues).mock.calls.some(call => call[0] === 41 && call[1] === field
      && call[3] instanceof AbortSignal && call[4] === 1)).toBe(true))
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: caption.trim() }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  }
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections.map(selection => ({ field: selection.SelectedField.Type,
    key: selection.Values[0].Data.Id, value: selection.Values[0].Value }))).toEqual([
    { field: 60, key: 'A'.repeat(32), value: 0 }, { field: 61, key: 'region:00420020', value: 0 }])
})

it('keeps a saved source filter intact but refuses generation and source lookup after switching to AMG', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, settlementAttributesDataset])
  const data = settlementAttributesRequest()
  data.selections = [{ IsChecked: true, SelectedField: { Type: 61, Name: 'SourceBuyerRegionCode' },
    FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 'region:0042', Name: 'B' }, Name: 'B', Value: 0 }] }]
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Saved source region', Data: data }])
  const { container } = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Saved source region' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'База взаєморозрахунків' }))
  fireEvent.click(screen.getByRole('option', { name: 'AMG' }))
  expect(screen.getByText('B', { selector: '.reports-stocks-selection-summary__value .app-table-chip.is-document .app-table-chip-label' })).toBeTruthy()
  fireEvent.submit(container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
  expect(screen.queryByRole('option', { name: 'Код по региону (джерело покупця)' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Основний менеджер покупця (ID джерела)' })).toBeNull()
  expect(searchDatasetReportValues).not.toHaveBeenCalled()
})

async function ready() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}

it('opens the debtor workbook directly with grouped current Buyers and no exact-agreement lookup', async () => {
  const { container } = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити ДБіторка.xls' }))
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Поточні договори покупців')
  expect((screen.getByRole('combobox', { name: 'Форма взаєморозрахунків' }) as HTMLInputElement).value).toBe('Організація → контрагент')
  expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).checked).toBe(true)
  expect(getSettlementPeriodAgreements).not.toHaveBeenCalled()
  expect(screen.getAllByText(/^Організація → контрагент, договори контрагента в різних валютах — в одному рядку, як у 1С\. Покупці з групи «Покупці»\./).length).toBeGreaterThan(0)
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
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Exact saved settlement' }))
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
  fireEvent.click(screen.getByRole('combobox', { name: 'Звіт' }))
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


it.each([[[4, 41, 76]], [[4, 76]]])('applies and resaves wire settlement layout %j without replacing its saved captions', async rows => {
  const technical = { ...dataset, Groupings: dataset.Groupings.map(group => ({ ...group,
    Name: group.Type === 41 ? 'Валюта взаєморозрахунків' : group.Name })) }
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, technical])
  const data = defaultDatasetRequest(technical, '2026-09-01', '2026-09-12')
  data.sorted.Row = data.sorted.Row.filter(row => rows.includes(row.type)).map(row => ({ ...row,
    label: row.type === 41 ? 'Валюта рахунку' : row.label }))
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Збережені взаєморозрахунки',
    UpdatedAtUtc: '2026-10-12T00:00:00Z', Data: { DataSource: 41, From: data.from, To: data.to,
      Sorted: { ...data.sorted, Measurements: data.sorted.Measurements.map(item => {
        const { parentName, ...rest } = item
        return { ...rest, ParentName: parentName }
      }) }, Selections: data.selections, GroupedSettlementPeriod: data.groupedSettlementPeriod } }
  // The actual saved DTO has PascalCase measurement fields at the wire boundary.
  const saved = normalizeSavedTemplate(wire as unknown as Parameters<typeof normalizeSavedTemplate>[0])
  vi.mocked(getServerReportTemplates).mockResolvedValue([saved])
  const { container } = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Збережені взаєморозрахунки' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(createStockReport).mock.calls[0][0]
  expect(request.sorted.Row).toEqual(data.sorted.Row)
  expect(request.sorted.Measurements).toEqual(data.sorted.Measurements)
  expect(request.groupedSettlementPeriod).toEqual(data.groupedSettlementPeriod)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const resaved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(resaved.sorted.Row).toEqual(data.sorted.Row)
  expect(resaved.sorted.Measurements).toEqual(data.sorted.Measurements)
  expect(resaved.groupedSettlementPeriod).toEqual(data.groupedSettlementPeriod)
  expect(resaved.sorted.Measurements.every(item => !Object.hasOwn(item, 'ParentName'))).toBe(true)
})
