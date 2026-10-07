import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { groupedCashWorkbookDataset } from '../data/groupedCashPeriod.test-fixtures'
import { groupedSettlementDataset } from '../data/groupedSettlementPeriod.test-fixtures'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import { catalogueFixture } from '../data/reportMigration.test-fixtures'
import { BUG_1274_WORKBOOK_REPORT_IDS, type WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { ReportCataloguePanel } from './ReportCataloguePanel'
import type { ReportCatalogue } from '../types'

const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', () => ({ getReportCatalogue: vi.fn(), getReportDatasets: vi.fn() }))
function fixture(): ReportCatalogue {
  const result = catalogueFixture()
  const base = result.Reports[0]
  result.Reports = [...new Set(Object.values(BUG_1274_WORKBOOK_REPORT_IDS))].map(Id => ({
    ...structuredClone(base), Id, Name: Id, Title: Id,
    Sources: [{ ...structuredClone(base.Sources[0]), SourceId: Id }],
  })).concat(result.Reports)
  result.Migration!.Summary = { CatalogueEntries: 8, SourceImplementations: 9, BuiltinImplementations: 7,
    ByStatus: { Unassessed: 1, Captured: 1, NativePartial: 1, ParityVerified: 6 }, FullyVerifiedEntries: 5 }
  return result
}
function mount(onOpenWorkbook = vi.fn<(launch: WorkbookLaunch) => boolean>(() => true)) {
  render(<MantineProvider env="test"><I18nProvider><ReportCataloguePanel consoleScope onOpenWorkbook={onOpenWorkbook} /></I18nProvider></MantineProvider>)
  return onOpenWorkbook
}
beforeEach(() => {
  vi.clearAllMocks(); auth.allowed = true
  vi.mocked(getReportCatalogue).mockResolvedValue(fixture())
  vi.mocked(getReportDatasets).mockResolvedValue([groupedCashWorkbookDataset, groupedSettlementDataset, currentVparivanieDataset])
})
it('launches the period cash, both settlement variants and the current product matrix using their real datasets', async () => {
  const open = mount()
  for (const [name, id, currencyAxis] of [
    ['Ведомость по денежным средствам.xls', 40, undefined],
    ['Взаємороз всі.xls', 41, true], ['ДБіторка.xls', 41, false], ['Впарювання.xls', 39, undefined],
  ] as const) {
    const button = await screen.findByRole('button', { name })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ fileName: name, dataset: expect.objectContaining({ DataSource: id }),
      ...(currencyAxis === undefined ? {} : { currencyAxis }) }))
  }
  expect(open).toHaveBeenCalledTimes(4)
})
it('shows ready reports disabled with a chip and hides captured and unassessed reports', async () => {
  const open = mount()
  const chip = await screen.findByText('Готово')
  const row = chip.closest('tr')!
  expect(within(row).getByRole('button', { name: 'Запуск поки вимкнено' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(within(row).getByRole('button', { name: 'Запуск поки вимкнено' }))
  expect(open).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Покриття звіту: Повернення постачальникам' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Покриття звіту: Конструктор запиту' })).toBeNull()
})
it('does not launch workbook forms without generation permission or with unavailable capabilities', async () => {
  auth.allowed = false
  mount()
  await screen.findByText('Готово')
  expect(getReportDatasets).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'ДБіторка.xls' })).toBeNull()
})
