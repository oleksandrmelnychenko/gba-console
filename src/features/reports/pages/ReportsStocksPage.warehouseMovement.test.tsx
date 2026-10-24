import { migrationFixture } from '../data/reportMigration.test-fixtures'
import { getMovementCapability, getMovementPublications, readMovement } from '../api/originalWarehouseMovementApi'
import { movementCapability, movementFixture, movementPublication } from '../data/originalWarehouseMovement.test-fixtures'
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
  vi.mocked(getMovementCapability).mockResolvedValue(movementCapability)
  vi.mocked(getMovementPublications).mockResolvedValue([movementPublication])
  vi.mocked(readMovement).mockResolvedValue(movementFixture)
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(getOneCTurnoverScopes).mockResolvedValue([organizationOnlyScope])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/reports/v3.xlsx' }, raw: {} })
})

describe('production workbook route to source warehouse movement', () => {
  it('opens the dedicated form from the visible catalogue, closes catalogue and preserves parent workbook', async () => {
    render(page()); await findOpenedWorkbook('ВП.xls')
    const before = screen.getByRole('button', { name: /^Період:/ }).getAttribute('aria-label')
    fireEvent.click(screen.getByRole('button', { name: 'Каталог звітів' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Рух товару за складськими документами' }))
    const form = await screen.findByRole('dialog', { name: 'Рух товару за складськими документами' })
    expect(screen.queryByRole('dialog', { name: 'Каталог звітів' })).toBeNull()
    expect(within(form).getByLabelText('Від')).toBeTruthy()
    expect(within(form).getByLabelText('До')).toBeTruthy()
    expect(within(form).getByRole('combobox', { name: 'Товар' })).toBeTruthy()
    expect(within(form).getByRole('combobox', { name: 'Склади' })).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('Від'), { target: { value: '01.09.2026' } }); fireEvent.blur(within(form).getByLabelText('Від'))
    fireEvent.change(within(form).getByLabelText('До'), { target: { value: '30.09.2026' } }); fireEvent.blur(within(form).getByLabelText('До'))
    fireEvent.click(within(form).getByRole('button', { name: 'Застосувати й показати' }))
    await within(form).findByRole('table')
    expect(vi.mocked(readMovement).mock.calls[0][0]).toMatchObject({ From: movementFixture.Scope.From, Through: movementFixture.Scope.Through })
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Рух товару за складськими документами' })).toBeNull())
    expect(screen.getByRole('button', { name: /^Період:/ }).getAttribute('aria-label')).toBe(before)
  })
  it('does not expose launch with protocol alone and no publication', async () => {
    vi.mocked(getMovementPublications).mockResolvedValue([])
    render(page()); await findOpenedWorkbook('ВП.xls'); fireEvent.click(screen.getByRole('button', { name: 'Каталог звітів' }))
    await screen.findByText('Рух товару: опублікованих даних ще немає.')
    expect(screen.queryByRole('button', { name: 'Рух товару за складськими документами' })).toBeNull()
    expect(readMovement).not.toHaveBeenCalled()
  })
  it('does not fetch or launch when report permission is absent', async () => {
    const view = render(page()); await findOpenedWorkbook('ВП.xls'); allowed = false; view.rerender(page())
    fireEvent.click(screen.getByRole('button', { name: 'Каталог звітів' }))
    expect(getMovementCapability).not.toHaveBeenCalled(); expect(getMovementPublications).not.toHaveBeenCalled()
  })
})
