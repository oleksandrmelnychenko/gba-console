import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { agreementPricesDataset } from '../data/agreementPrices.test-fixtures'
import { abcDataset, abcRequest } from '../data/reportAbcClassification.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportResult } from '../types'
import { ReportsConstructorPage } from './ReportsConstructorPage'

const permissions = vi.hoisted(() => new Set<string>())
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({
  user: { NetUid: 'constructor-workflow-user' }, session: { userNetUid: 'constructor-workflow-user' },
  hasPermission: (permission: string) => permissions.has(permission),
}) }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({
  can: (permission: string) => permissions.has(permission), isLoading: false,
}) }))
vi.mock('../api/reportsApi', async original => ({
  ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchValuationAgreements: vi.fn(),
  searchDatasetReportValues: vi.fn().mockResolvedValue([]),
}))
vi.mock('../api/reportWorkspaceApi', async original => ({
  ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document?: { DocumentURL?: string } }) =>
    opened ? <div role="dialog" aria-label="Файли сформованого звіту">{document?.DocumentURL}</div> : null,
}))

const tabs = ['Структура звіту', 'Умови відбору', 'Аналіз і сортування', 'Результат'] as const
const file: ReportResult = { document: { DocumentURL: '/files/constructor-workflow.xlsx' }, raw: {} }
const page = () => <MemoryRouter initialEntries={['/reports/constructor']}><MantineProvider env="test">
  <I18nProvider><ReportsConstructorPage /></I18nProvider>
</MantineProvider></MemoryRouter>
async function ready() {
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}
function tab(name: typeof tabs[number]) { return screen.getByRole('tab', { name }) }
function moveTo(name: typeof tabs[number]) {
  fireEvent.click(tab(name))
  expect(tab(name).getAttribute('aria-selected')).toBe('true')
  return screen.getByRole('tabpanel', { name })
}
async function select(label: string, option: string) {
  await act(async () => { fireEvent.click(screen.getByRole('combobox', { name: label })) })
  const selected = await screen.findByRole('option', { name: option })
  await act(async () => { fireEvent.click(selected) })
}
function blockingReason() {
  const button = screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  const id = button.getAttribute('aria-describedby')
  expect(id).toBeTruthy()
  const reason = document.getElementById(id!)!
  expect(reason).toBeTruthy()
  expect(reason.closest('[hidden]')).toBeNull()
  expect(reason.textContent?.trim()).not.toBe('')
  return reason
}
beforeEach(() => {
  permissions.clear()
  permissions.add(PermissionKeys.ReportsStocks.Page.View)
  permissions.add(PermissionKeys.ReportsStocks.Report.Generate)
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, abcDataset, agreementPricesDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 42, Name: 'Клієнт · Договір [42]' }])
  vi.mocked(createStockReport).mockResolvedValue(file)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected HTTP call in the mocked constructor workflow') }))
})
afterEach(() => {
  try { expect(fetch).not.toHaveBeenCalled() }
  finally { vi.unstubAllGlobals() }
})

it('navigates all four real tab panels by keyboard without generating or changing the selected preset', async () => {
  await ready()
  moveTo('Результат')
  const configureResult = screen.getByRole('button', { name: 'Перейти до налаштувань' })
  configureResult.focus()
  expect(document.activeElement).toBe(configureResult)
  fireEvent.click(configureResult)
  expect(tab('Структура звіту').getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(tab('Структура звіту'))
  fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
  const beforeDataset = (screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value
  expect(screen.getAllByRole('tab')).toHaveLength(4)
  for (const name of tabs) expect(tab(name)).toBeTruthy()
  const first = tab('Структура звіту'); first.focus()
  for (const [from, to] of [[tabs[0], tabs[1]], [tabs[1], tabs[2]], [tabs[2], tabs[3]]] as const) {
    fireEvent.keyDown(tab(from), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(tab(to))
    expect(tab(to).getAttribute('aria-selected')).toBe('true')
    const panel = screen.getByRole('tabpanel', { name: to })
    expect(tab(to).getAttribute('aria-controls')).toBe(panel.id)
  }
  fireEvent.keyDown(tab('Результат'), { key: 'Home' })
  expect(document.activeElement).toBe(first)
  expect(screen.getByRole('button', { name: 'Видалити По днях' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Видалити Організація' })).toBeTruthy()
  fireEvent.keyDown(first, { key: 'ArrowUp' })
  expect(document.activeElement).toBe(tab('Результат'))
  fireEvent.keyDown(tab('Результат'), { key: 'Home' })
  fireEvent.keyDown(first, { key: 'End' })
  expect(document.activeElement).toBe(tab('Результат'))
  expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(beforeDataset)

  await select('Набір даних звіту', abcDataset.Name)
  const structure = moveTo('Структура звіту')
  for (const remove of within(screen.getByRole('region', { name: 'Групування рядків' })).queryAllByRole('button', { name: /^Видалити / })) {
    fireEvent.click(remove)
  }
  fireEvent.click(within(structure).getByRole('button', { name: 'Очистити' }))
  for (const name of ['Налаштувати групування для TOP', 'Налаштувати показники для TOP']) {
    moveTo('Аналіз і сортування')
    expect((screen.getByRole('button', { name: 'Увімкнути TOP цілих груп' }) as HTMLButtonElement).disabled).toBe(true)
    const configureTop = screen.getByRole('button', { name })
    configureTop.focus()
    expect(document.activeElement).toBe(configureTop)
    fireEvent.click(configureTop)
    expect(tab('Структура звіту').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab('Структура звіту'))
  }
  expect(createStockReport).not.toHaveBeenCalled()
})

it('preserves full TOP, ABC, filters and ordering through every tab and a same-dataset preset', async () => {
  const template = { Id: '10000000-0000-4000-8000-000000000046', Revision: 3,
    Name: 'Повний TOP і ABC', Data: abcRequest() }
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Повний TOP і ABC/ }))
  expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(abcDataset.Name)
  moveTo('Умови відбору')
  const analysis = moveTo('Аналіз і сортування')
  expect((within(analysis).getByRole('textbox', { name: 'Кількість груп TOP' }) as HTMLInputElement).value).toBe('10')
  expect((within(analysis).getByRole('textbox', { name: 'Частка A для ABC, %' }) as HTMLInputElement).value).toBe('80')
  moveTo('Результат')
  expect(screen.getByText('Звіт ще не сформовано')).toBeTruthy()
  moveTo('Структура звіту')
  fireEvent.click(screen.getByRole('button', { name: 'Рахунки за призначенням і валютою' }))
  expect(screen.getByRole('button', { name: 'Видалити ABC-клас' })).toBeTruthy()
  moveTo('Аналіз і сортування')
  expect((screen.getByRole('textbox', { name: 'Кількість груп TOP' }) as HTMLInputElement).value).toBe('10')
  expect((screen.getByRole('textbox', { name: 'Частка C для ABC, %' }) as HTMLInputElement).value).toBe('5')
  expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
  expect(tab('Результат').getAttribute('aria-selected')).toBe('true')
  await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
}, 15000)

it('shows a blocking reason outside hidden panels and rejects direct submission until rows are configured', async () => {
  const view = await ready()
  const reason = blockingReason()
  expect(reason.textContent).toMatch(/показник|групування/i)
  moveTo('Результат')
  expect(blockingReason().textContent).toBe(reason.textContent)
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Перейти до налаштувань' }))
  expect(tab('Структура звіту').getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
  expect(createStockReport).not.toHaveBeenCalled()
})

it('requires the exact available agreement for dataset 22 and preserves it when changing tabs or applying its preset', async () => {
  const view = await ready()
  await select('Набір даних звіту', agreementPricesDataset.Name)
  expect(blockingReason().textContent).toMatch(/договір/i)
  expect(screen.queryByLabelText('Від')).toBeNull()
  moveTo('Аналіз і сортування'); moveTo('Умови відбору'); moveTo('Результат')
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  moveTo('Структура звіту')
  await select('Договір для звіту цін', 'Клієнт · Договір [42]')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Ціни товарів за договором' }))
  moveTo('Результат'); moveTo('Структура звіту')
  expect((screen.getByRole('combobox', { name: 'Договір для звіту цін' }) as HTMLInputElement).value).toContain('[42]')
  expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 22,
    valuationClientAgreementId: 42, from: '', to: '', sorted: { Row: [{ type: 5 }, { type: 28 }],
      Col: [], Measurements: [{ Type: 63 }] } })
  expect(searchValuationAgreements).toHaveBeenCalledWith({ value: '42', limit: 30, offset: 0 }, expect.any(AbortSignal))
  await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
})

it('moves an explicit generation to loading then its result without allowing a duplicate request', async () => {
  let complete!: (value: ReportResult) => void
  vi.mocked(createStockReport).mockReturnValue(new Promise(resolve => { complete = resolve }))
  const view = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
  expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Формуємо звіт')
  expect(tab('Результат').getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).toHaveBeenCalledOnce()
  moveTo('Структура звіту')
  expect(screen.getByRole('button', { name: 'Видалити По днях' }).closest('fieldset')?.disabled).toBe(true)
  moveTo('Результат')
  await act(async () => complete(file))
  const result = await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
  expect(within(result).getByText(file.document.DocumentURL!)).toBeTruthy()
  expect(screen.queryByText('Формуємо звіт')).toBeNull()
  expect(screen.getByRole('region', { name: 'Результат' })).toBeTruthy()
  expect(createStockReport).toHaveBeenCalledOnce()
})

it('keeps a failed explicit generation retryable without switching dataset or generating on tab changes', async () => {
  vi.mocked(createStockReport).mockRejectedValueOnce(new Error('Fixture report failure')).mockResolvedValue(file)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Не вдалося сформувати звіт')
  expect(tab('Результат').getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
  moveTo('Структура звіту'); moveTo('Результат')
  expect(createStockReport).toHaveBeenCalledOnce()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
  expect(createStockReport).toHaveBeenCalledTimes(2)
  expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(vi.mocked(createStockReport).mock.calls[0][0])
  expect(screen.queryByText('Не вдалося сформувати звіт')).toBeNull()
})
