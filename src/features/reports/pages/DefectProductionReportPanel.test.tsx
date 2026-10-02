import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewDefectProduction } from '../api/defectProductionApi'
import { defectProductionCapability, defectProductionEmptyReport, defectProductionMissingReport, defectProductionReport, defectProductionZeroReport, defectProductionNullPreviousReport, defectProductionUnknownCurrentZeroPreviousReport, defectProductionUnknownCurrentNullPreviousReport } from '../data/defectProduction.test-fixtures'
import type { ReportDocument } from '../types'
import { DefectProductionReportPanel } from './DefectProductionReportPanel'
vi.mock('../api/defectProductionApi', () => ({ previewDefectProduction: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли звіту браку"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewDefectProduction).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><DefectProductionReportPanel capability={defectProductionCapability()} initialMonth="2026-09"
    canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('shows four server-formatted cells, same-run files without browser arithmetic under StrictMode', async () => {
  const report = defectProductionReport(); vi.mocked(previewDefectProduction).mockResolvedValue(report); render(<StrictMode>{panel()}</StrictMode>)
  expect(screen.queryByRole('combobox')).toBeNull(); expect(screen.queryByLabelText('Покупець')).toBeNull(); expect(screen.queryByLabelText('Вид договору')).toBeNull()
  const input = screen.getByLabelText('Місяць') as HTMLInputElement
  expect(input.type).toBe('month'); expect(input.value).toBe(report.Month)
  expect(screen.getByText('Порівняння календарних місяців у GBA. Інші періоди та збережені налаштування 1С ще не підтримуються.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат звіту браку' }), total = result
  expect(within(total).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(total).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.2', '0.4', '-50.00', '-0.2'])
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' })); const files = screen.getByRole('dialog', { name: 'Файли звіту браку' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewDefectProduction).toHaveBeenCalledWith(defectProductionCapability(), report.Month, 'owner-a', expect.any(AbortSignal))
  expect(previewDefectProduction).toHaveBeenCalledOnce()
})
it('shows confirmed logical NULL scalar with server-supplied changes without a missing-input warning', async () => {
  vi.mocked(previewDefectProduction).mockResolvedValue(defectProductionEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText('У вибраних місяцях немає виробничих даних.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '100.00', '0']); expect(screen.queryByText(/Звіт неповний/)).toBeNull()
  expect(screen.getByText('Поточний період: підтверджено відсутність даних.')).toBeTruthy()
  expect(screen.getAllByRole('cell')[0].title).toBe('У періоді немає даних')
})
it('shows missing publications distinctly from an empty monthly production query', async () => {
  vi.mocked(previewDefectProduction).mockResolvedValue(defectProductionMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(screen.getByText('Поточний період: дані ще не підтверджені.')).toBeTruthy(); expect(screen.getByText('Попередній період: дані ще не підтверджені.')).toBeTruthy()
  expect(screen.queryByText('У вибраних місяцях немає виробничих даних.')).toBeNull(); expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
})
it('preserves server previous-zero hundred independently from missing current amounts', async () => {
  const report=defectProductionUnknownCurrentZeroPreviousReport()
  vi.mocked(previewDefectProduction).mockResolvedValue(report);render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(within(screen.getByRole('region', { name: 'Результат звіту браку' })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100.00', '—'])
})
it('separates complete coverage from unavailable decimal projection and never prints exact-number proof', async () => {
  const report = defectProductionReport(); report.Code = 'decimal_projection_unavailable'
  report.Cells[0] = { ...report.Cells[0], Value: null, FormattedValue: null, Available: false,
    ExactValue: { Numerator: '100000000000000000000000000000', Denominator: '1' } }
  vi.mocked(previewDefectProduction).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText(/Звіт неповний/)).toBeNull(); expect(screen.queryByText(report.Cells[0].ExactValue!.Numerator)).toBeNull()
  expect(screen.getAllByRole('cell')[0].title).toBe('Недоступні дані')
})
it('clears values/files on month edits and refuses the physical bound before a second request',async()=>{
  vi.mocked(previewDefectProduction).mockResolvedValue(defectProductionReport());render(panel())
  fireEvent.click(screen.getByRole('button',{name:'Сформувати'}));await screen.findByRole('dialog',{name:'Файли звіту браку'})
  fireEvent.change(screen.getByLabelText('Місяць'),{target:{value:'2026-10'}})
  expect(screen.queryByRole('dialog',{name:'Файли звіту браку'})).toBeNull();expect(screen.queryByRole('region',{name:'Результат звіту браку'})).toBeNull()
  fireEvent.change(screen.getByLabelText('Місяць'),{target:{value:'7999-12'}})
  expect((screen.getByRole('button',{name:'Сформувати'}) as HTMLButtonElement).disabled).toBe(true);expect(previewDefectProduction).toHaveBeenCalledOnce()
})
it('aborts old caller and ignores late files without clearing the new loading state', async () => {
  let oldDone!: (value: ReturnType<typeof defectProductionReport>) => void, newDone!: (value: ReturnType<typeof defectProductionReport>) => void
  vi.mocked(previewDefectProduction).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewDefectProduction).mock.calls[0][3]
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await act(async () => { oldDone(defectProductionReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат звіту браку' })).toBeNull()
  await act(async () => { newDone(defectProductionReport()) }); expect(screen.getByRole('region', { name: 'Результат звіту браку' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли звіту браку' })).toBeNull()
})
it('aborts pending permission-revoked response and never shows its files', async () => {
  let done!: (value: ReturnType<typeof defectProductionReport>) => void
  vi.mocked(previewDefectProduction).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const oldSignal = vi.mocked(previewDefectProduction).mock.calls[0][3]
  view.rerender(panel('owner-a', false)); expect(oldSignal.aborted).toBe(true)
  await act(async () => { done(defectProductionReport()) }); expect(screen.queryByRole('dialog', { name: 'Файли звіту браку' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат звіту браку' })).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('refuses another period or unsafe mock delivery before opening files', async () => {
  const report = defectProductionReport(); report.Month = '2026-10'; vi.mocked(previewDefectProduction).mockResolvedValueOnce(report)
  const unsafe = defectProductionReport(); unsafe.DocumentURL = '//untrusted.test/file'; vi.mocked(previewDefectProduction).mockResolvedValueOnce(unsafe)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  expect(screen.queryByRole('dialog', { name: 'Файли звіту браку' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат звіту браку' })).toBeNull()
})

it.each(['zero','null'])('displays server-confirmed %s with prior-zero change as data rather than a missing publication',async kind=>{
  const report=kind==='zero'?defectProductionZeroReport():defectProductionNullPreviousReport();vi.mocked(previewDefectProduction).mockResolvedValue(report);render(panel())
  fireEvent.click(screen.getByRole('button',{name:'Переглянути'}));await screen.findByRole('region',{name:'Результат звіту браку'})
  expect(within(screen.getByRole('region', { name: 'Результат звіту браку' })).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(kind==='zero'?['0','0','100.00','0']:['0.2','—','100.00','0.2'])
  expect(screen.queryByText(/Звіт неповний/)).toBeNull()
})
it('leaves request retry explicit after failure and never opens ambiguous files',async()=>{
  vi.mocked(previewDefectProduction).mockRejectedValueOnce(new Error('Спробуйте ще раз.')).mockResolvedValueOnce(defectProductionReport());render(panel())
  fireEvent.click(screen.getByRole('button',{name:'Сформувати'}));await screen.findByText('Спробуйте ще раз.')
  expect(previewDefectProduction).toHaveBeenCalledOnce();expect(screen.queryByRole('dialog',{name:'Файли звіту браку'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Переглянути'}));await screen.findByRole('region',{name:'Результат звіту браку'})
  expect(previewDefectProduction).toHaveBeenCalledTimes(2)
})

it('refuses generation without a loaded caller or genuine executable runtime', () => {
  const view = render(panel('', true))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(previewDefectProduction).not.toHaveBeenCalled()
  view.rerender(<MantineProvider env="test"><I18nProvider><DefectProductionReportPanel capability={{ ...defectProductionCapability(), RuntimeImplemented: false }}
    initialMonth="2026-09" canGenerate callerKey="owner-a" /></I18nProvider></MantineProvider>)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Сервер ще не підтримує формування цього конструктора.')).toBeTruthy()
})
it('aborts a pending request on month change and discards its late same-run files', async () => {
  let done!: (value: ReturnType<typeof defectProductionReport>) => void
  vi.mocked(previewDefectProduction).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const pending = vi.mocked(previewDefectProduction).mock.calls[0][3]
  // Programmatic edits exercise the isolation guard even while the input is disabled in the UI.
  fireEvent.change(screen.getByLabelText('Місяць'), { target: { value: '2026-10' } }); expect(pending.aborted).toBe(true)
  await act(async () => { done(defectProductionReport()) })
  expect(screen.queryByRole('region', { name: 'Результат звіту браку' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли звіту браку' })).toBeNull()
})

it('shows current unavailable beside a confirmed NULL previous with independent server100', async () => {
  vi.mocked(previewDefectProduction).mockResolvedValue(defectProductionUnknownCurrentNullPreviousReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  const cells = screen.getAllByRole('cell')
  expect(cells.map(cell => cell.textContent)).toEqual(['—', '—', '100.00', '—'])
  expect(cells[0].title).toBe('Недоступні дані'); expect(cells[1].title).toBe('У періоді немає даних')
  expect(screen.getByText('Попередній період: підтверджено відсутність даних.')).toBeTruthy()
  expect(screen.queryByText('У вибраних місяцях немає виробничих даних.')).toBeNull()
})

it('keeps one active preview and does not turn repeated generate clicks into concurrent report calls', async () => {
  let done!: (value: ReturnType<typeof defectProductionReport>) => void
  vi.mocked(previewDefectProduction).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  render(panel()); const generate = screen.getByRole('button', { name: 'Сформувати' })
  fireEvent.click(generate); fireEvent.click(generate)
  expect(previewDefectProduction).toHaveBeenCalledOnce()
  await act(async () => { done(defectProductionReport()) })
  expect(screen.getByRole('dialog', { name: 'Файли звіту браку' })).toBeTruthy()
})
