import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrencyRateDynamicsDefinitions, previewCurrencyRateDynamics } from '../api/currencyRateDynamicsApi'
import { currencyDynamicsCapability, currencyDynamicsDefinition, currencyDynamicsReport } from '../data/currencyRateDynamics.test-fixtures'
import type { CurrencyRateDynamicsReport } from '../data/currencyRateDynamics'
import type { ReportDocument } from '../types'
import { CurrencyRateDynamicsReportPanel } from './CurrencyRateDynamicsReportPanel'

vi.mock('../api/currencyRateDynamicsApi', () => ({ getCurrencyRateDynamicsDefinitions: vi.fn(), previewCurrencyRateDynamics: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли динаміки курсу"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => {
  vi.mocked(previewCurrencyRateDynamics).mockReset()
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockReset().mockResolvedValue([currencyDynamicsDefinition(), currencyDynamicsDefinition(true)])
})
function panel(canGenerate = true, callerKey = 'caller-a') {
  return <MantineProvider env="test"><I18nProvider><CurrencyRateDynamicsReportPanel capability={currencyDynamicsCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} /></I18nProvider></MantineProvider>
}
async function selectPair(second = false) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: second ? /EUR.*UAH/ : /USD.*UAH/ }))
}
it('requires an exact OUR pair then renders original captions, raw rates and same-result XLSX/PDF', async () => {
  const response = currencyDynamicsReport(), raw = response.Cells[2].Value
  vi.mocked(previewCurrencyRateDynamics).mockResolvedValue(response)
  render(panel())
  expect((screen.getByRole('button', { name: 'Переглянути' }) as HTMLButtonElement).disabled).toBe(true)
  await selectPair()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат динаміки курсу базової валюти' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['13,7', '11,3', '21,24', '2,4'])
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли динаміки курсу' })
  expect(within(files).getByText(response.DocumentURL)).toBeTruthy()
  expect(within(files).getByText(response.PdfDocumentURL)).toBeTruthy()
  expect(previewCurrencyRateDynamics).toHaveBeenCalledOnce()
  expect(previewCurrencyRateDynamics).toHaveBeenCalledWith(currencyDynamicsCapability(), '2026-09', currencyDynamicsDefinition())
  expect(response.Cells[2].Value).toBe(raw)
})
it('keeps ambiguous history unavailable while rendering server-known zero-previous percentage100', async () => {
  const response = currencyDynamicsReport()
  response.Inputs.Current = { Available: false, HistoryId: null, Created: null, Amount: null, Code: 'latest_point_ambiguous' }
  response.Inputs.Previous.Amount = '0'; response.CalculationCode = 'rate_history_unavailable'
  response.Cells.forEach((cell, index) => { cell.Value = index === 1 ? '0' : index === 2 ? '100' : null; cell.Available = cell.Value !== null })
  vi.mocked(previewCurrencyRateDynamics).mockResolvedValue(response)
  render(panel()); await selectPair()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100,00', '—']))
  expect(screen.getByText(/Поточний місяць: Кілька курсів мають однакову останню дату/)).toBeTruthy()
})
it('retains rates and absolute difference when only percentage is unavailable', async () => {
  const response = currencyDynamicsReport()
  response.Cells[0].Value = response.Inputs.Current.Amount = '9999999999999999.99999999999999'
  response.Cells[1].Value = response.Inputs.Previous.Amount = '0.00000000000001'
  response.Cells[3].Value = '9999999999999999.99999999999998'
  response.Cells[2] = { ...response.Cells[2], Value: null, Available: false }; response.CalculationCode = 'percentage_range_unavailable'
  vi.mocked(previewCurrencyRateDynamics).mockResolvedValue(response)
  render(panel()); await selectPair(); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['9999999999999999,99999999999999', '0,00000000000001', '—', '9999999999999999,99999999999998']))
  expect(screen.getByText('Не вдалося розрахувати відсоткову зміну. Курси й різниця доступні.')).toBeTruthy()
})
it('clears cells and file links on selected pair, month or current caller change', async () => {
  vi.mocked(previewCurrencyRateDynamics).mockImplementation(async (_capability, month, definition) => currencyDynamicsReport(month, definition))
  const view = render(panel()); await selectPair(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли динаміки курсу' })
  await selectPair(true)
  expect(screen.queryByRole('dialog', { name: 'Файли динаміки курсу' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат динаміки курсу базової валюти' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли динаміки курсу' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли динаміки курсу' })
  view.rerender(panel(true, 'caller-b'))
  expect(screen.queryByRole('dialog', { name: 'Файли динаміки курсу' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат динаміки курсу базової валюти' })).toBeNull()
})
it('rejects late preview files after caller change and sends no preview after permission loss', async () => {
  let resolve!: (response: CurrencyRateDynamicsReport) => void
  vi.mocked(previewCurrencyRateDynamics).mockReturnValue(new Promise<CurrencyRateDynamicsReport>(done => { resolve = done }))
  const view = render(panel()); await selectPair(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  view.rerender(panel(true, 'caller-b'))
  await act(async () => { resolve(currencyDynamicsReport()) })
  expect(screen.queryByRole('dialog', { name: 'Файли динаміки курсу' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат динаміки курсу базової валюти' })).toBeNull()
  view.rerender(panel(false, 'caller-b'))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewCurrencyRateDynamics).toHaveBeenCalledOnce()
})
