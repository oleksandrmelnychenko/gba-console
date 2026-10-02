import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewPlannedCash } from '../api/plannedCashApi'
import { plannedCashCapability, plannedCashCalendarKinds, plannedCashDdsKinds, plannedCashFilters, plannedCashReport, plannedCashPartialReport, plannedCashEmptyReport } from '../data/plannedCash.test-fixtures'
import type { PlannedCashKind } from '../data/plannedCash'
import type { ReportDocument } from '../types'
import { PlannedCashReportPanel } from './PlannedCashReportPanel'
vi.mock('../api/plannedCashApi', () => ({ previewPlannedCash: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли планування коштів"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewPlannedCash).mockReset())
function panel(kind: PlannedCashKind = 'CalendarPayouts', caller = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><PlannedCashReportPanel capability={plannedCashCapability(kind)} initialFilters={plannedCashFilters()}
    canGenerate={canGenerate} callerKey={caller} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it.each(plannedCashCalendarKinds)('shows %s original server columns/groups/signed strings and same-run exports', async kind => {
  const report = plannedCashReport(kind); report.Totals[0].FormattedValue = '-2.0000000000000000000000000000'
  vi.mocked(previewPlannedCash).mockResolvedValue(report); render(panel(kind)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const result = await screen.findByRole('region', { name: 'Результат планування коштів' })
  expect(within(result).getAllByRole('columnheader').slice(1).map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getByText(report.Totals[0].FormattedValue)).toBeTruthy(); expect(within(result).getByText('Підтверджений контрагент')).toBeTruthy()
  const files = screen.getByRole('dialog', { name: 'Файли планування коштів' }); expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewPlannedCash).toHaveBeenCalledWith(plannedCashCapability(kind), plannedCashFilters(), 'owner-a', expect.any(AbortSignal)); expect(previewPlannedCash).toHaveBeenCalledOnce()
  expect(within(result).queryByText(report.SourceIdentity.SourceId)).toBeNull(); expect(within(result).queryByText(report.Proof.InputWitnessSha256)).toBeNull()
})
it.each(plannedCashDdsKinds)('shows honest %s selection pending, no manual reference field and no invented choices', kind => {
  render(panel(kind)); expect(screen.getByText(/Вибір сценарію плану ще не доступний/)).toBeTruthy()
  expect(screen.queryByRole('combobox')).toBeNull(); expect(screen.queryByLabelText(/RRef|Table|Source|Id/)).toBeNull()
  expect(screen.getByLabelText('Попередній період від')).toBeTruthy(); expect(screen.queryByLabelText('Дата планового залишку')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(previewPlannedCash).not.toHaveBeenCalled()
})
it.each(['empty', 'partial', 'undefined', 'missing-label'])('keeps %s distinct from fabricated zero and raw group names', async state => {
  const report = state === 'empty' ? plannedCashEmptyReport() : state === 'partial' ? plannedCashPartialReport() : plannedCashReport()
  if (state === 'undefined') { report.Totals[0] = { ...report.Totals[0], Value: null, Available: false, ExactValue: null, FormattedValue: null }; report.AvailabilityMessage = 'Для окремих показників значення не визначене або перевищує допустимий діапазон.' }
  if (state === 'missing-label') { report.Rows[0].Name = null; report.Rows[0].NameAvailable = false; report.GroupLabelsAvailabilityMessage = 'Назви частини груп ще не синхронізовані.' }
  vi.mocked(previewPlannedCash).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат планування коштів' })
  if (report.AvailabilityMessage) expect(within(result).getByText(report.AvailabilityMessage)).toBeTruthy()
  if (state === 'empty') expect(within(result).getAllByRole('cell').every(cell => cell.textContent === '')).toBe(true)
  if (state === 'partial') expect(within(result).queryByText('За обрані періоди даних немає.')).toBeNull()
  if (state === 'missing-label') expect(within(result).getByText('Назва групи ще недоступна')).toBeTruthy()
  expect(within(result).queryByText(report.Rows[0]?.Key ?? 'no-key')).toBeNull()
})
it.each(['Період від', 'Період до (не включно)', 'Дата планового залишку'])('clears values and files on %s edit', async label => {
  vi.mocked(previewPlannedCash).mockResolvedValue(plannedCashReport()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли планування коштів' }); fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-09-02' } })
  expect(screen.queryByRole('dialog', { name: 'Файли планування коштів' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат планування коштів' })).toBeNull()
})
it('keeps invalid or empty dates and missing caller/permission from sending a preview', () => {
  const view = render(panel()); fireEvent.change(screen.getByLabelText('Період від'), { target: { value: '' } }); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect(previewPlannedCash).not.toHaveBeenCalled(); view.rerender(panel('CalendarPayouts', '', false)); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('aborts an old owner and does not expose their late signed files during the new run', async () => {
  let oldDone!: (value: ReturnType<typeof plannedCashReport>) => void, newDone!: (value: ReturnType<typeof plannedCashReport>) => void
  vi.mocked(previewPlannedCash).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('CalendarPayouts', 'owner-a', true, loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewPlannedCash).mock.calls[0][3]; view.rerender(panel('CalendarPayouts', 'owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await act(async () => { oldDone(plannedCashReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('dialog', { name: 'Файли планування коштів' })).toBeNull()
  await act(async () => { newDone(plannedCashReport()) }); expect(screen.getByRole('region', { name: 'Результат планування коштів' })).toBeTruthy()
})
it.each(['permission', 'date', 'unmount'])('cancels a deferred %s scope and hides late output', async reason => {
  let done!: (value: ReturnType<typeof plannedCashReport>) => void
  vi.mocked(previewPlannedCash).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const pending = vi.mocked(previewPlannedCash).mock.calls[0][3]
  if (reason === 'permission') view.rerender(panel('CalendarPayouts', 'owner-a', false))
  else if (reason === 'date') fireEvent.change(screen.getByLabelText('Дата планового залишку'), { target: { value: '2026-11-01' } })
  else view.unmount()
  expect(pending.aborted).toBe(true); await act(async () => { done(plannedCashReport()) })
  expect(screen.queryByRole('region', { name: 'Результат планування коштів' })).toBeNull()
})
it('keeps one pending preview on double click and never automatically retries ambiguous failure', async () => {
  let done!: (value: ReturnType<typeof plannedCashReport>) => void
  vi.mocked(previewPlannedCash).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  render(panel()); const button = screen.getByRole('button', { name: 'Сформувати' }); fireEvent.click(button); fireEvent.click(button)
  expect(previewPlannedCash).toHaveBeenCalledOnce(); await act(async () => { done(plannedCashReport()) })
  expect(screen.getByRole('dialog', { name: 'Файли планування коштів' })).toBeTruthy()
})
it('rejects unsafe files before exposing a successful result', async () => {
  const report = plannedCashReport(); report.DocumentURL = '//untrusted.test/file'; vi.mocked(previewPlannedCash).mockResolvedValue(report)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  expect(screen.queryByRole('dialog', { name: 'Файли планування коштів' })).toBeNull(); expect(previewPlannedCash).toHaveBeenCalledOnce()
})
