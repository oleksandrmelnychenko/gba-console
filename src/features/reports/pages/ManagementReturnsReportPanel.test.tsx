import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewManagementReturns } from '../api/managementReturnsApi'
import { createManagementReturnsRequest, initialManagementReturnsWindows } from '../data/managementReturns'
import { managementReturnsCapability, managementReturnsEmptyReport, managementReturnsMissingReport, managementReturnsReport,
  managementReturnsUnknownCurrentReport } from '../data/managementReturns.test-fixtures'
import type { ReportDocument } from '../types'
import { ManagementReturnsReportPanel } from './ManagementReturnsReportPanel'

vi.mock('../api/managementReturnsApi', () => ({ previewManagementReturns: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли управлінських повернень"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewManagementReturns).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><ManagementReturnsReportPanel capability={managementReturnsCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('shows four signed server-formatted cells grouped by actual captions and reuses the same two files under StrictMode', async () => {
  const report = managementReturnsReport(); vi.mocked(previewManagementReturns).mockResolvedValue(report); render(<StrictMode>{panel()}</StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат управлінських повернень' }), total = within(result).getByLabelText('Підсумок')
  expect(within(total).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(total).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-5', '-10', '-50.00', '5'])
  const groups = within(result).getByLabelText('Контрагенти повернень')
  expect(within(groups).getByText('Контрагент із OUR')).toBeTruthy(); expect(within(groups).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-5', '-10', '-50.00', '5'])
  expect(screen.getByText(report.ManagementCurrency)).toBeTruthy(); expect(screen.queryByText('-50/1')).toBeNull(); expect(screen.queryByText(report.Rows[0].Key)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли управлінських повернень' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewManagementReturns).toHaveBeenCalledWith(managementReturnsCapability(), initialManagementReturnsWindows('2026-09'), 'owner-a', expect.any(AbortSignal))
  expect(previewManagementReturns).toHaveBeenCalledOnce()
})
it('shows published empty without inventing hundred, absolute zero or missing-data warnings', async () => {
  vi.mocked(previewManagementReturns).mockResolvedValue(managementReturnsEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText('У вибраних періодах немає повернень.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText(/Звіт неповний/)).toBeNull(); expect(screen.queryByText('Не всі показники вдалося розрахувати.')).toBeNull()
})
it('shows both missing periods as unavailable without fake zero or a confirmed empty message', async () => {
  vi.mocked(previewManagementReturns).mockResolvedValue(managementReturnsMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(screen.getByText('Поточний період: дані ще не підтверджені.')).toBeTruthy(); expect(screen.getByText('Попередній період: дані ще не підтверджені.')).toBeTruthy()
  expect(screen.queryByText('У вибраних періодах немає повернень.')).toBeNull(); expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
})
it('preserves known previous values and unknown current/change cells independently', async () => {
  vi.mocked(previewManagementReturns).mockResolvedValue(managementReturnsUnknownCurrentReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(within(screen.getByLabelText('Підсумок')).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '-10', '—', '—'])
  expect(screen.queryByText('Попередній період: дані ще не підтверджені.')).toBeNull()
})
it('renders Source NULL and unavailable captions distinctly while preserving financial cells', async () => {
  const report = managementReturnsReport()
  const observedCells = (values: Array<string | null>) => report.Totals.map((cell, index) => {
    const value = values[index]
    return { ...cell, Value: value, ExactValue: value === null ? null : { Numerator: value, Denominator: '1' },
      FormattedValue: value === null ? null : index === 2 ? `${value}.00` : value }
  })
  report.Rows = [{ ...report.Rows[0], Caption: null, NameAvailable: false, Cells: observedCells(['-5', null, '100', '-5']) },
    { ...report.Rows[0], Key: '1'.repeat(64), Caption: null, SourceNull: true, NameAvailable: true, Cells: observedCells([null, '-10', '-100', '10']) }]
  report.CounterpartyNamesComplete = false
  vi.mocked(previewManagementReturns).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText('Назва недоступна')
  expect(screen.getByText('Немає значення')).toBeTruthy(); expect(screen.getByText('Назви деяких контрагентів недоступні; розраховані показники збережені.')).toBeTruthy()
  expect(within(screen.getByLabelText('Підсумок')).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-5', '-10', '-50.00', '5'])
})
it('separates complete input coverage from unavailable decimal projection', async () => {
  const report = managementReturnsReport(); report.Code = 'decimal_projection_unavailable'
  report.Totals[0] = { ...report.Totals[0], Available: false, Value: null, FormattedValue: null, ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  vi.mocked(previewManagementReturns).mockResolvedValue(report); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText(/Звіт неповний/)).toBeNull(); expect(screen.queryByText(report.Totals[0].ExactValue!.Numerator)).toBeNull()
})
it('uses independent local windows, clears old downloads on edits and rejects reversed or zoned dates', async () => {
  vi.mocked(previewManagementReturns).mockResolvedValue(managementReturnsReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли управлінських повернень' })
  fireEvent.change(screen.getByLabelText('Попередній період: початок'), { target: { value: '2026-08-15T12:34' } })
  expect(screen.queryByRole('dialog', { name: 'Файли управлінських повернень' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат управлінських повернень' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Поточний період: початок'), { target: { value: '2026-10-01T00:00' } })
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(() => createManagementReturnsRequest(managementReturnsCapability(), { ...initialManagementReturnsWindows('2026-09'),
    PreviousPeriod: { From: '2026-08-01T00:00:00Z', ThroughExclusive: '2026-09-01T00:00:00Z' } })).toThrow()
  expect(previewManagementReturns).toHaveBeenCalledOnce()
})
it('aborts the old caller and rejects deferred files without clearing a newer loading state', async () => {
  let oldDone!: (value: ReturnType<typeof managementReturnsReport>) => void, newDone!: (value: ReturnType<typeof managementReturnsReport>) => void
  vi.mocked(previewManagementReturns).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewManagementReturns).mock.calls[0][3]
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await act(async () => { oldDone(managementReturnsReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат управлінських повернень' })).toBeNull()
  await act(async () => { newDone(managementReturnsReport()) }); expect(screen.getByRole('region', { name: 'Результат управлінських повернень' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли управлінських повернень' })).toBeNull()
})
it('clears previous files on permission loss and refuses unsafe or mismatched mock delivery', async () => {
  vi.mocked(previewManagementReturns).mockResolvedValue(managementReturnsReport())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('dialog', { name: 'Файли управлінських повернень' })
  view.rerender(panel('owner-a', false)); expect(screen.queryByRole('dialog', { name: 'Файли управлінських повернень' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  const unsafe = managementReturnsReport(); unsafe.PdfDocumentURL = 'javascript:alert(1)'; vi.mocked(previewManagementReturns).mockResolvedValue(unsafe)
  view.rerender(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  expect(screen.queryByRole('region', { name: 'Результат управлінських повернень' })).toBeNull(); expect(screen.queryByRole('dialog', { name: 'Файли управлінських повернень' })).toBeNull()
})
