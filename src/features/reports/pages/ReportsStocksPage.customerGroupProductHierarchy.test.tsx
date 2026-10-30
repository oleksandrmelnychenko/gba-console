import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getAnalysisHierarchyPage, getAnalysisHierarchyStatus, searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { customerCommonFieldsDataset as dataset } from '../data/customerGroupCommonFields.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn(), getAnalysisHierarchyPage: vi.fn(), getAnalysisHierarchyStatus: vi.fn(), getAnalysisGroupPage: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  const Data = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27')
  Data.customerGroups = { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [71] }, { Name: 'Набір B', ClientIds: [71] }] }
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'hierarchy', Revision: 1, Name: 'Групи та товари', Data }])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(searchDatasetReportValues).mockImplementation(async (_source, _field, params) => params.value.startsWith('id:') ? [{ Id: Number(params.value.slice(3)), Name: 'Клієнт' }] : [{ Id: '9007199254740993', Name: 'Точний товар' }])
  vi.mocked(searchAnalysisValues).mockResolvedValue([{ id: '9223372036854775807', name: 'Група з довідника', data: { Id: '9223372036854775807' } }])
  vi.mocked(getAnalysisHierarchyStatus).mockResolvedValue({ productGroup: null })
})
afterEach(cleanup)
it('builds typed Product1 mixed selection from advertised hierarchy and submits once with exact group/product identities', async () => {
  const user = userEvent.setup()
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await user.click(await screen.findByRole('button', { name: 'Шаблони' }))
  await user.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Групи та товари' }))
  await user.click(await screen.findByRole('button', { name: 'Додати умову' }))
  const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
  await user.click(within(dialog).getByRole('combobox', { name: 'Поле' })); await user.click(await screen.findByRole('option', { name: 'Товар' }))
  await user.click(within(dialog).getByRole('combobox', { name: 'Умова' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі'])
  await user.click(screen.getByRole('option', { name: 'У групі зі списку' }))
  expect(within(dialog).getByRole('button', { name: 'Зберегти' })).toHaveProperty('disabled', true)
  await user.click(within(dialog).getByRole('combobox', { name: 'Значення' })); await user.click(await screen.findByRole('option', { name: 'Група з довідника' }))
  expect(await within(dialog).findByRole('button', { name: 'Вибрано: 1' })).toBeTruthy()
  await user.click(within(dialog).getByRole('radio', { name: 'Товари' }))
  expect(within(dialog).getByRole('button', { name: 'Вибрано: 1' })).toBeTruthy()
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(44, 1, { value: '', offset: 0, limit: 30 }, expect.any(AbortSignal), undefined, undefined, undefined, undefined))
  await user.click(within(dialog).getByRole('combobox', { name: 'Значення' }))
  await user.click(await screen.findByRole('option', { name: 'Точний товар' }))
  expect(await within(dialog).findByRole('button', { name: 'Вибрано: 2' })).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  expect(createStockReport).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const selection = vi.mocked(createStockReport).mock.calls[0][0].selections.find(item => item.SelectedField.Type === 1)
  expect(selection).toMatchObject({ FilterCondition: { Type: 3 }, Values: [
    { Data: { kind: 'productGroup', id: '9223372036854775807' }, Name: 'Група з довідника' },
    { Data: { kind: 'product', id: '9007199254740993' }, Name: 'Точний товар' },
  ] })
  expect(getAnalysisHierarchyPage).not.toHaveBeenCalled()
})
