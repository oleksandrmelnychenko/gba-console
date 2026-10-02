import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewOverdueReceivables } from '../api/overdueReceivablesApi'
import { overdueReceivablesCapability, overdueReceivablesEmptyReport, overdueReceivablesMissingReport, overdueReceivablesReport, overdueReceivablesUnknownCurrentReport } from '../data/overdueReceivables.test-fixtures'
import type { ReportDocument } from '../types'
import { OverdueReceivablesReportPanel } from './OverdueReceivablesReportPanel'
vi.mock('../api/overdueReceivablesApi', () => ({ previewOverdueReceivables: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли простроченої дебіторки"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewOverdueReceivables).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><OverdueReceivablesReportPanel capability={overdueReceivablesCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('renders four server formatted values verbatim and exports both files from the same run under StrictMode', async () => {
  const report = overdueReceivablesReport(); vi.mocked(previewOverdueReceivables).mockResolvedValue(report)
  render(<StrictMode>{panel()}</StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат простроченої дебіторки' })
  const total = within(result).getByLabelText('Підсумок')
  expect(within(total).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(total).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['1', '3', '-66.67', '-2'])
  const groups = within(result).getByRole('table', { name: 'Контрагенти' })
  expect(within(groups).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Контрагент', ...report.Columns.map(column => column.Caption)])
  expect(within(groups).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Контрагент із OUR', '1', '3', '-66.67', '-2'])
  expect(screen.queryByText('-200/3')).toBeNull(); expect(screen.queryByText(report.Proof.OpeningRunId!)).toBeNull(); expect(screen.getByText(/Суми в EUR за комерційними курсами системи/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли простроченої дебіторки' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewOverdueReceivables).toHaveBeenCalledWith(overdueReceivablesCapability(), report.Month, expect.any(AbortSignal)); expect(previewOverdueReceivables).toHaveBeenCalledOnce()
})
it('shows confirmed empty while preserving the original independent hundred and absolute zero', async () => {
  vi.mocked(previewOverdueReceivables).mockResolvedValue(overdueReceivablesEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('У вибраних періодах немає простроченої дебіторської заборгованості.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '100.00', '0'])
  expect(screen.queryByText('Звіт неповний: залишки, рухи, умови документів або валютні курси ще не підтверджені.')).toBeNull()
  expect(screen.queryByText('Не всі показники вдалося розрахувати.')).toBeNull()
})
it('shows initial missing publications as incomplete rather than zero or a confirmed empty report', async () => {
  vi.mocked(previewOverdueReceivables).mockResolvedValue(overdueReceivablesMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: залишки, рухи, умови документів або валютні курси ще не підтверджені.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText('У вибраних періодах немає простроченої дебіторської заборгованості.')).toBeNull()
})
it('keeps the independent prior-empty percent guard and exposes unknown current balance', async () => {
  vi.mocked(previewOverdueReceivables).mockResolvedValue(overdueReceivablesUnknownCurrentReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: залишки, рухи, умови документів або валютні курси ще не підтверджені.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '100.00', '—'])
  expect(screen.queryByText('У вибраних періодах немає простроченої дебіторської заборгованості.')).toBeNull()
})
it('shows decimal projection unavailable while keeping financial completeness separate', async () => {
  const report = overdueReceivablesReport(); report.Code = 'decimal_projection_unavailable'
  report.Cells[0] = { ...report.Cells[0], Value: null, FormattedValue: null, Available: false,
    ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  vi.mocked(previewOverdueReceivables).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText('Звіт неповний: залишки, рухи, умови документів або валютні курси ще не підтверджені.')).toBeNull()
})
it('aborts deferred old caller output without clearing a newer loading state or leaking old links', async () => {
  let oldDone!: (value: ReturnType<typeof overdueReceivablesReport>) => void
  let newDone!: (value: ReturnType<typeof overdueReceivablesReport>) => void
  vi.mocked(previewOverdueReceivables).mockImplementationOnce(() => new Promise(done => { oldDone = done }))
    .mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewOverdueReceivables).mock.calls[0][2]!
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(overdueReceivablesReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат простроченої дебіторки' })).toBeNull()
  await act(async () => { newDone(overdueReceivablesReport()) })
  expect(screen.getByRole('region', { name: 'Результат простроченої дебіторки' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли простроченої дебіторки' })).toBeNull()
})
it('clears previous cells and download scope after month or permission changes', async () => {
  vi.mocked(previewOverdueReceivables).mockResolvedValue(overdueReceivablesReport())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли простроченої дебіторки' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли простроченої дебіторки' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel('owner-a', false)); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewOverdueReceivables).toHaveBeenCalledOnce()
})

it('rejects a returned unsafe file path before publishing cells or download links', async () => {
  const report = overdueReceivablesReport(); report.DocumentURL = 'javascript:alert(1)'
  vi.mocked(previewOverdueReceivables).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: 'Результат простроченої дебіторки' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли простроченої дебіторки' })).toBeNull()
  expect(previewOverdueReceivables).toHaveBeenCalledOnce()
})
