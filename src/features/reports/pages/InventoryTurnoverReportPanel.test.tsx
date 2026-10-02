import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewInventoryTurnover } from '../api/inventoryTurnoverApi'
import { inventoryTurnoverCapability, inventoryTurnoverConflictReport, inventoryTurnoverEmptyReport,
  inventoryTurnoverMissingCurrentNullPreviousReport, inventoryTurnoverMissingCurrentReport, inventoryTurnoverMissingReport,
  inventoryTurnoverReport, inventoryTurnoverUndefinedReport, inventoryTurnoverZeroReport } from '../data/inventoryTurnover.test-fixtures'
import type { ReportDocument } from '../types'
import { InventoryTurnoverReportPanel } from './InventoryTurnoverReportPanel'

vi.mock('../api/inventoryTurnoverApi', () => ({ previewInventoryTurnover: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли оборачуваності запасів"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewInventoryTurnover).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><InventoryTurnoverReportPanel capability={inventoryTurnoverCapability()} initialMonth="2026-09"
    canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('shows the four original server display strings and same-run XLSX/PDF without browser arithmetic', async () => {
  const report = inventoryTurnoverReport(); vi.mocked(previewInventoryTurnover).mockResolvedValue(report); render(<StrictMode>{panel()}</StrictMode>)
  expect((screen.getByLabelText('Місяць') as HTMLInputElement).type).toBe('month'); expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const result = await screen.findByRole('region', { name: 'Результат оборачуваності запасів' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.25', '0.2', '25.00', '0.05'])
  const files = screen.getByRole('dialog', { name: 'Файли оборачуваності запасів' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(screen.getByText(/Стоимость \(Упр\); Сумма \(грн\)/)).toBeTruthy()
  expect(previewInventoryTurnover).toHaveBeenCalledWith(inventoryTurnoverCapability(), report.Month, 'owner-a', expect.any(AbortSignal))
  expect(previewInventoryTurnover).toHaveBeenCalledOnce(); expect(screen.queryByText(report.Proof.InputWitnessSha256)).toBeNull()
})
it.each(['empty', 'missing', 'undefined', 'zero', 'conflict'])('keeps the %s state distinct from missing numeric data', async kind => {
  const report = kind === 'empty' ? inventoryTurnoverEmptyReport() : kind === 'missing' ? inventoryTurnoverMissingReport()
    : kind === 'undefined' ? inventoryTurnoverUndefinedReport() : kind === 'zero' ? inventoryTurnoverZeroReport() : inventoryTurnoverConflictReport(true)
  vi.mocked(previewInventoryTurnover).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат оборачуваності запасів' })
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(report.Cells.map(cell => cell.FormattedValue ?? '—'))
  if (report.AvailabilityMessage) expect(within(result).getByText(report.AvailabilityMessage)).toBeTruthy()
  if (kind === 'empty') expect(within(result).getByText('Поточний період: підтверджено відсутність даних.')).toBeTruthy()
  if (kind === 'missing') expect(within(result).getByText('Поточний період: дані синку ще не готові.')).toBeTruthy()
  if (kind === 'undefined') expect(within(result).getByText('Поточний період: показник не визначений.')).toBeTruthy()
  if (kind === 'zero') expect(within(result).queryByRole('alert')).toBeNull()
  if (kind === 'conflict') expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.25', '0', '—', '—'])
})
it.each(['zero', 'null'])('keeps previous %s and its independent server100 visible beside genuinely missing current input', async kind => {
  const report = kind === 'zero' ? inventoryTurnoverMissingCurrentReport(true) : inventoryTurnoverMissingCurrentNullPreviousReport()
  vi.mocked(previewInventoryTurnover).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат оборачуваності запасів' }), cells = within(result).getAllByRole('cell')
  expect(cells.map(cell => cell.textContent)).toEqual(['—', kind === 'zero' ? '0' : '—', '100.00', '—'])
  expect(cells[0].title).toBe('Недоступні дані'); expect(cells[1].title).toBe(kind === 'null' ? 'У періоді немає даних' : '')
  expect(within(result).queryByText('За обрані періоди даних немає.')).toBeNull()
})
it('clears old values/files after month edit and refuses the server domain boundary before another request', async () => {
  vi.mocked(previewInventoryTurnover).mockResolvedValue(inventoryTurnoverReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли оборачуваності запасів' })
  fireEvent.change(screen.getByLabelText('Місяць'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли оборачуваності запасів' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат оборачуваності запасів' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Місяць'), { target: { value: '3999-01' } })
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true); expect(previewInventoryTurnover).toHaveBeenCalledOnce()
})
it('aborts an old caller and ignores late files without clearing the new active request', async () => {
  let oldDone!: (value: ReturnType<typeof inventoryTurnoverReport>) => void, newDone!: (value: ReturnType<typeof inventoryTurnoverReport>) => void
  vi.mocked(previewInventoryTurnover).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewInventoryTurnover).mock.calls[0][3]
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(inventoryTurnoverReport()) }); expect(loading.mock.calls.at(-1)?.[0]).toBe(true)
  expect(screen.queryByRole('region', { name: 'Результат оборачуваності запасів' })).toBeNull()
  await act(async () => { newDone(inventoryTurnoverReport()) }); expect(screen.getByRole('region', { name: 'Результат оборачуваності запасів' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли оборачуваності запасів' })).toBeNull()
})
it.each(['permission', 'month', 'unmount'])('cancels a deferred preview on %s and never displays its late result', async reason => {
  let done!: (value: ReturnType<typeof inventoryTurnoverReport>) => void
  vi.mocked(previewInventoryTurnover).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const pending = vi.mocked(previewInventoryTurnover).mock.calls[0][3]
  if (reason === 'permission') view.rerender(panel('owner-a', false))
  else if (reason === 'month') fireEvent.change(screen.getByLabelText('Місяць'), { target: { value: '2026-10' } })
  else view.unmount()
  expect(pending.aborted).toBe(true); await act(async () => { done(inventoryTurnoverReport()) })
  expect(screen.queryByRole('region', { name: 'Результат оборачуваності запасів' })).toBeNull(); expect(screen.queryByRole('dialog', { name: 'Файли оборачуваності запасів' })).toBeNull()
})
it('does not retry ambiguous failure and rejects unsafe or stale results before exposing links', async () => {
  const unsafe = inventoryTurnoverReport(); unsafe.DocumentURL = '//untrusted.test/file'
  const stale = inventoryTurnoverReport(); stale.Month = '2026-10'
  vi.mocked(previewInventoryTurnover).mockRejectedValueOnce(new Error('Спробуйте ще раз.')).mockResolvedValueOnce(unsafe).mockResolvedValueOnce(stale)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Спробуйте ще раз.')
  expect(previewInventoryTurnover).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/непідтверджений результат/); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/непідтверджений результат/); expect(screen.queryByRole('dialog', { name: 'Файли оборачуваності запасів' })).toBeNull()
})
it('does not generate without a caller or with an unimplemented capability', () => {
  const view = render(panel('', true)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(previewInventoryTurnover).not.toHaveBeenCalled()
  view.rerender(<MantineProvider env="test"><I18nProvider><InventoryTurnoverReportPanel capability={{ ...inventoryTurnoverCapability(), RuntimeImplemented: false }}
    initialMonth="2026-09" canGenerate callerKey="owner-a" /></I18nProvider></MantineProvider>)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('keeps only one active preview even if generate is clicked repeatedly before completion', async () => {
  let done!: (value: ReturnType<typeof inventoryTurnoverReport>) => void
  vi.mocked(previewInventoryTurnover).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  render(panel()); const generate = screen.getByRole('button', { name: 'Сформувати' }); fireEvent.click(generate); fireEvent.click(generate)
  expect(previewInventoryTurnover).toHaveBeenCalledOnce(); await act(async () => { done(inventoryTurnoverReport()) })
  expect(screen.getByRole('dialog', { name: 'Файли оборачуваності запасів' })).toBeTruthy()
})
