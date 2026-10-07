import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewCashAggregateBalance } from '../api/cashAggregateBalanceApi'
import { cashAggregateCapability, cashAggregateCells, cashAggregateReport, missingCashAggregatePoint } from '../data/cashAggregateBalance.test-fixtures'
import type { CashAggregateBalanceReport } from '../data/cashAggregateBalance'
import { CashAggregateBalanceReportPanel } from './CashAggregateBalanceReportPanel'

vi.mock('../api/cashAggregateBalanceApi', () => ({ previewCashAggregateBalance: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: {
  opened: boolean; document?: { DocumentURL?: string; PdfDocumentURL?: string }
}) => opened ? <div role="dialog" aria-label="Файли залишків"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewCashAggregateBalance).mockReset())
function panel(callerKey = 'caller-a', canGenerate = true) {
  return <MantineProvider env="test"><I18nProvider><CashAggregateBalanceReportPanel capability={cashAggregateCapability()}
    initialPeriod="2026-09-30" canGenerate={canGenerate} callerKey={callerKey} /></I18nProvider></MantineProvider>
}
it('shows horizontal account rows and server recomputed totals with four exact columns from one preview and both files', async () => {
  const result = cashAggregateReport()
  vi.mocked(previewCashAggregateBalance).mockResolvedValue(result)
  render(panel())
  expect((screen.getByLabelText('Період') as HTMLInputElement).type).toBe('date')
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const region = await screen.findByRole('region', { name: 'Результат сукупного залишку коштів' })
  const rows = within(region).getAllByRole('row')
  expect(rows).toHaveLength(4)
  expect(within(rows[0]).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'БанковскийСчетКасса', 'Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(rows[1]).getByRole('rowheader').textContent).toContain(result.Rows[0].Account.Id)
  expect(within(rows[2]).getByRole('rowheader').textContent).toContain(result.Rows[1].Account.Id)
  expect(within(rows[3]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['210', '125', '68,00', '85'])
  expect(vi.mocked(previewCashAggregateBalance)).toHaveBeenCalledWith(cashAggregateCapability(), '2026-09-30')
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли залишків' })
  expect(files.textContent).toContain(result.DocumentURL); expect(files.textContent).toContain(result.PdfDocumentURL)
  expect(previewCashAggregateBalance).toHaveBeenCalledOnce()
})
it('shows unknown current cells and propagated subtotal NULL without hiding the account or inventing zero', async () => {
  const result = cashAggregateReport(), row = result.Rows[0]
  row.Legs[0].Current = missingCashAggregatePoint()
  row.Inputs.Current = { Available: false, Amount: null, Currency: null, IncludedLegs: 2, KnownLegs: 1, Code: 'period_not_published' }
  row.Cells = cashAggregateCells([null, '75', null, null]); row.CalculationCode = 'period_coverage_unavailable'
  result.Totals.Cells = cashAggregateCells([null, '125', null, null])
  result.Totals.Inputs.Current = { ...row.Inputs.Current, IncludedLegs: 3, KnownLegs: 2 }; result.Totals.CalculationCode = 'period_coverage_unavailable'
  vi.mocked(previewCashAggregateBalance).mockResolvedValue(result)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const region = await screen.findByRole('region', { name: 'Результат сукупного залишку коштів' })
  const rows = within(region).getAllByRole('row')
  expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '75', '—', '—'])
  expect(within(rows[3]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '125', '—', '—'])
  expect(within(region).getByText(/Невідомі залишки не прирівнюються до нуля/)).toBeTruthy()
})
it('retains separate current and previous point clocks rather than claiming a common update', async () => {
  const result = cashAggregateReport()
  vi.mocked(previewCashAggregateBalance).mockResolvedValue(result)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат сукупного залишку коштів' })
  const summary = screen.getAllByText(/^Стан даних:/)[0]
  fireEvent.click(summary)
  const details = summary.closest('details')!
  const clocks = within(details).getAllByText(/^Час оновлення:/)
  expect(clocks.length).toBe(4)
  expect(clocks[0].textContent).toContain('01.10.')
  expect(clocks[1].textContent).toContain('01.07.')
})
it('clears preview and pending export on date or caller change, preserving no stale signed files', async () => {
  vi.mocked(previewCashAggregateBalance).mockResolvedValue(cashAggregateReport())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли залишків' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-09-29' } })
  expect(screen.queryByRole('region', { name: 'Результат сукупного залишку коштів' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли залишків' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  vi.mocked(previewCashAggregateBalance).mockResolvedValue(cashAggregateReport('2026-09-29'))
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат сукупного залишку коштів' })
  view.rerender(panel('caller-b'))
  expect(screen.queryByRole('region', { name: 'Результат сукупного залишку коштів' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
})
it('ignores a late preview after session or permission changes and prevents generation without permission', async () => {
  let resolve!: (value: CashAggregateBalanceReport) => void
  vi.mocked(previewCashAggregateBalance).mockReturnValue(new Promise(done => { resolve = done }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(previewCashAggregateBalance).toHaveBeenCalledOnce())
  view.rerender(panel('caller-b', false))
  await act(async () => { resolve(cashAggregateReport()) })
  expect(screen.queryByRole('region', { name: 'Результат сукупного залишку коштів' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли залишків' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Переглянути' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  expect(previewCashAggregateBalance).toHaveBeenCalledOnce()
})
