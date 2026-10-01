import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewActiveClients } from '../api/activeClientsApi'
import { activeClientsCapability, activeClientsReport } from '../data/activeClients.test-fixtures'
import type { ActiveClientsReport } from '../data/activeClients'
import type { ReportDocument } from '../types'
import { ActiveClientsReportPanel } from './ActiveClientsReportPanel'

vi.mock('../api/activeClientsApi', () => ({ previewActiveClients: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли активних клієнтів"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewActiveClients).mockReset())

function panel(canGenerate = true, callerKey = 'caller-a') {
  return <MantineProvider env="test"><I18nProvider><ActiveClientsReportPanel capability={activeClientsCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} /></I18nProvider></MantineProvider>
}

it('shows the month-only original four captions and opens both export links from the same server result', async () => {
  const response = activeClientsReport(), raw = response.Cells[2].Value
  vi.mocked(previewActiveClients).mockResolvedValue(response)
  const view = render(panel())
  expect(view.container.querySelector('input[type="month"]')).not.toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат кількості активних клієнтів' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Текущее значение', 'Предыдущее значение', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['4', '3', '33,33', '1'])
  expect(screen.queryByRole('dialog', { name: 'Файли активних клієнтів' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли активних клієнтів' })
  expect(within(files).getByText(response.DocumentURL)).toBeTruthy()
  expect(within(files).getByText(response.PdfDocumentURL)).toBeTruthy()
  expect(previewActiveClients).toHaveBeenCalledOnce()
  expect(previewActiveClients).toHaveBeenCalledWith(activeClientsCapability(), '2026-09')
  expect(response.Cells[2].Value).toBe(raw)
})

it('shows observed-empty zero values without a missing-attribution warning', async () => {
  const response = activeClientsReport()
  for (const input of Object.values(response.Inputs)) Object.assign(input, { EligibleSaleLines: 0, EligibleReturnLines: 0, DistinctClients: 0 })
  response.Cells.forEach((cell, index) => { cell.Value = index === 2 ? '100' : '0' })
  vi.mocked(previewActiveClients).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '0', '100,00', '0']))
  expect(screen.queryByText(/Не вдалося визначити клієнта/)).toBeNull()
  expect(screen.getByRole('dialog', { name: 'Файли активних клієнтів' })).toBeTruthy()
})

it('keeps missing-attribution cells unavailable while rendering a server-known zero-previous percent', async () => {
  const response = activeClientsReport()
  Object.assign(response.Inputs.Current, { Available: false, UnattributedLines: 1, DistinctClients: null, Code: 'client_attribution_unavailable' })
  Object.assign(response.Inputs.Previous, { EligibleSaleLines: 0, EligibleReturnLines: 0, DistinctClients: 0 })
  response.Cells.forEach((cell, index) => { cell.Value = index === 1 ? '0' : index === 2 ? '100' : null; cell.Available = cell.Value !== null })
  vi.mocked(previewActiveClients).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100,00', '—']))
  expect(screen.getByText(/Не вдалося визначити клієнта для частини документів.*Поточний місяць/)).toBeTruthy()
  expect(screen.getByText('Порожні клітинки позначають недоступні значення розрахунку.')).toBeTruthy()
})

it('invalidates cells and file links immediately on month or current caller change', async () => {
  vi.mocked(previewActiveClients).mockImplementation(async (_capability, month) => activeClientsReport(month))
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли активних клієнтів' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли активних клієнтів' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат кількості активних клієнтів' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли активних клієнтів' })
  view.rerender(panel(true, 'caller-b'))
  expect(screen.queryByRole('dialog', { name: 'Файли активних клієнтів' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат кількості активних клієнтів' })).toBeNull()
})

it('rejects late files from a previous caller and makes no preview after permission revocation', async () => {
  let resolve!: (response: ActiveClientsReport) => void
  vi.mocked(previewActiveClients).mockReturnValue(new Promise<ActiveClientsReport>(done => { resolve = done }))
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  view.rerender(panel(true, 'caller-b'))
  await act(async () => { resolve(activeClientsReport()) })
  expect(screen.queryByRole('dialog', { name: 'Файли активних клієнтів' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат кількості активних клієнтів' })).toBeNull()
  view.rerender(panel(false, 'caller-b'))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewActiveClients).toHaveBeenCalledOnce()
})
