import { changeReportPeriod } from '../testing/reportPeriod'
import { migrationFixture } from '../data/reportMigration.test-fixtures'
import { getMovementCapability, getMovementPublications, readMovement } from '../api/originalWarehouseMovementApi'
import {
  exportStockMovement, getStockMovementCapability, getStockMovementOrganizations, getStockMovementWarehouses, previewStockMovement,
  searchStockMovementGroups, searchStockMovementProducts,
} from '../api/warehouseStockMovementApi'
import { stockMovementCapability, stockMovementOrganizations, stockMovementResult, stockMovementWarehouses } from '../testing/warehouseStockMovementFixtures'
import type { StockMovementRequest } from '../data/warehouseStockMovement'
import { WAREHOUSE_MONETARY_SOURCE } from '../data/originalWarehouseMonetary'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getOneCTurnoverScopes, searchDatasetReportValues } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { organizationOnlyScope } from '../data/oneCTurnoverScopes.test-fixtures'
import actualCatalogue from '../data/oneCTurnoverCatalogue.http-fixture.json'
import type { ReportCatalogue } from '../types'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../api/originalWarehouseMovementApi', () => ({ getMovementCapability: vi.fn(), getMovementPublications: vi.fn(), readMovement: vi.fn() }))
vi.mock('../api/warehouseStockMovementApi', () => ({
  getStockMovementCapability: vi.fn(), getStockMovementWarehouses: vi.fn(), getStockMovementOrganizations: vi.fn(),
  searchStockMovementProducts: vi.fn(), searchStockMovementGroups: vi.fn(), previewStockMovement: vi.fn(), exportStockMovement: vi.fn(),
}))
let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'turnover-route-owner' }, hasPermission: () => allowed }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), getOneCTurnoverScopes: vi.fn(), searchDatasetReportValues: vi.fn(),
}))
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope /></I18nProvider></MantineProvider>
beforeAll(async () => { await import('./ReportCataloguePanel') })
beforeEach(() => {
  allowed = true; vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const catalogue = structuredClone(actualCatalogue) as unknown as ReportCatalogue
  catalogue.Reports.push({ Id: 'builtin:ВедомостьПартииТоваровНаСкладах', Name: 'ВедомостьПартииТоваровНаСкладах', Title: 'Відомість партій', Kind: 'builtin', Sources: [
    { World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE, Attributes: [], DefinitionSha256: 'a'.repeat(64), Migration: migrationFixture('native_partial') },
  ] })
  catalogue.Migration!.Summary.CatalogueEntries += 1; catalogue.Migration!.Summary.SourceImplementations += 1
  catalogue.Migration!.Summary.BuiltinImplementations += 1; catalogue.Migration!.Summary.ByStatus.NativePartial += 1
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
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
  vi.mocked(getOneCTurnoverScopes).mockResolvedValue([organizationOnlyScope])
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
    expect(getMovementCapability).not.toHaveBeenCalled()
    expect(getMovementPublications).not.toHaveBeenCalled()
    expect(readMovement).not.toHaveBeenCalled()
  })

  it('does not fetch or launch when report permission is absent', async () => {
    const view = render(page()); await findOpenedWorkbook('ВП.xls'); allowed = false; view.rerender(page())
    fireEvent.click(screen.getByRole('button', { name: 'Рух товару' }))
    expect(getStockMovementCapability).not.toHaveBeenCalled(); expect(previewStockMovement).not.toHaveBeenCalled()
  })
})
