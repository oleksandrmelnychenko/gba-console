import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewEmployeeGrossProfit } from '../api/employeeGrossProfitApi'
import { employeeGrossProfitCapability, employeeGrossProfitEmptyReport, employeeGrossProfitMissingReport, employeeGrossProfitReport, employeeGrossProfitUnknownCurrentReport } from '../data/employeeGrossProfit.test-fixtures'
import type { ReportDocument } from '../types'
import { EmployeeGrossProfitReportPanel } from './EmployeeGrossProfitReportPanel'
vi.mock('../api/employeeGrossProfitApi', () => ({ previewEmployeeGrossProfit: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли прибутку на співробітника"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewEmployeeGrossProfit).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><EmployeeGrossProfitReportPanel capability={employeeGrossProfitCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('renders four server formatted values verbatim and exports both files from the same run under StrictMode', async () => {
  const report = employeeGrossProfitReport(); vi.mocked(previewEmployeeGrossProfit).mockResolvedValue(report)
  render(<StrictMode>{panel()}</StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат прибутку на співробітника' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['9.00', '9.00', '0.00', '0.00'])
  expect(screen.queryByText('-200/3')).toBeNull(); expect(screen.queryByText(report.Proof.Current.Sales!.RunId)).toBeNull(); expect(screen.queryByText('EUR')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли прибутку на співробітника' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewEmployeeGrossProfit).toHaveBeenCalledWith(employeeGrossProfitCapability(), report.Month, expect.any(AbortSignal)); expect(previewEmployeeGrossProfit).toHaveBeenCalledOnce()
})
it('shows confirmed empty with original zero and hundred cells without declaring missing data', async () => {
  vi.mocked(previewEmployeeGrossProfit).mockResolvedValue(employeeGrossProfitEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Підтверджено відсутність рядків у вибраних періодах; значення 0 і 100% збережені за правилом звіту.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.00', '0.00', '100.00', '0.00'])
  expect(screen.queryByText('Звіт неповний: публікації продажів, собівартості або історії співробітників ще не підтверджені. Порожні клітинки не означають нуль.')).toBeNull()
  expect(screen.queryByText('Не всі показники вдалося розрахувати.')).toBeNull()
})
it('shows initial missing publications as incomplete rather than zero or a confirmed empty report', async () => {
  vi.mocked(previewEmployeeGrossProfit).mockResolvedValue(employeeGrossProfitMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: публікації продажів, собівартості або історії співробітників ще не підтверджені. Порожні клітинки не означають нуль.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText('Підтверджено відсутність рядків у вибраних періодах; значення 0 і 100% збережені за правилом звіту.')).toBeNull()
})
it('keeps the independent prior-empty percent guard and exposes unknown current value', async () => {
  vi.mocked(previewEmployeeGrossProfit).mockResolvedValue(employeeGrossProfitUnknownCurrentReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: публікації продажів, собівартості або історії співробітників ще не підтверджені. Порожні клітинки не означають нуль.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0.00', '100.00', '—'])
  expect(screen.queryByText('Підтверджено відсутність рядків у вибраних періодах; значення 0 і 100% збережені за правилом звіту.')).toBeNull()
})
it('shows decimal projection unavailable while keeping financial completeness separate', async () => {
  const report = employeeGrossProfitReport(); report.Complete = false; report.Code = 'arithmetic_not_representable'
  report.Cells[2] = { ...report.Cells[2], Value: null, FormattedValue: null, Available: false,
    ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  vi.mocked(previewEmployeeGrossProfit).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText('Звіт неповний: публікації продажів, собівартості або історії співробітників ще не підтверджені. Порожні клітинки не означають нуль.')).toBeNull()
})
it('aborts deferred old caller output without clearing a newer loading state or leaking old links', async () => {
  let oldDone!: (value: ReturnType<typeof employeeGrossProfitReport>) => void
  let newDone!: (value: ReturnType<typeof employeeGrossProfitReport>) => void
  vi.mocked(previewEmployeeGrossProfit).mockImplementationOnce(() => new Promise(done => { oldDone = done }))
    .mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewEmployeeGrossProfit).mock.calls[0][2]!
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(employeeGrossProfitReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат прибутку на співробітника' })).toBeNull()
  await act(async () => { newDone(employeeGrossProfitReport()) })
  expect(screen.getByRole('region', { name: 'Результат прибутку на співробітника' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли прибутку на співробітника' })).toBeNull()
})
it('clears previous cells and download scope after month or permission changes', async () => {
  vi.mocked(previewEmployeeGrossProfit).mockResolvedValue(employeeGrossProfitReport())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли прибутку на співробітника' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли прибутку на співробітника' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel('owner-a', false)); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewEmployeeGrossProfit).toHaveBeenCalledOnce()
})
it('requires an actual caller scope before starting preview or export', () => {
  render(<MantineProvider env="test"><I18nProvider><EmployeeGrossProfitReportPanel capability={employeeGrossProfitCapability()}
    initialMonth="2026-09" canGenerate callerKey={null} /></I18nProvider></MantineProvider>)
  expect((screen.getByRole('button', { name: 'Переглянути' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewEmployeeGrossProfit).not.toHaveBeenCalled()
})
