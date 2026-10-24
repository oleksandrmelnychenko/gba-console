import { migrationFixture } from '../data/reportMigration.test-fixtures'
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
  vi.mocked(getReportCatalogue).mockResolvedValue(actualCatalogue as unknown as ReportCatalogue)
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(getOneCTurnoverScopes).mockResolvedValue([organizationOnlyScope])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/reports/v3.xlsx' }, raw: {} })
})

describe('production workbook route to published turnover', () => {
  it('opens from the real console workbook catalogue, generates v3 and preserves the parent draft', async () => {
    render(page())
    await findOpenedWorkbook('ВП.xls')
    const before = screen.getByRole('button', { name: /^Період:/ }).getAttribute('aria-label')
    expect(before).toMatch(/\d{2}\.\d{2}\.\d{4}/)
    expect(screen.queryByRole('combobox', { name: 'Звіт' })).toBeNull()
    expect(getReportCatalogue).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Каталог звітів 1С' }))
    await waitFor(() => expect(getOneCTurnoverScopes).toHaveBeenCalledOnce())
    const launch = await screen.findByRole('button', { name: 'Продажі за відповідальними' })
    fireEvent.click(launch)
    const form = await screen.findByRole('dialog', { name: 'Продажі за відповідальними' })
    expect(within(form).getByText(/Усі товари та послуги/)).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Каталог звітів 1С' })).toBeNull()
    fireEvent.click(within(form).getByRole('button', { name: 'Застосувати й сформувати' }))
    await screen.findByRole('dialog', { name: /Експорт.*Продажі за відповідальними/ })
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 1, oneC: organizationOnlyScope.Filters,
      from: '2026-10-01', to: '2026-10-24', selections: [] })
    await waitFor(() => expect((within(form).getByRole('button', { name: 'Закрити продажі за відповідальними' }) as HTMLButtonElement).disabled).toBe(true))
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Експорт.*Продажі за відповідальними/ })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Продажі за відповідальними' })).toBe(form)
    fireEvent.change(within(form).getByLabelText('Від'), { target: { value: '02.10.2026' } })
    fireEvent.blur(within(form).getByLabelText('Від'))
    expect(within(form).getByText(/Є незастосовані зміни періоду/)).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Відкрити сформований звіт' }))
    const exportDialog = await screen.findByRole('dialog', { name: /Експорт.*2026-10-01 — 2026-10-24/ })
    expect(within(exportDialog).getByRole('link', { name: /Excel/ }).getAttribute('href')).toContain('/reports/v3.xlsx')
    const overlay = exportDialog.closest('.mantine-Modal-root')!.querySelector('.mantine-Modal-overlay')!
    fireEvent.click(overlay)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Експорт.*Продажі за відповідальними/ })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Продажі за відповідальними' })).toBe(form)
    expect(within(form).getByText(/Є незастосовані зміни періоду/)).toBeTruthy()
    expect(createStockReport).toHaveBeenCalledOnce()
    fireEvent.click(within(form).getByRole('button', { name: /^Закрити$/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Продажі за відповідальними' })).toBeNull())
    expect(screen.getByRole('button', { name: /^Період:/ }).getAttribute('aria-label')).toEqual(before)
  })
  it('keeps the catalogue entry accessible but cannot launch unpublished v3 coverage', async () => {
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([])
    render(page())
    await findOpenedWorkbook('ВП.xls')
    fireEvent.click(screen.getByRole('button', { name: 'Каталог звітів 1С' }))
    await screen.findByText(/покриття чотирьох організацій ще не опубліковано/)
    expect(screen.queryByRole('button', { name: 'Продажі за відповідальними' })).toBeNull()
    expect(createStockReport).not.toHaveBeenCalled()
  })
  it('does not offer Fenix turnover while the catalogue is filtered to AMG', async () => {
    const catalogue = structuredClone(actualCatalogue) as unknown as ReportCatalogue
    catalogue.Reports[0].Sources.push({ ...catalogue.Reports[0].Sources[0], World: 'amg', Migration: migrationFixture('captured') })
    catalogue.Migration!.Summary.SourceImplementations = 2
    catalogue.Migration!.Summary.BuiltinImplementations = 2
    catalogue.Migration!.Summary.ByStatus.Captured = 1
    vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
    render(page())
    await findOpenedWorkbook('ВП.xls')
    fireEvent.click(screen.getByRole('button', { name: 'Каталог звітів 1С' }))
    await screen.findByRole('button', { name: 'Продажі за відповідальними' })
    fireEvent.click(screen.getByRole('combobox', { name: 'База' }))
    fireEvent.click(await screen.findByRole('option', { name: 'AMG' }))
    expect(screen.queryByRole('button', { name: 'Продажі за відповідальними' })).toBeNull()
  })

  it('keeps the real workbook catalogue permission gated', async () => {
    const view = render(page())
    await findOpenedWorkbook('ВП.xls')
    allowed = false; view.rerender(page())
    const trigger = screen.getByRole('button', { name: 'Каталог звітів 1С' }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
    fireEvent.click(trigger)
    expect(getReportCatalogue).not.toHaveBeenCalled()
    expect(getOneCTurnoverScopes).not.toHaveBeenCalled()
  })
})
