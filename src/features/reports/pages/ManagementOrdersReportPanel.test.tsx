import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewManagementOrders } from '../api/managementOrdersApi'
import { managementOrdersCapability, managementOrdersEmptyReport, managementOrdersMissingReport, managementOrdersReport, managementOrdersZeroReport, managementOrdersNullPreviousReport, managementOrdersUnknownCurrentZeroPreviousReport } from '../data/managementOrders.test-fixtures'
import type { ReportDocument } from '../types'
import { ManagementOrdersReportPanel } from './ManagementOrdersReportPanel'
vi.mock('../api/managementOrdersApi', () => ({ previewManagementOrders: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) =>
  opened ? <div role="dialog" aria-label="Файли замовлень"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewManagementOrders).mockReset())
function panel(callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><ManagementOrdersReportPanel capability={managementOrdersCapability()} initialMonth="2026-09"
    canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it('shows four server-formatted cells, names and same-run files without browser arithmetic under StrictMode', async () => {
  const report = managementOrdersReport(); vi.mocked(previewManagementOrders).mockResolvedValue(report); render(<StrictMode>{panel()}</StrictMode>)
  expect(screen.queryByRole('combobox')).toBeNull(); expect(screen.queryByLabelText('Покупець')).toBeNull(); expect(screen.queryByLabelText('Вид договору')).toBeNull()
  const input = screen.getByLabelText('Місяць') as HTMLInputElement
  expect(input.type).toBe('month'); expect(input.value).toBe(report.Month)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат оригінальних замовлень' }), total = within(result).getByLabelText('Підсумок')
  expect(within(total).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(report.Columns.map(column => column.Caption))
  expect(within(total).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-5', '-10', '-50.00', '5'])
  expect(within(result).getByText('Контрагент із OUR')).toBeTruthy(); expect(screen.queryByText(report.Rows[0].Key)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' })); const files = screen.getByRole('dialog', { name: 'Файли замовлень' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewManagementOrders).toHaveBeenCalledWith(managementOrdersCapability(), report.Month, 'owner-a', expect.any(AbortSignal))
  expect(previewManagementOrders).toHaveBeenCalledOnce()
})
it('shows confirmed empty without fake hundred or zero and without a missing-input warning', async () => {
  vi.mocked(previewManagementOrders).mockResolvedValue(managementOrdersEmptyReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText('У вибраних місяцях немає замовлень.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—']); expect(screen.queryByText(/Звіт неповний/)).toBeNull()
})
it('shows missing publications distinctly from an empty monthly order query', async () => {
  vi.mocked(previewManagementOrders).mockResolvedValue(managementOrdersMissingReport()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(screen.getByText('Поточний період: дані ще не підтверджені.')).toBeTruthy(); expect(screen.getByText('Попередній період: дані ще не підтверджені.')).toBeTruthy()
  expect(screen.queryByText('У вибраних місяцях немає замовлень.')).toBeNull(); expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
})
it('preserves server previous-zero hundred independently from missing current amounts', async () => {
  const report=managementOrdersUnknownCurrentZeroPreviousReport()
  vi.mocked(previewManagementOrders).mockResolvedValue(report);render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await screen.findByText(/Звіт неповний/)
  expect(within(screen.getByLabelText('Підсумок')).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100.00', '—'])
})
it('separates unknown captions and decimal projection from complete coverage', async () => {
  const report = managementOrdersReport(); report.Rows[0].Caption = null; report.Rows[0].NameAvailable = false; report.CounterpartyNamesComplete = false
  report.Code = 'decimal_projection_unavailable'; report.Totals[0] = { ...report.Totals[0], Value: null, FormattedValue: null, Available: false,
    ExactValue: { Numerator: '100000000000000000000000000000', Denominator: '1' } }
  vi.mocked(previewManagementOrders).mockResolvedValue(report); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Назва недоступна'); expect(screen.getByText('Не всі показники вдалося розрахувати.')).toBeTruthy()
  expect(screen.queryByText(/Звіт неповний/)).toBeNull(); expect(screen.queryByText(report.Totals[0].ExactValue!.Numerator)).toBeNull()
})
it('clears values/files on month edits and refuses the physical bound before a second request',async()=>{
  vi.mocked(previewManagementOrders).mockResolvedValue(managementOrdersReport());render(panel())
  fireEvent.click(screen.getByRole('button',{name:'Сформувати'}));await screen.findByRole('dialog',{name:'Файли замовлень'})
  fireEvent.change(screen.getByLabelText('Місяць'),{target:{value:'2026-10'}})
  expect(screen.queryByRole('dialog',{name:'Файли замовлень'})).toBeNull();expect(screen.queryByRole('region',{name:'Результат оригінальних замовлень'})).toBeNull()
  fireEvent.change(screen.getByLabelText('Місяць'),{target:{value:'7999-12'}})
  expect((screen.getByRole('button',{name:'Сформувати'}) as HTMLButtonElement).disabled).toBe(true);expect(previewManagementOrders).toHaveBeenCalledOnce()
})
it('aborts old caller and ignores late files without clearing the new loading state', async () => {
  let oldDone!: (value: ReturnType<typeof managementOrdersReport>) => void, newDone!: (value: ReturnType<typeof managementOrdersReport>) => void
  vi.mocked(previewManagementOrders).mockImplementationOnce(() => new Promise(done => { oldDone = done })).mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('owner-a', true, loading)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewManagementOrders).mock.calls[0][3]
  view.rerender(panel('owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' })); await act(async () => { oldDone(managementOrdersReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true); expect(screen.queryByRole('region', { name: 'Результат оригінальних замовлень' })).toBeNull()
  await act(async () => { newDone(managementOrdersReport()) }); expect(screen.getByRole('region', { name: 'Результат оригінальних замовлень' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли замовлень' })).toBeNull()
})
it('aborts pending permission-revoked response and never shows its files', async () => {
  let done!: (value: ReturnType<typeof managementOrdersReport>) => void
  vi.mocked(previewManagementOrders).mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const oldSignal = vi.mocked(previewManagementOrders).mock.calls[0][3]
  view.rerender(panel('owner-a', false)); expect(oldSignal.aborted).toBe(true)
  await act(async () => { done(managementOrdersReport()) }); expect(screen.queryByRole('dialog', { name: 'Файли замовлень' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат оригінальних замовлень' })).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('refuses another period or unsafe mock delivery before opening files', async () => {
  const report = managementOrdersReport(); report.Month = '2026-10'; vi.mocked(previewManagementOrders).mockResolvedValueOnce(report)
  const unsafe = managementOrdersReport(); unsafe.DocumentURL = '//untrusted.test/file'; vi.mocked(previewManagementOrders).mockResolvedValueOnce(unsafe)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/непідтверджений результат/)
  expect(screen.queryByRole('dialog', { name: 'Файли замовлень' })).toBeNull(); expect(screen.queryByRole('region', { name: 'Результат оригінальних замовлень' })).toBeNull()
})

it.each(['zero','null'])('displays server-confirmed %s with prior-zero change as data rather than a missing publication',async kind=>{
  const report=kind==='zero'?managementOrdersZeroReport():managementOrdersNullPreviousReport();vi.mocked(previewManagementOrders).mockResolvedValue(report);render(panel())
  fireEvent.click(screen.getByRole('button',{name:'Переглянути'}));await screen.findByRole('region',{name:'Результат оригінальних замовлень'})
  expect(within(screen.getByLabelText('Підсумок')).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(kind==='zero'?['0','0','100.00','0']:['-5','—','100.00','-5'])
  expect(screen.queryByText(/Звіт неповний/)).toBeNull()
})
it('leaves request retry explicit after failure and never opens ambiguous files',async()=>{
  vi.mocked(previewManagementOrders).mockRejectedValueOnce(new Error('Спробуйте ще раз.')).mockResolvedValueOnce(managementOrdersReport());render(panel())
  fireEvent.click(screen.getByRole('button',{name:'Сформувати'}));await screen.findByText('Спробуйте ще раз.')
  expect(previewManagementOrders).toHaveBeenCalledOnce();expect(screen.queryByRole('dialog',{name:'Файли замовлень'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Переглянути'}));await screen.findByRole('region',{name:'Результат оригінальних замовлень'})
  expect(previewManagementOrders).toHaveBeenCalledTimes(2)
})

it('renders known Source NULL owner separately from a missing caption without exposing a raw reference',async()=>{
  const report=managementOrdersReport();report.Rows[0]={...report.Rows[0],Caption:null,NameAvailable:true,SourceNull:true}
  vi.mocked(previewManagementOrders).mockResolvedValue(report);render(panel());fireEvent.click(screen.getByRole('button',{name:'Переглянути'}))
  await screen.findByText('Немає значення');expect(screen.queryByText('Назва недоступна')).toBeNull();expect(screen.queryByText(report.Rows[0].Key)).toBeNull()
})
