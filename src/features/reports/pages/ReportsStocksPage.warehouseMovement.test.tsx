import { changeReportPeriod } from '../testing/reportPeriod'
import {
  exportStockMovement, getStockMovementCapability, getStockMovementOrganizations, getStockMovementWarehouses, previewStockMovement,
  searchStockMovementGroups, searchStockMovementProducts,
} from '../api/warehouseStockMovementApi'
import { stockMovementCapability, stockMovementOrganizations, stockMovementResult, stockMovementWarehouses } from '../testing/warehouseStockMovementFixtures'
import type { StockMovementRequest } from '../data/warehouseStockMovement'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../api/warehouseStockMovementApi', () => ({
  getStockMovementCapability: vi.fn(), getStockMovementWarehouses: vi.fn(), getStockMovementOrganizations: vi.fn(),
  searchStockMovementProducts: vi.fn(), searchStockMovementGroups: vi.fn(), previewStockMovement: vi.fn(), exportStockMovement: vi.fn(),
}))
let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'turnover-route-owner' }, hasPermission: () => allowed }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchDatasetReportValues: vi.fn(),
}))
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope /></I18nProvider></MantineProvider>
beforeEach(() => {
  allowed = true; vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getStockMovementCapability).mockResolvedValue(structuredClone(stockMovementCapability))
  vi.mocked(getStockMovementWarehouses).mockResolvedValue(structuredClone(stockMovementWarehouses))
  vi.mocked(getStockMovementOrganizations).mockResolvedValue(structuredClone(stockMovementOrganizations))
  vi.mocked(searchStockMovementProducts).mockResolvedValue([])
  vi.mocked(searchStockMovementGroups).mockResolvedValue([])
  vi.mocked(previewStockMovement).mockImplementation(async (request: StockMovementRequest) => stockMovementResult(request))
  vi.mocked(exportStockMovement).mockResolvedValue({ DocumentURL: '/files/rukh.xlsx', FileName: 'rukh.xlsx', TotalRows: 4 })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/reports/v3.xlsx' }, raw: {} })
})

describe('native warehouse stock movement on the reports page', () => {
  it('opens the inline movement tab on GBA data and preserves both the result and the parent workbook', async () => {
    render(page()); await findOpenedWorkbook('ВП.xls')
    changeReportPeriod({ from: '2026-08-17' })
    const before = screen.getByRole('button', { name: /^Період:/ }).getAttribute('aria-label')
    fireEvent.click(screen.getByRole('button', { name: 'Рух товару' }))
    const form = await screen.findByRole('region', { name: 'Рух товару' })
    expect(await within(form).findByRole('button', { name: /^Період:/ })).toBeTruthy()
    expect(within(form).getByRole('group', { name: 'Склади' })).toBeTruthy()
    expect(within(form).getByRole('group', { name: 'Номенклатура' })).toBeTruthy()
    expect(within(form).getByRole('group', { name: 'Групування рядків' })).toBeTruthy()
    changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
    fireEvent.click(within(form).getByRole('button', { name: 'Застосувати й показати' }))
    await within(form).findByRole('table', { name: 'Рух товару — залишки, прихід і розхід' })
    expect(vi.mocked(previewStockMovement).mock.calls[0][0]).toMatchObject({ From: '2026-09-01', To: '2026-09-30', Offset: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Рух товару' })).toBeNull())
    expect(screen.getByRole('button', { name: /^Період:/ }).getAttribute('aria-label')).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: 'Рух товару' }))
    expect(within(form).getByRole('table')).toBeTruthy()
    expect(getStockMovementCapability).toHaveBeenCalledOnce()
  })

  it('does not fetch or launch when report permission is absent', async () => {
    const view = render(page()); await findOpenedWorkbook('ВП.xls'); allowed = false; view.rerender(page())
    fireEvent.click(screen.getByRole('button', { name: 'Рух товару' }))
    expect(getStockMovementCapability).not.toHaveBeenCalled(); expect(previewStockMovement).not.toHaveBeenCalled()
  })
})
