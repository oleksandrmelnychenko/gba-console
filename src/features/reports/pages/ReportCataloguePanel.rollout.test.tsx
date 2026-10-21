import { workbookDisplayFileName } from '../data/bug1274WorkbookGuide'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
const surface = vi.hoisted(() => ({ only: true }))
vi.mock('../reportSurfacePolicy', () => ({ get BUG_1274_ONLY_REPORT_SURFACE() { return surface.only } }))
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
afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280)
  vi.clearAllMocks(); auth.allowed = true; surface.only = true
  vi.mocked(getReportCatalogue).mockResolvedValue(fixture())
  vi.mocked(getReportDatasets).mockResolvedValue([groupedCashWorkbookDataset, groupedSettlementDataset, currentVparivanieDataset])
})
it('launches the period cash, both settlement variants and the current product matrix using their real datasets', async () => {
  const open = mount()
  for (const [name, id, currencyAxis] of [
    ['Ведомость по денежным средствам.xls', 40, undefined],
    ['Взаємороз всі.xls', 41, true], ['ДБіторка.xls', 41, false], ['Впарювання.xls', 39, undefined],
  ] as const) {
    const button = await screen.findByRole('button', { name: workbookDisplayFileName(name) })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ fileName: name, dataset: expect.objectContaining({ DataSource: id }),
      ...(currencyAxis === undefined ? {} : { currencyAxis }) }))
  }
  expect(open).toHaveBeenCalledTimes(4)
})
it('lists only the five BUG-1274 reports and hides ready, captured and unassessed reports', async () => {
  const open = mount()
  await screen.findByRole('button', { name: 'ДБіторка.xls' })
  expect(Array.from(document.querySelectorAll('.workbook-catalogue__name')).map(name => name.textContent))
    .toEqual(['Валовий прибуток', 'Валовий прибуток по постачальниках', 'Аналіз залишків і продажів', 'Відомість по коштах',
      'Відомість по взаєморозрахунках з контрагентами'])
  expect(screen.queryByText('Назва в конфігурації 1С: builtin:ВаловаяПрибыль')).toBeNull()
  fireEvent.click(screen.getAllByRole('button', { name: 'Відомості про звіт' })[0])
  expect(screen.getByText('Назва в конфігурації 1С: builtin:ВаловаяПрибыль')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Взаємороз всі.xls' })).toBeTruthy()
  expect(screen.queryByText('Готово')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Запуск поки вимкнено' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Покриття звіту: Борг за договорами' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Покриття звіту: Повернення постачальникам' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Покриття звіту: Конструктор запиту' })).toBeNull()
  expect(open).not.toHaveBeenCalled()
})
it('keeps the catalogue free of repeated reconciliation labels and migration metrics', async () => {
  mount()
  await screen.findByRole('button', { name: 'ДБіторка.xls' })
  expect(screen.queryByText('Розраховано з документів GBA; звірено з 1С')).toBeNull()
  expect(screen.queryByText('Розраховано з документів GBA; звірено з 1С.')).toBeNull()
  expect(screen.queryByText('Перевірених позицій')).toBeNull()
  expect(within(screen.getByRole('table')).queryByText(/Частково доступно в GBA|Джерело зафіксовано|Відповідність підтверджено/)).toBeNull()
})
it('keeps migration states and the verified count outside the BUG-1274-only surface', async () => {
  surface.only = false
  mount()
  await screen.findByText('Готово')
  expect(screen.getByText('Перевірених позицій')).toBeTruthy()
  expect(screen.queryByText('Розраховано з документів GBA; звірено з 1С')).toBeNull()
})
it('shows ready reports disabled with a chip and hides captured and unassessed reports when the BUG-1274-only surface is off', async () => {
  surface.only = false
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
  await screen.findByText('Валовий прибуток')
  expect(getReportDatasets).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'ДБіторка.xls' })).toBeNull()
})
it('shows the compact filtered report count without duplicate metrics', async () => {
  mount()
  await screen.findByRole('button', { name: 'ДБіторка.xls' })
  expect(screen.getByText('Звітів: 5')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Пошук звіту'), { target: { value: 'Аналіз залишків і продажів' } })
  expect(screen.getByText('Звітів: 1')).toBeTruthy()
  expect(screen.queryByText('Джерельних реалізацій')).toBeNull()
  expect(screen.queryByText('Стан перенесення та джерела')).toBeNull()
  expect(screen.queryByText('Форм за зразками Excel')).toBeNull()
  expect(screen.queryByText('Звітів у каталозі')).toBeNull()
})
it('keeps the whole-inventory header outside the 1274-only surface', async () => {
  surface.only = false
  mount()
  await screen.findByText('Готово')
  expect(screen.getByText('Звітів у каталозі').closest('.document-detail-metric')?.querySelector('strong')?.textContent).toBe('8')
  expect(screen.queryByText('Форм за зразками Excel')).toBeNull()
})
