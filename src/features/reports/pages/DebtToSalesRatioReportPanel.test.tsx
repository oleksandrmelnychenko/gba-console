import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewDebtToSalesRatio } from '../api/debtToSalesRatioApi'
import { debtRatioCapability, debtRatioReport } from '../data/debtToSalesRatio.test-fixtures'
import type { ReportDocument } from '../types'
import { DebtToSalesRatioReportPanel } from './DebtToSalesRatioReportPanel'

vi.mock('../api/debtToSalesRatioApi', () => ({ previewDebtToSalesRatio: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли оригінального звіту"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewDebtToSalesRatio).mockReset())

function panel(canGenerate = true) {
  return <MantineProvider env="test"><I18nProvider><DebtToSalesRatioReportPanel capability={debtRatioCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} /></I18nProvider></MantineProvider>
}

it('renders the month-only original four columns and exports both files from the same preview response', async () => {
  const response = debtRatioReport()
  response.Cells[1] = { ...response.Cells[1], Value: null, Available: false }
  response.Cells[2].Value = '21.238938053097345132743362832'
  vi.mocked(previewDebtToSalesRatio).mockResolvedValue(response)
  const view = render(panel())
  expect(view.container.querySelector('input[type="month"]')).not.toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат оригінального конструктора' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Текущее значение', 'Предыдущее значение', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0,5', '—', '21,24', '0,1'])
  expect(screen.queryByRole('dialog', { name: 'Файли оригінального звіту' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли оригінального звіту' })
  expect(within(files).getByText(response.DocumentURL)).toBeTruthy()
  expect(within(files).getByText(response.PdfDocumentURL)).toBeTruthy()
  expect(previewDebtToSalesRatio).toHaveBeenCalledOnce()
  expect(previewDebtToSalesRatio).toHaveBeenCalledWith(debtRatioCapability(), '2026-09')
  expect(response.Cells[2].Value).toBe('21.238938053097345132743362832')
})

it('clears previous cells and export links on month change and permission revocation', async () => {
  vi.mocked(previewDebtToSalesRatio).mockResolvedValue(debtRatioReport())
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли оригінального звіту' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли оригінального звіту' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Результат оригінального конструктора' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel(false))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect(previewDebtToSalesRatio).toHaveBeenCalledOnce()
})

it('allows unavailable month cells to remain NULL in preview and both server export links', async () => {
  const response = debtRatioReport()
  response.Cells = response.Cells.map(cell => ({ ...cell, Value: null, Available: false }))
  vi.mocked(previewDebtToSalesRatio).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—']))
  expect(screen.getByRole('dialog', { name: 'Файли оригінального звіту' })).toBeTruthy()
})
