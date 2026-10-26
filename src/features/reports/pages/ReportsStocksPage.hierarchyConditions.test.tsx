import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getAnalysisHierarchyPage, getAnalysisHierarchyStatus, searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import wire from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import { currentVparivanieRequest } from '../data/currentVparivanie.test-fixtures'
import { resetAnalysisHierarchyStatus } from '../hooks/useAnalysisHierarchyStatus'
import type { ReportRequestBody } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn(), getAnalysisHierarchyPage: vi.fn(), getAnalysisHierarchyStatus: vi.fn(), getAnalysisGroupPage: vi.fn() }))
const dataset = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } }
const WAREHOUSES_MISSING = 'Папки довідника «Склади» 1С ще не захоплені синхронізацією; умови груп стануть доступні після наступної синхронізації складів.'
const FOLDER = 'A0000000000000000000000000000001'
const LABELS = ['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі']
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); resetAnalysisHierarchyStatus()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'old', Revision: 1, Name: 'Збережена матриця', Data: currentVparivanieRequest() }])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(searchAnalysisValues).mockResolvedValue([])
  vi.mocked(getAnalysisHierarchyStatus).mockResolvedValue({ productGroup: null, counterpartyGroup: null, warehouseGroup: WAREHOUSES_MISSING })
})
async function open() {
  const result = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Збережена матриця' }))
  await screen.findByRole('button', { name: 'Додати поле: Групування рядків' })
  return result
}
async function chooseField(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const editor = screen.getByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(editor).getByRole('button', { name: 'Оберіть поле' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Поле відбору' })).getAllByRole('button', { name }).at(-1)!)
  return editor
}
function conditionOptions(editor: HTMLElement) {
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Умова' }))
  return screen.getAllByRole('option').map(option => ({ label: option.textContent, disabled: option.getAttribute('data-combobox-disabled') === 'true' }))
}

it('offers all eight comparisons for «Склад» and disables group ones with the truthful capture reason', async () => {
  await open()
  const editor = await chooseField('Склад')
  await waitFor(() => expect(getAnalysisHierarchyStatus).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(within(editor).getByText(`Умови «У групі…» недоступні: ${WAREHOUSES_MISSING}`)).toBeTruthy())
  const options = conditionOptions(editor)
  expect(options.map(option => option.label)).toEqual(LABELS)
  expect(options.filter(option => option.disabled).map(option => option.label)).toEqual(['У групі зі списку', 'Не у групі зі списку', 'У групі', 'Не у групі'])
})

it('builds «Покупець не у групі» from a captured folder and sends the typed group to the report', async () => {
  vi.mocked(getAnalysisHierarchyPage).mockResolvedValue({ parentId: null, hasMore: false, items: [{ id: `fenix:${FOLDER}`, name: 'Київ',
    path: 'Покупці / Київ', hasChildren: false, data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER } }] })
  const request: ReportRequestBody = currentVparivanieRequest()
  request.selections = [{ IsChecked: true, SelectedField: { Type: 4, Name: 'Товарна група' }, FilterCondition: { Type: 6, Name: 'У групі' },
    Values: [{ Data: { Id: 42 }, Name: 'AL-KO', Value: 0 }] }]
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'old', Revision: 1, Name: 'Збережена матриця', Data: request }])
  const { container } = await open()
  const editor = await chooseField('Покупець')
  await waitFor(() => expect(getAnalysisHierarchyStatus).toHaveBeenCalled())
  const options = conditionOptions(editor)
  expect(options.map(option => option.label)).toEqual(LABELS)
  expect(options.some(option => option.disabled)).toBe(false)
  fireEvent.click(screen.getByRole('option', { name: 'Не у групі' }))
  await waitFor(() => expect(getAnalysisHierarchyPage).toHaveBeenCalledWith('counterpartyGroup', null, 0, 30, '', expect.any(AbortSignal)))
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Покупці / Київ' }))
  await waitFor(() => expect(within(editor).getByRole('button', { name: 'Зберегти' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections.find(s => s.SelectedField.Type === 5)).toMatchObject({
    FilterCondition: { Type: 7, Name: 'Не у групі' },
    Values: [{ Data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER }, Name: 'Покупці / Київ', Value: 0 }],
  })
})
