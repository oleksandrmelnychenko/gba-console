import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getAnalysisHierarchyPage, getAnalysisHierarchyStatus, searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import wire from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { resetAnalysisHierarchyStatus } from '../hooks/useAnalysisHierarchyStatus'
import type { AnalysisHierarchy } from '../data/currentVparivanieAnalysis'
import type { ReportDataset } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn(), getAnalysisHierarchyPage: vi.fn(), getAnalysisHierarchyStatus: vi.fn(), getAnalysisGroupPage: vi.fn() }))
const declared = (field: number): AnalysisHierarchy => ({ ...wire.filters.find(filter => filter.type === field)!.hierarchy as AnalysisHierarchy, itemField: field })
const dataset: ReportDataset = { ...profitSupplierDataset, Name: 'Валовий прибуток по постачальниках',
  Filters: [{ Type: 0, Name: 'Організація' }, { Type: 1, Name: 'Товар', hierarchy: declared(1) }, { Type: 17, Name: 'Постачальник', hierarchy: declared(17) }] }
const FOLDER = 'A0000000000000000000000000000001'
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); resetAnalysisHierarchyStatus()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'supplier', Revision: 1, Name: 'Постачальники',
    Data: defaultDatasetRequest(dataset, '2026-09-01', '2026-09-23') }])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '7', Name: 'Постачальник 7' }])
  vi.mocked(searchAnalysisValues).mockResolvedValue([])
  vi.mocked(getAnalysisHierarchyStatus).mockResolvedValue({ productGroup: null, counterpartyGroup: null, warehouseGroup: null })
  vi.mocked(getAnalysisHierarchyPage).mockResolvedValue({ parentId: null, hasMore: false, items: [{ id: `fenix:${FOLDER}`, name: 'Туреччина',
    path: 'Постачальники / Туреччина', hasChildren: false, data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER } }] })
})

it('builds «Постачальник у групі зі списку» from a captured folder and an exact supplier in the supplier gross-profit report', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Постачальники' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Додати умову' }))
  const editor = screen.getByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Постачальник' }))
  await waitFor(() => expect(getAnalysisHierarchyStatus).toHaveBeenCalledOnce())
  await new Promise(resolve => setTimeout(resolve, 0))
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Умова' }))
  await waitFor(() => expect(screen.getByRole('option', { name: 'У групі зі списку' }).getAttribute('data-combobox-disabled')).not.toBe('true'))
  expect(screen.getAllByRole('option').map(option => option.textContent))
    .toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі'])
  fireEvent.click(screen.getByRole('option', { name: 'У групі зі списку' }))
  await waitFor(() => expect(getAnalysisHierarchyPage).toHaveBeenCalledWith('counterpartyGroup', null, 0, 30, '', expect.any(AbortSignal)))
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Постачальники / Туреччина' }))
  fireEvent.click(within(editor).getByRole('radio', { name: 'Постачальники' }))
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(38, 17, { value: '', offset: 0, limit: 30 }, expect.any(AbortSignal),
    undefined, undefined, undefined, undefined))
  fireEvent.click(await screen.findByRole('option', { name: 'Постачальник 7' }))
  await waitFor(() => expect(within(editor).getByRole('button', { name: 'Зберегти' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections.find(s => s.SelectedField.Type === 17)).toMatchObject({
    FilterCondition: { Type: 3, Name: 'У групі зі списку' },
    Values: [{ Data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER }, Name: 'Постачальники / Туреччина' },
      { Data: { kind: 'supplier', id: '7' }, Name: 'Постачальник 7' }],
  })
})
