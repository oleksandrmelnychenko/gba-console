import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets, purchaseDataset } from '../data/reportDatasets.test-fixtures'
import { groupedCashWorkbookDataset } from '../data/groupedCashPeriod.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { BUG_1274_DISABLED_MESSAGE } from '../data/reportMigration'
import { ReportsStocksPage } from './ReportsStocksPage'
import { findWorkbookLanding, openOtherWaysToOpen } from '../testing/workbookDesk'

const surface = vi.hoisted(() => ({ only: true }))
vi.mock('../reportSurfacePolicy', () => ({ get BUG_1274_ONLY_REPORT_SURFACE() { return surface.only } }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); surface.only = true
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupedCashWorkbookDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
})
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>

it('shows only BUG-1274 entry points, then accepts the actual cash workbook', async () => {
  const view = render(page())
  await findWorkbookLanding()
  expect(screen.queryByRole('button', { name: 'Валовий прибуток — як у 1С' })).toBeNull()
  expect(screen.queryByText('Готово')).toBeNull()
  expect(view.container.querySelector('a[href="/reports/registers"]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Продажі за днями' })).toBeNull()
  expect(view.container.querySelector('form')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Показати на екрані' })).toBeNull()
  openOtherWaysToOpen()
  fireEvent.click(screen.getByRole('combobox', { name: 'Звіт' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Відомість по коштах'])
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Звіт' }), { key: 'Escape' })
  expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити Ведомость по денежным средствам.xls' }))
  expect(screen.queryByRole('heading', { name: 'Звіти' })).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].dataSource).toBe(40)
})

it('lists only BUG-1274 templates and hides the full-list template order', async () => {
  vi.mocked(getServerReportTemplates).mockResolvedValue([
    { Id: '10000000-0000-0000-0000-000000000001', Revision: 1, Name: 'Шаблон надходжень', Data: defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03') },
    { Id: '10000000-0000-0000-0000-000000000002', Revision: 1, Name: 'Шаблон коштів', Data: defaultDatasetRequest(groupedCashWorkbookDataset, '2026-09-01', '2026-09-03') },
  ])
  render(page())
  await findWorkbookLanding()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  expect(await screen.findByRole('button', { name: 'Відкрити для редагування: Шаблон коштів' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Шаблон надходжень/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Порядок шаблонів' })).toBeNull()
})

it('blocks generic datasets and the old special launch, then accepts the actual cash workbook when the BUG-1274-only surface is off', async () => {
  surface.only = false
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(screen.getByRole('button', { name: 'Валовий прибуток — як у 1С' }).hasAttribute('disabled')).toBe(true)
  expect(view.container.querySelector('a[href="/reports/registers"]')).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  await screen.findByText('Звіти 1С за зразками Excel')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити Ведомость по денежным средствам.xls' }))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].dataSource).toBe(40)
})

it('refuses an existing template outside BUG-1274 instead of opening or submitting it when the BUG-1274-only surface is off', async () => {
  surface.only = false
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: '10000000-0000-0000-0000-000000000001', Revision: 1, Name: 'Шаблон надходжень', Data: defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03') }])
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Шаблон надходжень' }))
  expect(screen.getAllByText(BUG_1274_DISABLED_MESSAGE).length).toBeGreaterThan(0)
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
})
