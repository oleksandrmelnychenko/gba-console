import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewSupplierDebt } from '../api/supplierDebtApi'
import { supplierDebtCapability, supplierDebtEmptyReport, supplierDebtMissingReport, supplierDebtReport, supplierDebtUnknownCurrentReport } from '../data/supplierDebt.test-fixtures'
import type { ReportDocument } from '../types'
import { SupplierDebtReportPanel } from './SupplierDebtReportPanel'
vi.mock('../api/supplierDebtApi', () => ({ previewSupplierDebt: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли заборгованості постачальникам"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewSupplierDebt).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><SupplierDebtReportPanel capability={supplierDebtCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('renders four server formatted values verbatim and exports both files from the same run under StrictMode', async () => {
  const report = supplierDebtReport(); vi.mocked(previewSupplierDebt).mockResolvedValue(report)
  render(<StrictMode>{panel()}</StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат заборгованості постачальникам' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-1', '-3', '-66.67', '2.00'])
  expect(screen.queryByText('-200/3')).toBeNull(); expect(screen.queryByText(report.Proof.OpeningRunId!)).toBeNull(); expect(screen.queryByText('EUR')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли заборгованості постачальникам' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewSupplierDebt).toHaveBeenCalledWith(supplierDebtCapability(), report.Month, expect.any(AbortSignal)); expect(previewSupplierDebt).toHaveBeenCalledOnce()
})
it('shows confirmed empty without manufacturing empty changes or declaring missing data', async () => {
  vi.mocked(previewSupplierDebt).mockResolvedValue(supplierDebtEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('У вибраних періодах немає заборгованості перед постачальниками.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText('Звіт неповний: початкові залишки або рухи за вибрані періоди ще не підтверджені.')).toBeNull()
  expect(screen.queryByText('Не всі показники вдалося розрахувати.')).toBeNull()
})
it('shows initial missing publications as incomplete rather than zero or a confirmed empty report', async () => {
  vi.mocked(previewSupplierDebt).mockResolvedValue(supplierDebtMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: початкові залишки або рухи за вибрані періоди ще не підтверджені.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText('У вибраних періодах немає заборгованості перед постачальниками.')).toBeNull()
})
it('keeps the independent prior-empty percent guard and exposes unknown current balance', async () => {
  vi.mocked(previewSupplierDebt).mockResolvedValue(supplierDebtUnknownCurrentReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: початкові залишки або рухи за вибрані періоди ще не підтверджені.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '100.00', '—'])
  expect(screen.queryByText('У вибраних періодах немає заборгованості перед постачальниками.')).toBeNull()
})
it('shows decimal projection unavailable while keeping financial completeness separate', async () => {
  const report = supplierDebtReport(); report.Code = 'decimal_projection_unavailable'
  report.Cells[0] = { ...report.Cells[0], Value: null, FormattedValue: null, Available: false,
    ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  report.Inputs.Current.ManagementBalanceSum = report.Cells[0].ExactValue
  vi.mocked(previewSupplierDebt).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText('Звіт неповний: початкові залишки або рухи за вибрані періоди ще не підтверджені.')).toBeNull()
})
it('aborts deferred old caller output without clearing a newer loading state or leaking old links', async () => {
  let oldDone!: (value: ReturnType<typeof supplierDebtReport>) => void
  let newDone!: (value: ReturnType<typeof supplierDebtReport>) => void
  vi.mocked(previewSupplierDebt).mockImplementationOnce(() => new Promise(done => { oldDone = done }))
    .mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewSupplierDebt).mock.calls[0][2]!
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(supplierDebtReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат заборгованості постачальникам' })).toBeNull()
  await act(async () => { newDone(supplierDebtReport()) })
  expect(screen.getByRole('region', { name: 'Результат заборгованості постачальникам' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли заборгованості постачальникам' })).toBeNull()
})
it('clears previous cells and download scope after month or permission changes', async () => {
  vi.mocked(previewSupplierDebt).mockResolvedValue(supplierDebtReport())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли заборгованості постачальникам' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли заборгованості постачальникам' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel('owner-a', false)); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewSupplierDebt).toHaveBeenCalledOnce()
})
