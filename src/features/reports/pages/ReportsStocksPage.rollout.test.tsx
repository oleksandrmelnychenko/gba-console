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

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupedCashWorkbookDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
})
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>

it('blocks generic datasets and the old special launch, then accepts the actual cash workbook', async () => {
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(screen.getByRole('button', { name: 'Валовий прибуток — як у 1С' }).hasAttribute('disabled')).toBe(true)
  expect(view.container.querySelector('a[href="/reports/registers"]')).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  await screen.findByText('Часткові форми за зразками Excel')
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Рух коштів за період' }))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].dataSource).toBe(40)
})

it('refuses an existing template outside BUG-1274 instead of opening or submitting it', async () => {
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: '10000000-0000-0000-0000-000000000001', Revision: 1, Name: 'Шаблон надходжень', Data: defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03') }])
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Шаблон надходжень/ }))
  expect(screen.getAllByText(BUG_1274_DISABLED_MESSAGE).length).toBeGreaterThan(0)
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
})
