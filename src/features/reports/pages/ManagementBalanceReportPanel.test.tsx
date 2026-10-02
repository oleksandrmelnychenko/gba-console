import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewManagementBalance } from '../api/managementBalanceApi'
import type { ManagementBalanceKind } from '../data/managementBalance'
import { managementBalanceCapability, managementBalanceEmptyReport, managementBalanceMissingReport, managementBalanceReport } from '../data/managementBalance.test-fixtures'
import type { ReportDocument } from '../types'
import { ManagementBalanceReportPanel } from './ManagementBalanceReportPanel'
vi.mock('../api/managementBalanceApi', () => ({ previewManagementBalance: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли заборгованості"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewManagementBalance).mockReset())
function panel(kind: ManagementBalanceKind = 'monthlyReceivables', callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><ManagementBalanceReportPanel capability={managementBalanceCapability(kind)} initialMonth="2026-09"
    canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it.each(['monthlyReceivables', 'quarterlyManagementPayables'] as ManagementBalanceKind[])('shows %s four server-formatted cells, names and same-run files without browser arithmetic', async kind => {
  const report = managementBalanceReport(kind); vi.mocked(previewManagementBalance).mockResolvedValue(report); render(<StrictMode>{panel(kind)}</StrictMode>)
  expect(screen.queryByRole('combobox')).toBeNull(); expect(screen.queryByLabelText('Покупець')).toBeNull(); expect(screen.queryByLabelText('Вид договору')).toBeNull()
  const input = screen.getByLabelText(kind === 'monthlyReceivables' ? 'Місяць' : 'Квартал') as HTMLInputElement
  expect(input.type).toBe(kind === 'monthlyReceivables' ? 'month' : 'text'); expect(input.value).toBe(report.Period)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат управлінської заборгованості' }), total = within(result).getByLabelText('Підсумок')
  expect(within(total).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(total).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['5', '10', '-50.00', '-5'])
  expect(within(result).getByText('Контрагент із OUR')).toBeTruthy(); expect(screen.queryByText(report.Rows[0].Key)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' })); const files = screen.getByRole('dialog', { name: 'Файли заборгованості' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewManagementBalance).toHaveBeenCalledWith(managementBalanceCapability(kind), report.Period, 'owner-a', expect.any(AbortSignal))
  expect(previewManagementBalance).toHaveBeenCalledOnce()
})
it('shows confirmed empty without fake hundred or zero and without a missing-input warning', async () => {
  vi.mocked(previewManagementBalance).mockResolvedValue(managementBalanceEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText('На вибрані межі немає заборгованості цього виду.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—']); expect(screen.queryByText(/Звіт неповний/)).toBeNull()
})
it('shows missing publications distinctly from an empty balance', async () => {
  vi.mocked(previewManagementBalance).mockResolvedValue(managementBalanceMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(screen.getByText('Поточна межа: дані ще не підтверджені.')).toBeTruthy(); expect(screen.getByText('Попередня межа: дані ще не підтверджені.')).toBeTruthy()
  expect(screen.queryByText('На вибрані межі немає заборгованості цього виду.')).toBeNull(); expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
})
it('preserves server previous-zero hundred independently from missing current amounts', async () => {
  const report = managementBalanceReport(); report.Complete = false; report.Code = 'balance_input_unavailable'
  report.Inputs.Current = { ...report.Inputs.Current, Available: false, PhysicalRows: null }
  report.Totals = report.Totals.map((cell, index) => index === 1 ? { ...cell, Value: '0', FormattedValue: '0', ExactValue: { Numerator: '0', Denominator: '1' } }
    : index === 2 ? { ...cell, Value: '100', FormattedValue: '100.00', ExactValue: { Numerator: '100', Denominator: '1' } }
    : { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null })
  report.Rows[0].Cells = structuredClone(report.Totals); vi.mocked(previewManagementBalance).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(within(screen.getByLabelText('Підсумок')).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100.00', '—'])
})
it('separates unknown captions and decimal projection from complete coverage', async () => {
  const report = managementBalanceReport(); report.Rows[0].Caption = null; report.Rows[0].NameAvailable = false; report.CounterpartyNamesComplete = false
  report.Code = 'decimal_projection_unavailable'; report.Totals[0] = { ...report.Totals[0], Value: null, FormattedValue: null, Available: false,
    ExactValue: { Numerator: '100000000000000000000000000000', Denominator: '1' } }
  vi.mocked(previewManagementBalance).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Назва недоступна'); expect(screen.getByText('Не всі показники вдалося розрахувати.')).toBeTruthy()
  expect(screen.queryByText(/Звіт неповний/)).toBeNull(); expect(screen.queryByText(report.Totals[0].ExactValue!.Numerator)).toBeNull()
})
it('clears values/files on period edits and refuses malformed quarters before a second request', async () => {
  vi.mocked(previewManagementBalance).mockResolvedValue(managementBalanceReport('quarterlyManagementPayables')); render(panel('quarterlyManagementPayables'))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли заборгованості' })
  fireEvent.change(screen.getByLabelText('Квартал'), { target: { value: '2026-Q4' } })
  expect(screen.queryByRole('dialog', { name: 'Файли заборгованості' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат управлінської заборгованості' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Квартал'), { target: { value: '2026-Q5' } })
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true); expect(previewManagementBalance).toHaveBeenCalledOnce()
})
it('aborts old caller and ignores late files without clearing the new loading state', async () => {
  let oldDone!: (value: ReturnType<typeof managementBalanceReport>) => void, newDone!: (value: ReturnType<typeof managementBalanceReport>) => void
  vi.mocked(previewManagementBalance).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('monthlyReceivables', 'owner-a', true, loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewManagementBalance).mock.calls[0][3]
  view.rerender(panel('monthlyReceivables', 'owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await act(async () => { oldDone(managementBalanceReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат управлінської заборгованості' })).toBeNull()
  await act(async () => { newDone(managementBalanceReport()) }); expect(screen.getByRole('region', { name: 'Результат управлінської заборгованості' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли заборгованості' })).toBeNull()
})
it('aborts pending permission-revoked response and never shows its files', async () => {
  let done!: (value: ReturnType<typeof managementBalanceReport>) => void
  vi.mocked(previewManagementBalance).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const oldSignal = vi.mocked(previewManagementBalance).mock.calls[0][3]
  view.rerender(panel('monthlyReceivables', 'owner-a', false)); expect(oldSignal.aborted).toBe(true)
  await act(async () => { done(managementBalanceReport()) }); expect(screen.queryByRole('dialog', { name: 'Файли заборгованості' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат управлінської заборгованості' })).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('refuses another period or unsafe mock delivery before opening files', async () => {
  const report = managementBalanceReport(); report.Period = '2026-10'; vi.mocked(previewManagementBalance).mockResolvedValueOnce(report)
  const unsafe = managementBalanceReport(); unsafe.DocumentURL = '//untrusted.test/file'; vi.mocked(previewManagementBalance).mockResolvedValueOnce(unsafe)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  expect(screen.queryByRole('dialog', { name: 'Файли заборгованості' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат управлінської заборгованості' })).toBeNull()
})
