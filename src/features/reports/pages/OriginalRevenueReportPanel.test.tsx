import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewOriginalRevenue } from '../api/originalRevenueApi'
import { originalRevenueCapability, originalRevenueCells, originalRevenueInput, originalRevenueReport } from '../data/originalRevenue.test-fixtures'
import type { OriginalRevenueReport } from '../data/originalRevenue'
import { OriginalRevenueReportPanel } from './OriginalRevenueReportPanel'

vi.mock('../api/originalRevenueApi', () => ({ previewOriginalRevenue: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, document }: {
  opened: boolean; document?: { DocumentURL?: string; PdfDocumentURL?: string }
}) => opened ? <div role="dialog" aria-label="Файли виручки"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null }))
beforeEach(() => vi.mocked(previewOriginalRevenue).mockReset())
function panel(callerKey = 'caller-a', canGenerate = true) {
  return <MantineProvider env="test"><I18nProvider><OriginalRevenueReportPanel capability={originalRevenueCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} /></I18nProvider></MantineProvider>
}
it('shows four exact horizontal columns, known unattributed money and server grand totals with both files from one result', async () => {
  const result = originalRevenueReport()
  vi.mocked(previewOriginalRevenue).mockResolvedValue(result)
  render(panel())
  expect((screen.getByLabelText('Місяць') as HTMLInputElement).type).toBe('month')
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const region = await screen.findByRole('region', { name: 'Результат виручки' })
  const rows = within(region).getAllByRole('row')
  expect(rows).toHaveLength(4)
  expect(within(rows[0]).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Контрагент', 'Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(rows[1]).getByRole('rowheader').textContent).toBe('Покупець')
  expect(within(rows[2]).getByRole('rowheader').textContent).toBe('Контрагент не определён')
  expect(within(rows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['60', '50', '20,00', '10'])
  expect(within(rows[3]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['210', '125', '68,00', '85'])
  expect(within(region).getByText('Суми без визначеного контрагента включені до підсумку.')).toBeTruthy()
  expect(previewOriginalRevenue).toHaveBeenCalledWith(originalRevenueCapability(), '2026-09')
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли виручки' })
  expect(files.textContent).toContain(result.DocumentURL); expect(files.textContent).toContain(result.PdfDocumentURL)
  expect(previewOriginalRevenue).toHaveBeenCalledOnce()
})
it('keeps another client known while missing money propagates only into dependent cells and grand totals', async () => {
  const result = originalRevenueReport(), row = result.Rows[0]
  row.Current = originalRevenueInput(null); row.Previous = originalRevenueInput('0', 0)
  row.Cells = originalRevenueCells([null, '0', '100', null])
  result.Totals.Current = originalRevenueInput(null, 2); result.Totals.Previous = originalRevenueInput('50')
  result.Totals.Cells = originalRevenueCells([null, '50', null, null])
  vi.mocked(previewOriginalRevenue).mockResolvedValue(result)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const region = await screen.findByRole('region', { name: 'Результат виручки' })
  const rows = within(region).getAllByRole('row')
  expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '0', '100,00', '—'])
  expect(within(rows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['60', '50', '20,00', '10'])
  expect(within(rows[3]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '50', '—', '—'])
  expect(within(region).getByText(/Вони не прирівнюються до нуля/)).toBeTruthy()
})
it('renders observed empty population as zero totals rather than unavailable cells or fabricated client rows', async () => {
  const result = originalRevenueReport(); result.Rows = []
  result.Totals = { Current: originalRevenueInput('0', 0), Previous: originalRevenueInput('0', 0), Cells: originalRevenueCells(['0', '0', '100', '0']) }
  vi.mocked(previewOriginalRevenue).mockResolvedValue(result)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const region = await screen.findByRole('region', { name: 'Результат виручки' }), rows = within(region).getAllByRole('row')
  expect(rows).toHaveLength(2)
  expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '0', '100,00', '0'])
  expect(within(region).getByText('Продажів і повернень за обидва місяці немає.')).toBeTruthy()
})
it('clears preview and signed export on month or caller change', async () => {
  vi.mocked(previewOriginalRevenue).mockResolvedValue(originalRevenueReport())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли виручки' })
  fireEvent.change(screen.getByLabelText('Місяць'), { target: { value: '2026-08' } })
  expect(screen.queryByRole('region', { name: 'Результат виручки' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли виручки' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  vi.mocked(previewOriginalRevenue).mockResolvedValue(originalRevenueReport('2026-08'))
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат виручки' })
  view.rerender(panel('caller-b'))
  expect(screen.queryByRole('region', { name: 'Результат виручки' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
})
it('ignores late pending export after permission/caller changes and rejects generation without permission', async () => {
  let resolve!: (value: OriginalRevenueReport) => void
  vi.mocked(previewOriginalRevenue).mockReturnValue(new Promise(done => { resolve = done }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(previewOriginalRevenue).toHaveBeenCalledOnce())
  view.rerender(panel('caller-b', false))
  await act(async () => { resolve(originalRevenueReport()) })
  expect(screen.queryByRole('region', { name: 'Результат виручки' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Файли виручки' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Переглянути' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  expect(previewOriginalRevenue).toHaveBeenCalledOnce()
})
