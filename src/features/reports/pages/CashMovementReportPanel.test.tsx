import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewCashMovement } from '../api/cashMovementApi'
import { cashMovementCapability, cashMovementEmptyReport, cashMovementIncompleteReport, cashMovementReport } from '../data/cashMovement.test-fixtures'
import type { CashMovementKind } from '../data/cashMovement'
import type { ReportDocument } from '../types'
import { CashMovementReportPanel } from './CashMovementReportPanel'
vi.mock('../api/cashMovementApi', () => ({ previewCashMovement: vi.fn(), getCashMovementArticleChoices: vi.fn(() => new Promise(() => undefined)) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли руху коштів"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewCashMovement).mockReset())
function panel(kind: CashMovementKind = 'receipts', callerKey = 'owner-a', canGenerate = true, loading?: (value: boolean) => void) {
  return <MantineProvider env="test"><I18nProvider><CashMovementReportPanel capability={cashMovementCapability(kind)}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} onLoadingChange={loading} /></I18nProvider></MantineProvider>
}
it.each(['receipts', 'payouts'] as const)('shows grouped %s four server formatted columns and total, then the same run files', async kind => {
  const report = cashMovementReport(kind)
  vi.mocked(previewCashMovement).mockResolvedValue(report)
  render(<StrictMode>{panel(kind)}</StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат руху коштів' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Контрагент', ...report.Columns.map(column => column.Caption)])
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Тестовий контрагент', '4', '3', '33.33', '1', '4', '3', '33.33', '1'])
  expect(screen.queryByText(report.Rows[0].GroupKey)).toBeNull()
  expect(screen.queryByText('33.333333333333333333333333333')).toBeNull()
  expect(screen.queryByText('EUR')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли руху коштів' })
  expect(within(files).getByText(report.DocumentURL)).toBeTruthy(); expect(within(files).getByText(report.PdfDocumentURL)).toBeTruthy()
  expect(previewCashMovement).toHaveBeenCalledWith(cashMovementCapability(kind), report.Period, 'owner-a', expect.any(AbortSignal), null)
  expect(previewCashMovement).toHaveBeenCalledOnce()
})
it('shows complete empty periods separately from missing publication and does not invent empty totals', async () => {
  vi.mocked(previewCashMovement).mockResolvedValue(cashMovementEmptyReport())
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('У вибраних періодах немає руху коштів.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
  expect(screen.queryByText('Звіт неповний: синхронізовані рухи коштів за вибрані періоди ще не підтверджені.')).toBeNull()
  expect(screen.queryByText('Не всі показники вдалося розрахувати.')).toBeNull()
})
it('retains the known prior period and warns about missing current publication', async () => {
  vi.mocked(previewCashMovement).mockResolvedValue(cashMovementIncompleteReport())
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: синхронізовані рухи коштів за вибрані періоди ще не підтверджені.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Тестовий контрагент', '—', '3', '—', '—', '—', '3', '—', '—'])
  expect(screen.queryByText('У вибраних періодах немає руху коштів.')).toBeNull()
})
it('shows unavailable names and local unit labels separately while preserving server money', async () => {
  const report = cashMovementReport()
  report.Rows[0].NameAvailable = false; report.Rows[0].Name = null
  report.Inputs.Current.Publication.ManagementCurrency.Available = false; report.Inputs.Current.Publication.ManagementCurrency.Currency = null
  vi.mocked(previewCashMovement).mockResolvedValue(report)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Для частини контрагентів назви ще недоступні. Суми збережено.')
  expect(screen.getByText('Назва контрагента недоступна')).toBeTruthy()
  expect(screen.getByText(/Назва валюти недоступна/)).toBeTruthy()
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toContain('4')
  expect(screen.queryByText('Звіт неповний: синхронізовані рухи коштів за вибрані періоди ще не підтверджені.')).toBeNull()
})
it('warns about decimal projection without reclassifying complete cash inputs', async () => {
  const report = cashMovementReport(); report.Code = 'decimal_projection_unavailable'
  report.Totals[2] = { ...report.Totals[2], Available: false, Value: null, FormattedValue: null }
  vi.mocked(previewCashMovement).mockResolvedValue(report)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Не всі показники вдалося розрахувати.')
  expect(screen.queryByText('Звіт неповний: синхронізовані рухи коштів за вибрані періоди ще не підтверджені.')).toBeNull()
})
it('aborts a deferred old caller and protects a newer loading state and export scope', async () => {
  let oldDone!: (value: ReturnType<typeof cashMovementReport>) => void
  let newDone!: (value: ReturnType<typeof cashMovementReport>) => void
  vi.mocked(previewCashMovement).mockImplementationOnce(() => new Promise(done => { oldDone = done }))
    .mockImplementationOnce(() => new Promise(done => { newDone = done }))
  const loading = vi.fn(), view = render(panel('receipts', 'owner-a', true, loading))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const oldSignal = vi.mocked(previewCashMovement).mock.calls[0][3]!
  view.rerender(panel('receipts', 'owner-b', true, loading)); expect(oldSignal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await act(async () => { oldDone(cashMovementReport()) })
  expect(loading.mock.calls.at(-1)?.[0]).toBe(true)
  expect(screen.queryByRole('region', { name: 'Результат руху коштів' })).toBeNull()
  await act(async () => { newDone(cashMovementReport()) })
  expect(screen.getByRole('region', { name: 'Результат руху коштів' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Файли руху коштів' })).toBeNull()
})
it('clears previous links on period and permission changes without touching native filters', async () => {
  vi.mocked(previewCashMovement).mockResolvedValue(cashMovementReport())
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли руху коштів' })
  fireEvent.change(screen.getByLabelText('Квартал'), { target: { value: '2026-Q4' } })
  expect(screen.queryByRole('dialog', { name: 'Файли руху коштів' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel('receipts', 'owner-a', false))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewCashMovement).toHaveBeenCalledOnce()
})
it('rejects an invalid quarter and exposes no unsupported filter control', () => {
  render(panel())
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByLabelText('Валюта')).toBeNull()
  fireEvent.change(screen.getByLabelText('Квартал'), { target: { value: '2026-09' } })
  expect((screen.getByRole('button', { name: 'Переглянути' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewCashMovement).not.toHaveBeenCalled()
})
