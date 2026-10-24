import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { mixedDataset } from '../data/currentVparivanieAnalysis.group-selection.test-fixtures'
import { currentVparivanieRequest } from '../data/currentVparivanie.test-fixtures'
import { currentVparivanieAnalysisCapability, upgradeCurrentVparivanieAnalysis } from '../data/currentVparivanieAnalysis'
import { changeReportPeriod, readReportDateInput } from '../testing/reportPeriod'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate, deleteServerReportTemplate } from '../api/reportWorkspaceApi'
import { exportStockReportPreview, previewStockReport } from '../api/reportsApi'
import { searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import type { ReportRequestBody, ReportTemplate } from '../types'
import { chooseTemplateAction } from '../testing/templateActions'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
const auth = vi.hoisted(() => ({ allowed: true, owner: 'unified-owner' }))
vi.mock('../../../shared/auth/session', async original => ({ ...await original<typeof import('../../../shared/auth/session')>(), readSession: () => ({ userNetUid: auth.owner, csrfToken: 'test' }) }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: auth.owner }, hasPermission: () => auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(), deleteServerReportTemplate: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  previewStockReport: vi.fn(), exportStockReportPreview: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn() }))
vi.mock('./ReportPreviewPages', () => ({ ReportPreviewPages: ({ request }: { request: ReportRequestBody }) => <output aria-label="Applied preview request">{JSON.stringify(request)}</output> }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
const session = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
let template: ReportTemplate
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>
const displayedRequest = () => JSON.parse(screen.getByLabelText('Applied preview request').textContent!) as ReportRequestBody
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); auth.allowed = true; auth.owner = 'unified-owner'
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const request = upgradeCurrentVparivanieAnalysis(currentVparivanieRequest(), mixedDataset)
  request.selections = [{ IsChecked: true, SelectedField: { Type: 4, Name: 'Товарна група' }, FilterCondition: { Type: 3, Name: 'У групі зі списку' },
    Values: [{ Data: { kind: 'productGroup', id: '001' }, Name: 'Group one', Value: 0 }, { Data: { kind: 'product', id: '9007199254740993' }, Name: 'Product exact', Value: 0 }] }]
  request.currentVparivanieMovements = { Incoming: true, Outgoing: false }
  template = { Id: 'old', Revision: 1, Name: 'Повний набір', Data: request }
  vi.mocked(getReportDatasets).mockResolvedValue([mixedDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  vi.mocked(searchAnalysisValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: session.ResultSha256, PresentationOnly: true, Request: null, ResultSession: session,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
  vi.mocked(exportStockReportPreview).mockResolvedValue({ document: { DocumentURL: '/files/applied.xlsx' }, raw: {} })
  vi.mocked(saveServerReportTemplate).mockImplementation(async request => { const saved = { ...request, Revision: 2 }; vi.mocked(getServerReportTemplates).mockResolvedValue([saved]); return saved })
})
async function open() {
  const view = render(page())
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Повний набір' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  return view
}
async function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByLabelText('Applied preview request')
}
it('preserves the whole draft across dates, cancels to the applied configuration and binds preview/export to the applied request', async () => {
  await open(); await apply()
  const original = displayedRequest()
  changeReportPeriod({ from: '2026-09-02' })
  const rule = screen.getByRole('group', { name: 'Умова відбору 1' })
  expect(within(rule).getByText('Група: Group one')).toBeTruthy()
  expect(within(rule).getByText('Товар: Product exact')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Прихід' })).toHaveProperty('checked', true)
  expect(displayedRequest()).toEqual(original)
  expect(screen.getByText(/^Період показаного результату:/).textContent).toContain('01.09.2026')
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати зміни' }))
  expect(readReportDateInput('Від').value).toBe(original.from)
  expect(screen.getByRole('button', { name: 'Скасувати зміни' })).toHaveProperty('disabled', true)
  expect(displayedRequest()).toEqual(original)
  changeReportPeriod({ from: '' })
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Сформувати Excel' })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати Excel' }))
  await waitFor(() => expect(exportStockReportPreview).toHaveBeenCalledExactlyOnceWith(session))
  expect(displayedRequest()).toEqual(original)
  changeReportPeriod({ from: '2026-09-02' })
  await apply()
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  const next = vi.mocked(previewStockReport).mock.calls[1][0]
  expect({ ...next, from: original.from }).toEqual(original)
  expect(displayedRequest()).toEqual(next)
})
it('edits filters inline, preserves values on incompatible operator changes and cancels the complete draft', async () => {
  await open()
  expect(screen.queryByRole('dialog')).toBeNull()
  const unavailable = currentVparivanieAnalysisCapability(mixedDataset)!.filters.find(field => field.type === 15)!
  expect(screen.queryByText(`${unavailable.name}: ${unavailable.unavailabilityReason}`)).toBeNull()
  for (const name of ['Фільтри', 'Показники', 'Групування']) expect(screen.getByRole('group', { name })).toBeTruthy()
  const rule = screen.getByRole('group', { name: 'Умова відбору 1' })
  fireEvent.click(within(rule).getByRole('combobox', { name: 'Умова' }))
  fireEvent.click(screen.getByRole('option', { name: 'У групі' }))
  expect(within(rule).getByText('Товар: Product exact')).toBeTruthy()
  expect(within(rule).getByText('Група: Group one')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  changeReportPeriod({ from: '2026-09-03' })
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати зміни' }))
  expect(readReportDateInput('Від').value).toBe(template.Data.from)
  expect(within(screen.getByRole('group', { name: 'Умова відбору 1' })).getByRole('combobox', { name: 'Умова' })).toHaveProperty('value', 'У групі зі списку')
  await apply()
  expect(vi.mocked(previewStockReport).mock.calls[0][0].selections).toEqual(template.Data.selections)
})
it('retains the complete draft after failed template save and restores exactly the successfully saved set', async () => {
  await open()
  changeReportPeriod({ from: '2026-09-04' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  vi.mocked(saveServerReportTemplate).mockRejectedValueOnce(new Error('Збереження недоступне'))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await screen.findByText('Збереження недоступне')
  expect(readReportDateInput('Від').value).toBe('2026-09-04')
  expect(previewStockReport).not.toHaveBeenCalled()
  const sent = vi.mocked(saveServerReportTemplate).mock.calls[0][0]
  expect(sent.Data.selections).toEqual(template.Data.selections)
  expect(sent.Data.sorted).toEqual(template.Data.sorted)
  expect(sent.Data.currentVparivanieMovements).toEqual(template.Data.currentVparivanieMovements)
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledTimes(2))
  await screen.findByText(/збережено/i)
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити для редагування: Повний набір' }))
  await apply()
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toEqual(sent.Data)
})
it('rejects late applied results after permission revocation', async () => {
  let complete!: (value: Awaited<ReturnType<typeof previewStockReport>>) => void
  const result = await vi.mocked(previewStockReport).getMockImplementation()!({} as never)
  vi.mocked(previewStockReport).mockReturnValue(new Promise(resolve => { complete = resolve }))
  const view = await open()
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  auth.allowed = false; view.rerender(page())
  await act(async () => complete(result))
  expect(screen.queryByLabelText('Applied preview request')).toBeNull()
  auth.allowed = true; view.rerender(page())
  expect(screen.queryByLabelText('Applied preview request')).toBeNull()
})

it('keeps mixed product mode, search and open options when selecting two products successively', async () => {
  vi.mocked(searchAnalysisValues).mockImplementation(async field => field === 1 ? [
    { id: '11', name: 'New product one', data: { Id: '11' } }, { id: '12', name: 'New product two', data: { Id: '12' } },
  ] : [])
  await open()
  const rule = screen.getByRole('group', { name: 'Умова відбору 1' })
  fireEvent.click(within(rule).getByRole('radio', { name: 'Товари' }))
  fireEvent.click(within(rule).getByRole('combobox', { name: 'Значення' }))
  fireEvent.change(within(rule).getByPlaceholderText('Пошук значення'), { target: { value: 'New' } })
  await waitFor(() => expect(vi.mocked(searchAnalysisValues).mock.calls.some(call => call[0] === 1 && call[1] === 'New')).toBe(true))
  fireEvent.click(await within(rule).findByRole('option', { name: 'New product one' }))
  await within(rule).findByRole('button', { name: 'Вибрано: 3' })
  expect(within(rule).getByRole('radio', { name: 'Товари' })).toHaveProperty('checked', true)
  expect(within(rule).getByPlaceholderText('Пошук значення')).toHaveProperty('value', 'New')
  fireEvent.click(await within(rule).findByRole('option', { name: 'New product two' }))
  expect(within(rule).getByRole('button', { name: 'Вибрано: 4' })).toBeTruthy()
  fireEvent.keyDown(within(rule).getByRole('combobox', { name: 'Значення' }), { key: 'Escape' })
  await apply()
  expect(vi.mocked(previewStockReport).mock.calls[0][0].selections[0].Values.map(value => value.Data)).toEqual([
    ...template.Data.selections[0].Values.map(value => value.Data), { kind: 'product', id: '11' }, { kind: 'product', id: '12' },
  ])
})
it('cancels editable changes without rolling back a successfully updated server template revision', async () => {
  await open(); await apply()
  const applied = displayedRequest()
  changeReportPeriod({ from: '2026-09-05' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await screen.findByText('Шаблон збережено.')
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Шаблони звіту' })).getByRole('button', { name: 'Закрити' }))
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати зміни' }))
  expect(readReportDateInput('Від').value).toBe(applied.from)
  expect(displayedRequest()).toEqual(applied)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  expect(screen.getByRole('button', { name: 'Оновити шаблон' })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledTimes(2))
  expect(vi.mocked(saveServerReportTemplate).mock.calls[1][0]).toMatchObject({ Revision: 2, Data: applied })
})

it('opens Save set directly at the name field while Templates still opens its list', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти набір як шаблон' }))
  expect(screen.getByRole('textbox', { name: 'Назва шаблону' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Новий шаблон' })).toBeNull()
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Шаблони звіту' })).getByRole('button', { name: 'Закрити' }))
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  expect(screen.getByRole('button', { name: 'Новий шаблон' })).toBeTruthy()
})

it('does not resurrect a deleted template when cancelling edits to its applied report', async () => {
  vi.mocked(deleteServerReportTemplate).mockImplementation(async () => { vi.mocked(getServerReportTemplates).mockResolvedValue([]) })
  await open(); await apply()
  changeReportPeriod({ from: '2026-09-06' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  chooseTemplateAction(template.Name, 'Видалити')
  fireEvent.click(screen.getByRole('button', { name: 'Підтвердити видалення' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Оновити шаблон' })).toBeNull())
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Шаблони звіту' })).getByRole('button', { name: 'Закрити' }))
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати зміни' }))
  expect(readReportDateInput('Від').value).toBe(template.Data.from)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  expect(screen.queryByRole('button', { name: 'Оновити шаблон' })).toBeNull()
  expect(saveServerReportTemplate).not.toHaveBeenCalled()
})
