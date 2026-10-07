import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewCurrentLiquidity } from '../api/currentLiquidityApi'
import { currentLiquidityCapability, currentLiquidityConflictReport, currentLiquidityEmptyReport,
  currentLiquidityMissingCurrentNullPreviousReport, currentLiquidityMissingCurrentReport, currentLiquidityMissingReport,
  currentLiquidityOverflowReport, currentLiquidityReport, currentLiquidityStatusUnknownReport, currentLiquidityZeroReport } from '../data/currentLiquidity.test-fixtures'
import type { ReportDocument } from '../types'
import { CurrentLiquidityReportPanel } from './CurrentLiquidityReportPanel'

vi.mock('../api/currentLiquidityApi', () => ({ previewCurrentLiquidity: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли поточної ліквідності"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewCurrentLiquidity).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><CurrentLiquidityReportPanel capability={currentLiquidityCapability()}
    initialEndpoints={{ CurrentEndpoint: '2026-10-01', PreviousEndpoint: '2026-09-01' }}
    canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('shows the exact four server display strings and same-run XLSX/PDF without financial arithmetic or a second generation', async () => {
  const report = currentLiquidityReport(); report.Cells[0].FormattedValue = '2.5000000000000000000000000000'
  vi.mocked(previewCurrentLiquidity).mockResolvedValue(report); render(<StrictMode>{panel()}</StrictMode>)
  expect((screen.getByLabelText('Поточна дата') as HTMLInputElement).type).toBe('date')
  expect((screen.getByLabelText('Попередня дата') as HTMLInputElement).type).toBe('date'); expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const result = await screen.findByRole('region', { name: 'Результат поточної ліквідності' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(report.Cells.map(cell => cell.FormattedValue))
  const files = screen.getByRole('dialog', { name: 'Файли поточної ліквідності' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewCurrentLiquidity).toHaveBeenCalledWith(currentLiquidityCapability(), report.CurrentEndpoint, report.PreviousEndpoint, 'owner-a', expect.any(AbortSignal))
  expect(previewCurrentLiquidity).toHaveBeenCalledOnce(); expect(screen.queryByText(report.Proof.InputWitnessSha256)).toBeNull()
  expect(screen.queryByText(report.SourceIdentity.SourceId)).toBeNull(); expect(screen.queryByText(report.Code)).toBeNull()
})
it.each(['empty','missing','status','overflow','zero','conflict'])('keeps the %s state truthful and distinct from a missing zero', async kind => {
  const report = kind === 'empty' ? currentLiquidityEmptyReport() : kind === 'missing' ? currentLiquidityMissingReport()
    : kind === 'status' ? currentLiquidityStatusUnknownReport() : kind === 'overflow' ? currentLiquidityOverflowReport()
      : kind === 'zero' ? currentLiquidityZeroReport() : currentLiquidityConflictReport(true)
  vi.mocked(previewCurrentLiquidity).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат поточної ліквідності' })
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(report.Cells.map(cell => cell.FormattedValue ?? '—'))
  if (report.AvailabilityMessage) expect(within(result).getByText(report.AvailabilityMessage)).toBeTruthy()
  if (kind === 'empty') expect(within(result).getByText('Поточна дата: підтверджено відсутність даних.')).toBeTruthy()
  if (kind === 'missing') expect(within(result).getByText('Поточна дата: дані синку ще не готові.')).toBeTruthy()
  if (kind === 'status') { expect(within(result).getByText('Поточна дата: частина даних ще не визначена.')).toBeTruthy(); expect(within(result).queryByText('Поточна дата: дані синку ще не готові.')).toBeNull() }
  if (kind === 'zero') expect(within(result).queryByRole('alert')).toBeNull()
  if (kind === 'conflict') expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['2.5','0','—','—'])
})
it.each(['zero','null'])('keeps previous %s and its independent server100 next to missing current data', async kind => {
  const report = kind === 'zero' ? currentLiquidityMissingCurrentReport(true) : currentLiquidityMissingCurrentNullPreviousReport()
  vi.mocked(previewCurrentLiquidity).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат поточної ліквідності' }), cells = within(result).getAllByRole('cell')
  expect(cells.map(cell => cell.textContent)).toEqual(['—',kind === 'zero' ? '0' : '—','100.00','—'])
  expect(cells[0].title).toBe('Недоступні дані'); expect(cells[1].title).toBe(kind === 'null' ? 'У періоді немає даних' : '')
  expect(within(result).queryByText('За обрані періоди даних немає.')).toBeNull()
})
it.each(['Поточна дата','Попередня дата'])('clears prior results and files after editing %s and rejects an unsupported day before HTTP', async label => {
  vi.mocked(previewCurrentLiquidity).mockResolvedValue(currentLiquidityReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли поточної ліквідності' })
  fireEvent.change(screen.getByLabelText(label), { target: { value: label === 'Поточна дата' ? '2026-11-01' : '2026-08-01' } })
  expect(screen.queryByRole('dialog', { name: 'Файли поточної ліквідності' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат поточної ліквідності' })).toBeNull()
  fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-10-02' } })
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true); expect(previewCurrentLiquidity).toHaveBeenCalledOnce()
})
it('aborts an old caller and rejects late files while a new caller has a separate active request', async () => {
  let oldDone!: (value: ReturnType<typeof currentLiquidityReport>) => void, newDone!: (value: ReturnType<typeof currentLiquidityReport>) => void
  vi.mocked(previewCurrentLiquidity).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a',true,loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewCurrentLiquidity).mock.calls[0][4]
  view.rerender(panel('owner-b',true,loading)); expect(oldSignal.aborted).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(currentLiquidityReport()) }); expect(loading.mock.calls.at(-1)?.[0]).toBe(true)
  expect(screen.queryByRole('region', { name: 'Результат поточної ліквідності' })).toBeNull()
  await act(async () => { newDone(currentLiquidityReport()) }); expect(screen.getByRole('region', { name: 'Результат поточної ліквідності' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли поточної ліквідності' })).toBeNull()
})
it.each(['permission','current','previous','unmount'])('cancels a deferred preview on %s and hides all late output', async reason => {
  let done!: (value: ReturnType<typeof currentLiquidityReport>) => void
  vi.mocked(previewCurrentLiquidity).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const pending = vi.mocked(previewCurrentLiquidity).mock.calls[0][4]
  if (reason === 'permission') view.rerender(panel('owner-a',false))
  else if (reason === 'current') fireEvent.change(screen.getByLabelText('Поточна дата'), { target: { value: '2026-11-01' } })
  else if (reason === 'previous') fireEvent.change(screen.getByLabelText('Попередня дата'), { target: { value: '2026-08-01' } })
  else view.unmount()
  expect(pending.aborted).toBe(true); await act(async () => { done(currentLiquidityReport()) })
  expect(screen.queryByRole('region', { name: 'Результат поточної ліквідності' })).toBeNull(); expect(screen.queryByRole('dialog', { name: 'Файли поточної ліквідності' })).toBeNull()
})
it('rejects unsafe or stale endpoints before exposing files and never auto-retries an ambiguous generation', async () => {
  const unsafe = currentLiquidityReport(); unsafe.DocumentURL = '//untrusted.test/file'
  const stale = currentLiquidityReport(); stale.PreviousEndpoint = '2026-08-01'
  vi.mocked(previewCurrentLiquidity).mockRejectedValueOnce(new Error('Спробуйте ще раз.')).mockResolvedValueOnce(unsafe).mockResolvedValueOnce(stale)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Спробуйте ще раз.')
  expect(previewCurrentLiquidity).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/непідтверджений результат/); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/непідтверджений результат/); expect(screen.queryByRole('dialog', { name: 'Файли поточної ліквідності' })).toBeNull()
})
it('does not generate without a caller or a supported runtime', () => {
  const view = render(panel('',true)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(previewCurrentLiquidity).not.toHaveBeenCalled()
  view.rerender(<MantineProvider env="test"><I18nProvider><CurrentLiquidityReportPanel capability={{ ...currentLiquidityCapability(), RuntimeImplemented: false }}
    initialEndpoints={{ CurrentEndpoint: '2026-10-01', PreviousEndpoint: '2026-09-01' }} canGenerate callerKey="owner-a" /></I18nProvider></MantineProvider>)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('has one active preview despite duplicate clicks before completion', async () => {
  let done!: (value: ReturnType<typeof currentLiquidityReport>) => void
  vi.mocked(previewCurrentLiquidity).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  render(panel()); const generate = screen.getByRole('button', { name: 'Сформувати' }); fireEvent.click(generate); fireEvent.click(generate)
  expect(previewCurrentLiquidity).toHaveBeenCalledOnce(); await act(async () => { done(currentLiquidityReport()) })
  expect(screen.getByRole('dialog', { name: 'Файли поточної ліквідності' })).toBeTruthy()
})
