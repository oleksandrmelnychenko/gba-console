import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets, currentDebtDataset, valuationDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { migrationFixture, sourceHash } from '../data/reportMigration.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

const debtTitle = 'Задолженность по контрагентам'
const draftKey = 'report-workspace-draft:v1:catalogue-owner'
let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'catalogue-owner' }, hasPermission: () => allowed }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchValuationAgreements: vi.fn(),
}))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened }: { opened: boolean }) => opened ? <div role="dialog" aria-label="Файли звіту" /> : null,
}))
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
function catalogue(): ReportCatalogue {
  return { CapturedOn: '2026-09-07', Presentations: [], Reports: [{
    Id: 'builtin:ЗадолженностьПоКонтрагентам', Name: 'ЗадолженностьПоКонтрагентам', Title: debtTitle, Kind: 'builtin',
    Sources: [{ World: 'fenix', SourceId: '0e9ed1d2-a9c6-4865-89bc-2f25c8b7ebd3', DefinitionSha256: sourceHash,
      Attributes: [], Migration: migrationFixture('native_partial') }],
  }], Migration: { Version: 'launch-fixture-v1', GeneratedAtUtc: '2026-09-08T01:00:00Z', Summary: {
    CatalogueEntries: 1, SourceImplementations: 1, BuiltinImplementations: 1,
    ByStatus: { Unassessed: 0, Captured: 0, NativePartial: 1, ParityVerified: 0 }, FullyVerifiedEntries: 0,
  } } }
}
async function ready() {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}
async function launchDebt() {
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const source = await screen.findByRole('button', { name: `Покриття звіту: ${debtTitle}` })
  const row = source.closest('tr')!
  const open = within(row).getByRole('button', { name: /Відкрити в конструкторі/ })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
}
function stored() { return JSON.parse(sessionStorage.getItem(draftKey)!) }

describe('named catalogue report to constructor', () => {
  beforeEach(() => {
    allowed = true; vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportCatalogue).mockResolvedValue(catalogue())
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, currentDebtDataset, valuationDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 42, Name: 'Договір 42' }, { Id: 43, Name: 'Договір 43' }])
    vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/old-valuation.xlsx' }, raw: {} })
  })

  it('opens the named debt configuration without generating or saving and restores its name after remount', async () => {
    const view = await ready()
    await launchDebt()
    expect(screen.getByLabelText('Назва поточного звіту').textContent).toBe(debtTitle)
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(currentDebtDataset.Name)
    expect(screen.queryByRole('button', { name: `Покриття звіту: ${debtTitle}` })).toBeNull()
    expect(screen.getByText('Звіт відкрито в конструкторі')).toBeTruthy()
    expect(stored().snapshot).toMatchObject({ name: debtTitle, activeTemplate: null, data: { dataSource: 10, from: '', to: '', selections: [] } })
    expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
    view.unmount()
    render(<Providers><ReportsStocksPage /></Providers>)
    const restore = await screen.findByRole('button', { name: 'Відновити чернетку' })
    await waitFor(() => expect((restore as HTMLButtonElement).disabled).toBe(false));fireEvent.click(restore)
    expect(screen.getByLabelText('Назва поточного звіту').textContent).toBe(debtTitle)
    expect(stored().snapshot.data.dataSource).toBe(10)
  })

  it('keeps the previous exact agreement and template revision for undo while clearing its file', async () => {
    const previous = { Id: '10000000-0000-4000-8000-000000000038', Revision: 4, Name: 'Оцінка за договором', Data: {
      ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: 42,
      selections: [{ IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
        FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Name: 'Інший договір', Value: 41, Data: { Id: 41 } }] }],
    } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([previous])
    const view = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }));fireEvent.click(await screen.findByRole('button', { name: new RegExp(previous.Name) }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Договір для оцінки' }));fireEvent.click(await screen.findByRole('option', { name: 'Договір 43' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.submit(view.container.querySelector('form')!);await screen.findByRole('dialog', { name: 'Файли звіту' })
    const before = stored().snapshot
    await launchDebt()
    expect(screen.queryByRole('dialog', { name: 'Файли звіту' })).toBeNull()
    expect(stored().snapshot.data.valuationClientAgreementId).toBeUndefined()
    expect(stored().snapshot.data.selections).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Повернути попередні налаштування' }))
    await waitFor(() => expect(stored().snapshot).toEqual(before))
    expect(stored().snapshot.data.valuationClientAgreementId).toBe(43)
    expect(stored().snapshot.activeTemplate).toMatchObject({ Revision: 4, Data: { valuationClientAgreementId: 42 } })
    expect(screen.queryByText('Звіт відкрито в конструкторі')).toBeNull()
    expect(createStockReport).toHaveBeenCalledOnce();expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('rechecks the parent capabilities before replacing a draft and keeps the catalogue open on refusal', async () => {
    vi.mocked(getReportDatasets).mockResolvedValueOnce(reportDatasets).mockResolvedValue([currentDebtDataset])
    await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-03' } })
    const before = stored().snapshot
    await launchDebt()
    expect(screen.getByText('Не вдалося відкрити звіт')).toBeTruthy()
    expect(screen.getByRole('button', { name: `Покриття звіту: ${debtTitle}` })).toBeTruthy()
    expect(stored().snapshot).toEqual(before)
    expect(createStockReport).not.toHaveBeenCalled();expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('does not expose catalogue launch after permission is revoked', async () => {
    const view = await ready()
    allowed = false;view.rerender(<Providers><ReportsStocksPage /></Providers>)
    expect((screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }) as HTMLButtonElement).disabled).toBe(true)
    expect(getReportCatalogue).not.toHaveBeenCalled()
    expect(createStockReport).not.toHaveBeenCalled()
  })
})
