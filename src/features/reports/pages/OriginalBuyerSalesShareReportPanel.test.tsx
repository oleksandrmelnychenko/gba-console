import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewOriginalBuyerSalesShare } from '../api/originalBuyerSalesShareApi'
import { originalBuyerSalesShareCapability, originalBuyerSalesShareReport } from '../data/originalBuyerSalesShare.test-fixtures'
import type { OriginalBuyerSalesShareReport, OriginalBuyerSalesShareVariant } from '../data/originalBuyerSalesShare'
import type { ReportDocument } from '../types'
import { OriginalBuyerSalesShareReportPanel } from './OriginalBuyerSalesShareReportPanel'
vi.mock('../api/originalBuyerSalesShareApi', () => ({ previewOriginalBuyerSalesShare: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли частки продажів"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewOriginalBuyerSalesShare).mockReset())
function panel(canGenerate = true, callerKey = 'caller-a', variant: OriginalBuyerSalesShareVariant = 'new') {
  return <MantineProvider env="test"><I18nProvider><OriginalBuyerSalesShareReportPanel capability={originalBuyerSalesShareCapability(variant)}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} /></I18nProvider></MantineProvider>
}
it.each(['new', 'repeat'] as const)('%s shows four original columns, raw fraction and server grand totals with same-result exports', async variant => {
  const response = originalBuyerSalesShareReport('2026-09', variant)
  vi.mocked(previewOriginalBuyerSalesShare).mockResolvedValue(response)
  render(panel(true, 'caller-a', variant))
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат частки продажів' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Текущее значение', 'Предыдущее значение', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0,25', '0,5', '-50,00', '-0,25', '0,25', '0,5', '-50,00', '-0,25'])
  expect(within(result).getByRole('row', { name: 'Загальний підсумок' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли частки продажів' })
  expect(within(files).getByText(response.DocumentURL)).toBeTruthy(); expect(within(files).getByText(response.PdfDocumentURL)).toBeTruthy()
  expect(previewOriginalBuyerSalesShare).toHaveBeenCalledOnce()
  expect(previewOriginalBuyerSalesShare).toHaveBeenCalledWith(originalBuyerSalesShareCapability(variant), '2026-09')
  expect(response.Cells[0].Value).toBe('0.25')
})
it('formats raw relative-change precision for display only and leaves export result bytes unchanged', async () => {
  const response = originalBuyerSalesShareReport(), raw = '33.3333333333333333333333333333'
  response.Cells[2].Value = raw; response.TotalCells[2].Value = raw
  vi.mocked(previewOriginalBuyerSalesShare).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await waitFor(() => expect(screen.getAllByRole('cell')[2].textContent).toBe('33,33'))
  expect(response.Cells[2].Value).toBe(raw); expect(response.TotalCells[2].Value).toBe(raw)
})
it('keeps unknown current history NULL, known previous0 change100 and specific missing-data notice', async () => {
  const response = originalBuyerSalesShareReport()
  Object.assign(response.Inputs.Current, { UnknownHistoryLines: 1, NumeratorNetEur: null, RawFraction: null, FractionIsZero: null, Available: false, Code: 'current_our_input_unavailable' })
  Object.assign(response.Inputs.Previous, { NumeratorNetEur: '0', RawFraction: '0', FractionIsZero: true })
  for (const cells of [response.Cells, response.TotalCells]) cells.forEach((cell, index) => {
    cell.Value = index === 1 ? '0' : index === 2 ? '100' : null; cell.Available = cell.Value !== null
  })
  vi.mocked(previewOriginalBuyerSalesShare).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100,00', '—', '—', '0', '100,00', '—']))
  expect(screen.getByText(/Дані недоступні: Поточний місяць: Попередня активність клієнтів/)).toBeTruthy()
})
it('shows observed empty fractions as0 with no missing-data notice', async () => {
  const response = originalBuyerSalesShareReport()
  for (const input of Object.values(response.Inputs)) Object.assign(input, { SaleLines: 0, ReturnLines: 0, DenominatorNetEur: '0', NumeratorNetEur: '0', RawFraction: '0', FractionIsZero: true })
  for (const cells of [response.Cells, response.TotalCells]) cells.forEach((cell, i) => { cell.Value = i === 2 ? '100' : '0' })
  vi.mocked(previewOriginalBuyerSalesShare).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '0', '100,00', '0', '0', '0', '100,00', '0']))
  expect(screen.queryByText(/Дані недоступні:/)).toBeNull()
})
it('invalidates both result and exports when month or caller changes', async () => {
  vi.mocked(previewOriginalBuyerSalesShare).mockImplementation(async (_capability, month) => originalBuyerSalesShareReport(month))
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли частки продажів' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли частки продажів' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат частки продажів' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли частки продажів' })
  view.rerender(panel(true, 'caller-b'))
  expect(screen.queryByRole('dialog', { name: 'Файли частки продажів' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
})
it('discards a pending previous-identity result and forbids generation after permission revocation', async () => {
  let resolve!: (response: OriginalBuyerSalesShareReport) => void
  vi.mocked(previewOriginalBuyerSalesShare).mockReturnValue(new Promise<OriginalBuyerSalesShareReport>(done => { resolve = done }))
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  view.rerender(panel(true, 'caller-b', 'repeat'))
  await act(async () => { resolve(originalBuyerSalesShareReport()) })
  expect(screen.queryByRole('dialog', { name: 'Файли частки продажів' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат частки продажів' })).toBeNull()
  view.rerender(panel(false, 'caller-b', 'repeat'))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewOriginalBuyerSalesShare).toHaveBeenCalledOnce()
})
