import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPlannedCashScenarioChoices, previewPlannedCash } from '../api/plannedCashApi'
import { createPlannedCashScenarioChoicesRequest, type PlannedCashScenarioChoices } from '../data/plannedCashScenarioChoices'
import { PLANNED_CASH_TEST_CHOICE, plannedCashCapability, plannedCashChoices, plannedCashDdsKinds, plannedCashFilters,
  plannedCashReport, plannedCashConflictReport, plannedCashEmptyReport } from '../data/plannedCash.test-fixtures'
import type { PlannedCashKind } from '../data/plannedCash'
import type { ReportDocument } from '../types'
import { PlannedCashReportPanel } from './PlannedCashReportPanel'
vi.mock('../api/plannedCashApi', () => ({ previewPlannedCash: vi.fn(), getPlannedCashScenarioChoices: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли планування коштів"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
function panel(kind: PlannedCashKind = 'DdsPayouts', caller = 'owner-a', allowed = true) {
  return <MantineProvider env="test"><I18nProvider><PlannedCashReportPanel capability={plannedCashCapability(kind)} initialFilters={plannedCashFilters()}
    canGenerate={allowed} callerKey={caller} /></I18nProvider></MantineProvider>
}
async function selectScenario(key = PLANNED_CASH_TEST_CHOICE) { fireEvent.change(await screen.findByRole('combobox', { name: 'Сценарій плану' }), { target: { value: key } }) }
beforeEach(() => {
  vi.mocked(previewPlannedCash).mockReset(); vi.mocked(getPlannedCashScenarioChoices).mockReset()
  vi.mocked(getPlannedCashScenarioChoices).mockImplementation(async (cap, filters) => ({ ...plannedCashChoices(cap.Kind), ...createPlannedCashScenarioChoicesRequest(cap, filters) }))
  vi.mocked(previewPlannedCash).mockImplementation(async cap => plannedCashReport(cap.Kind))
})
it.each(plannedCashDdsKinds)('selects genuine %s by label and exports all original server cells from the same run', async kind => {
  render(panel(kind)); const combo = await screen.findByRole('combobox', { name: 'Сценарій плану' })
  expect((combo as HTMLSelectElement).value).toBe(''); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const report = plannedCashReport(kind), result = await screen.findByRole('region', { name: 'Результат планування коштів' })
  expect(within(result).getAllByRole('columnheader').slice(1).map(column => column.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getAllByText('-2').length).toBeGreaterThan(0)
  expect(previewPlannedCash).toHaveBeenCalledWith(plannedCashCapability(kind), plannedCashFilters(), 'owner-a', expect.any(AbortSignal), PLANNED_CASH_TEST_CHOICE)
  const files = screen.getByRole('dialog', { name: 'Файли планування коштів' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(within(result).queryByText(PLANNED_CASH_TEST_CHOICE)).toBeNull(); expect(screen.queryByLabelText(/RRef|SourceId|Table|PlanEndpoint/)).toBeNull()
})
it.each(['empty', 'pending', 'empty-next'])('keeps %s choices honest and does not fabricate a selectable default', async state => {
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce({ ...plannedCashChoices(), Available: state !== 'pending', Choices: [], ContinuationKey: state === 'empty-next' ? 'genuine-next' : null })
  render(panel())
  await screen.findByText(state === 'pending' ? /Вибір сценарію плану ще не доступний/ : state === 'empty-next' ? /На цій сторінці немає доступних назв/ : /немає доступних сценаріїв плану/)
  expect(screen.queryByRole('combobox')).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getPlannedCashScenarioChoices).toHaveBeenCalledOnce(); expect(previewPlannedCash).not.toHaveBeenCalled()
})
it('pages duplicate human labels without revealing technical references or silently choosing the new item', async () => {
  const first = plannedCashChoices(); first.ContinuationKey = 'genuine-next'; const second = plannedCashChoices(); second.Choices[0].Key = 'second-encrypted-key'
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  render(panel()); await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Ще сценарії' }))
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
  expect(screen.getAllByRole('option').slice(1).map(option => option.textContent)).toEqual([first.Choices[0].Caption, second.Choices[0].Caption])
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(PLANNED_CASH_TEST_CHOICE)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByRole('region', { name: 'Результат планування коштів' })
  expect(vi.mocked(previewPlannedCash).mock.calls[0][4]).toBe(PLANNED_CASH_TEST_CHOICE)
})
it.each(['Період від', 'Період до (не включно)', 'Попередній період від', 'Попередній період до (не включно)'])('clears selection, result and signed files after %s changes', async label => {
  render(panel()); await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли планування коштів' })
  fireEvent.change(screen.getByLabelText(label), { target: { value: label.includes('до') ? '2026-10-02' : '2026-08-02' } })
  expect(screen.queryByRole('dialog', { name: 'Файли планування коштів' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат планування коштів' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy()); expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('')
})
it('handles stale409 by reloading choices and requiring an explicit new preview without automatic replay', async () => {
  vi.mocked(previewPlannedCash).mockRejectedValueOnce(new ApiError('Застарілий сценарій', 409, null)).mockResolvedValueOnce(plannedCashReport('DdsPayouts'))
  render(panel()); await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(getPlannedCashScenarioChoices).toHaveBeenCalledTimes(2))
  expect(previewPlannedCash).toHaveBeenCalledOnce(); expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('')
  expect(screen.queryByRole('dialog', { name: 'Файли планування коштів' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат планування коштів' })).toBeNull()
  await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByRole('region', { name: 'Результат планування коштів' })
  expect(previewPlannedCash).toHaveBeenCalledTimes(2)
})
it.each(['empty', 'missing-current', 'currency-conflict'])('preserves %s server availability independently of the chosen scenario', async state => {
  const report = state === 'empty' ? plannedCashEmptyReport('DdsPayouts') : state === 'currency-conflict' ? plannedCashConflictReport() : plannedCashReport('DdsPayouts')
  if (state === 'missing-current') {
    report.CurrentAvailable = false; report.Complete = false; report.Code = 'planned_cash_input_unavailable'; report.AvailabilityMessage = 'Дані синку ще не готові для формування повного звіту.'
    report.Proof.Current = { Available: false, CompletePublication: false, DatedOpeningVerified: false, CompletedMovementMonths: 0 }; report.Proof.ComparisonCurrencyStatus = 'Unverified'
    const close = (cell: typeof report.Totals[number], i: number) => i === 0 ? { ...cell, Available: false, Value: null, ExactValue: null, FormattedValue: null } : cell
    report.Totals = report.Totals.map(close); report.Rows = report.Rows.map(row => ({ ...row, Cells: row.Cells.map(close) }))
  }
  vi.mocked(previewPlannedCash).mockResolvedValueOnce(report); render(panel()); await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат планування коштів' }); expect(within(result).getByText(report.AvailabilityMessage!)).toBeTruthy()
  if (state === 'missing-current') expect(within(result).getAllByText('100.00').length).toBeGreaterThan(0)
  if (state === 'currency-conflict') expect(within(result).queryByText('100.00')).toBeNull()
})
it('aborts an old caller list and never publishes its labels under the new owner', async () => {
  let finish!: (page: PlannedCashScenarioChoices) => void
  vi.mocked(getPlannedCashScenarioChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); await waitFor(() => expect(getPlannedCashScenarioChoices).toHaveBeenCalledOnce()); const oldSignal = vi.mocked(getPlannedCashScenarioChoices).mock.calls[0][3]
  view.rerender(panel('DdsPayouts', 'owner-b')); expect(oldSignal.aborted).toBe(true)
  const old = plannedCashChoices(); old.Choices[0].Caption = 'Сценарій старого користувача'; await act(async () => { finish(old) })
  await screen.findByRole('combobox'); expect(screen.queryByText('Сценарій старого користувача')).toBeNull(); expect(previewPlannedCash).not.toHaveBeenCalled()
})
it('changing an actual selected token clears files even when the human captions are equal', async () => {
  const page = plannedCashChoices(); page.Choices.push({ Key: 'second-encrypted-key', Caption: page.Choices[0].Caption }); vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce(page)
  render(panel()); await selectScenario(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли планування коштів' })
  await selectScenario('second-encrypted-key'); expect(screen.queryByRole('dialog', { name: 'Файли планування коштів' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат планування коштів' })).toBeNull()
})
