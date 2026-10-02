import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewCollectionCoefficient } from '../api/collectionCoefficientApi'
import { collectionCoefficientCapability, collectionCoefficientReport } from '../data/collectionCoefficient.test-fixtures'
import type { ReportDocument } from '../types'
import { CollectionCoefficientReportPanel } from './CollectionCoefficientReportPanel'

vi.mock('../api/collectionCoefficientApi', () => ({ previewCollectionCoefficient: vi.fn() }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document: ReportDocument | null }) => opened
    ? <div role="dialog" aria-label="Файли оригінального звіту"><span>{document?.DocumentURL}</span><span>{document?.PdfDocumentURL}</span></div> : null,
}))
beforeEach(() => vi.mocked(previewCollectionCoefficient).mockReset())

function panel(canGenerate = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><CollectionCoefficientReportPanel capability={collectionCoefficientCapability()}
    initialMonth="2026-09" canGenerate={canGenerate} callerKey={callerKey} /></I18nProvider></MantineProvider>
}

it('renders the original measures and opens the two files from the same calculation', async () => {
  const response = collectionCoefficientReport()
  response.Cells[2].Value = '21.238938053097345132743362832'
  vi.mocked(previewCollectionCoefficient).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  const result = await screen.findByRole('region', { name: 'Результат оригінального конструктора' })
  expect(within(result).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)',
  ])
  expect(within(result).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0,5', '0,4', '21,24', '0,10'])
  fireEvent.click(screen.getByRole('button', { name: 'Файли звіту' }))
  const files = screen.getByRole('dialog', { name: 'Файли оригінального звіту' })
  expect(within(files).getByText(response.DocumentURL)).toBeTruthy()
  expect(within(files).getByText(response.PdfDocumentURL)).toBeTruthy()
  expect(previewCollectionCoefficient).toHaveBeenCalledOnce()
})

it('shows known complete empty periods without inventing a zero or a 100 percent row', async () => {
  const response = collectionCoefficientReport()
  response.HasRows = false
  response.Cells = response.Cells.map(cell => ({ ...cell, Value: null, Available: true }))
  response.Inputs.Current = { ...response.Inputs.Current, CoefficientSum: null, PhysicalRows: 0, ActiveRows: 0, IncludedRows: 0, GrainRows: 0 }
  response.Inputs.Previous = { ...response.Inputs.Current }
  vi.mocked(previewCollectionCoefficient).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('У вибраних періодах немає оборотів покупців.')
  expect(screen.queryAllByRole('cell')).toHaveLength(0)
  expect(screen.queryByText('Звіт неповний: частина даних ще недоступна.')).toBeNull()
})

it('labels unavailable Buyer coverage and retains blank calculation cells', async () => {
  const response = collectionCoefficientReport()
  response.Complete = false
  response.Inputs.Current = { ...response.Inputs.Current, Available: false, CoefficientSum: null, UnknownBuyerRows: 1, Code: 'buyer_not_observed' }
  response.Cells = response.Cells.map(cell => ({ ...cell, Value: null, Available: false }))
  vi.mocked(previewCollectionCoefficient).mockResolvedValue(response)
  render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути' }))
  await screen.findByText('Звіт неповний: частина даних ще недоступна.')
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—', '—', '—'])
})

it('clears cells and files on month, caller or permission changes', async () => {
  vi.mocked(previewCollectionCoefficient).mockResolvedValue(collectionCoefficientReport())
  const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('dialog', { name: 'Файли оригінального звіту' })
  fireEvent.change(screen.getByLabelText('Період'), { target: { value: '2026-10' } })
  expect(screen.queryByRole('dialog', { name: 'Файли оригінального звіту' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли звіту' })).toBeNull()
  view.rerender(panel(true, 'owner-b'))
  expect(screen.queryByRole('region', { name: 'Результат оригінального конструктора' })).toBeNull()
  view.rerender(panel(false, 'owner-b'))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewCollectionCoefficient).toHaveBeenCalledOnce()
})
