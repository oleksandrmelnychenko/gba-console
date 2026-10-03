import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { groupedCashDataset, groupedCashWorkbookDataset } from '../data/groupedCashPeriod.test-fixtures'
import { defaultGroupedCashPeriod } from '../data/groupedCashPeriod'
import { datasetGroupings } from '../data/reportDatasets'
import type { ReportDataset } from '../types'
import { CashPeriodModePanel } from './CashPeriodModePanel'

function show(dataset: ReportDataset, disabled = false) {
  const available = datasetGroupings(dataset), onRowsChange = vi.fn(), onModeChange = vi.fn()
  render(<MantineProvider env="test"><CashPeriodModePanel dataset={dataset} grouped={defaultGroupedCashPeriod()}
    exact={undefined} enabled disabled={disabled} available={available}
    rows={[43, 40, 42, 41].flatMap(type => available.filter(row => row.type === type))}
    onRowsChange={onRowsChange} onModeChange={onModeChange} onExactChange={vi.fn()} /></MantineProvider>)
  return { onRowsChange, onModeChange }
}
it('offers the actual workbook shape and sends only the declared axes after explicit selection', () => {
  const view = show(groupedCashWorkbookDataset)
  fireEvent.click(screen.getByRole('combobox', { name: 'Форма руху коштів' }))
  fireEvent.click(screen.getByRole('option', { name: 'Рахунок / Тип / Організація' }))
  expect(view.onRowsChange).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining([
    expect.objectContaining({ type: 40 }), expect.objectContaining({ type: 44 }), expect.objectContaining({ type: 43 }),
  ]))
  expect(view.onRowsChange.mock.calls[0][0].map((row: { type: number }) => row.type)).toEqual([40, 44, 43])
  expect(view.onModeChange).not.toHaveBeenCalled()
})
it('does not present a workbook selector on the earlier capability', () => {
  show(groupedCashDataset)
  expect(screen.queryByRole('combobox', { name: 'Форма руху коштів' })).toBeNull()
})
it('disables the workbook form selector during generation', () => {
  const view = show(groupedCashWorkbookDataset, true)
  expect((screen.getByRole('combobox', { name: 'Форма руху коштів' }) as HTMLSelectElement).disabled).toBe(true)
  expect(view.onRowsChange).not.toHaveBeenCalled()
})
