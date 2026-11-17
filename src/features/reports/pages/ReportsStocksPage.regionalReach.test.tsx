import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { searchDatasetReportValues } from '../api/reportsApi'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { regionalDataset } from '../data/currentVparivanieRegional.test-fixtures'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, regionalDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
})

it('reaches the regional form from the «Аналіз залишків і продажів» menu entry', async () => {
  render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  fireEvent.click(screen.getByRole('button', { name: 'Особливі звіти' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Аналіз залишків і продажів' }))
  await findOpenedWorkbook('Впарювання.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Показати регіональну форму' })).toBeTruthy())
})
