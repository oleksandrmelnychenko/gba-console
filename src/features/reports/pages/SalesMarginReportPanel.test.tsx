import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewSalesMargin } from '../api/salesMarginApi'
import { salesMarginCapability, salesMarginEmptyInput, salesMarginReport } from '../data/salesMargin.test-fixtures'
import type { ReportDocument } from '../types'
import { SalesMarginReportPanel } from './SalesMarginReportPanel'

vi.mock('../api/salesMarginApi', () => ({ previewSalesMargin: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли місячної маржі"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewSalesMargin).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><SalesMarginReportPanel capability={salesMarginCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}

it('renders four server formatted cells verbatim and opens both files from the same run under StrictMode', async () => {
  const report = salesMarginReport()
  report.Inputs.Current.CostEur = { Numerator: '30', Denominator: '1' }
  report.Inputs.Previous.CostEur = { Numerator: '40', Denominator: '1' }
  report.Cells[0] = { ...report.Cells[0], Value: '0.7', FormattedValue: '0.7' }
  report.Cells[1] = { ...report.Cells[1], Value: '0.6', FormattedValue: '0.6' }
  report.Cells[2].Value = '16.666666666666666666666666667'; report.Cells[2].FormattedValue = '16.67'
  vi.mocked(previewSalesMargin).mockResolvedValue(report)
  render(<StrictMode>{panel()}</StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат місячної маржі' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.7', '0.6', '16.67', '0.10'])
  expect(screen.queryByText('1/3')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли місячної маржі' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy()
  expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewSalesMargin).toHaveBeenCalledOnce()
})

it('distinguishes confirmed empty scalar cells from unavailable inputs', async () => {
  const report = salesMarginReport()
  report.HasRows = false; report.Code = 'recorded_empty'
  report.Inputs = { Current: salesMarginEmptyInput(), Previous: salesMarginEmptyInput() }
  report.Cells = report.Cells.map((cell, index) => ({ ...cell,
    Value: index < 2 ? null : index === 2 ? '100' : '0', FormattedValue: index < 2 ? null : index === 2 ? '100.00' : '0.00' }))
  vi.mocked(previewSalesMargin).mockResolvedValue(report)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('У вибраних періодах немає продажів і повернень.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '100.00', '0.00'])
  expect(screen.queryByText('Звіт неповний: продажі або собівартість ще не підтверджені.')).toBeNull()
  expect(screen.queryByText('Не всі показники вдалося розрахувати.')).toBeNull()
})

it('keeps a known other period and warns when cost is missing', async () => {
  const report = salesMarginReport()
  report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { ...report.Inputs.Current, UnknownCostGroups: 1, CostEur: null, Available: false }
  report.Cells = report.Cells.map((cell, index) => index === 1 ? cell : { ...cell, Value: null, FormattedValue: null, Available: false })
  vi.mocked(previewSalesMargin).mockResolvedValue(report)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: продажі або собівартість ще не підтверджені.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0.5', '—', '—'])
})

it('warns about an unavailable projection even when financial inputs are complete', async () => {
  const report = salesMarginReport()
  report.Code = 'arithmetic_or_projection_unavailable'
  report.Inputs.Previous.SalesEur = { Numerator: '1', Denominator: '1' }
  report.Inputs.Previous.CostEur = { Numerator: '999999999999999999999999999999', Denominator: '1000000000000000000000000000000' }
  report.Cells[1] = { ...report.Cells[1], Value: '0', FormattedValue: '0' }
  report.Cells[2] = { ...report.Cells[2], Value: null, FormattedValue: null, Available: false }
  report.Cells[3] = { ...report.Cells[3], Value: '0.6', FormattedValue: '0.60' }
  vi.mocked(previewSalesMargin).mockResolvedValue(report)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText('Звіт неповний: продажі або собівартість ще не підтверджені.')).toBeNull()
})

it('aborts a deferred old caller run and does not let its completion clear a newer loading state', async () => {
  let oldDone!: (value: ReturnType<typeof salesMarginReport>) => void
  let newDone!: (value: ReturnType<typeof salesMarginReport>) => void
  vi.mocked(previewSalesMargin).mockImplementationOnce(() => new Promise(done => { oldDone = done }))
    .mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewSalesMargin).mock.calls[0][2]!
  view.rerender(panel('owner-b', true, loading))
  expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(salesMarginReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true)
  expect(screen.queryByRole('region', { name: 'Результат місячної маржі' })).toBeNull()
  await act(async () => { newDone(salesMarginReport()) })
  expect(screen.getByRole('region', { name: 'Результат місячної маржі' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли місячної маржі' })).toBeNull()
})

it('clears links and cells when the month or permission changes', async () => {
  vi.mocked(previewSalesMargin).mockResolvedValue(salesMarginReport())
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли місячної маржі' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли місячної маржі' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel('owner-a', false))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewSalesMargin).toHaveBeenCalledOnce()
})
