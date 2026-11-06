import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { groupedCashDataset, groupedCashWorkbookDataset } from '../data/groupedCashPeriod.test-fixtures'
import { defaultGroupedCashPeriod } from '../data/groupedCashPeriod'
import { datasetGroupings } from '../data/reportDatasets'
import { presentedCurrencyRecordCashDataset } from '../data/workbookPresentation.test-fixtures'
import type { ReportDataset } from '../types'
import { CashPeriodModePanel } from './CashPeriodModePanel'

function show(dataset: ReportDataset, disabled = false) {
  const available = datasetGroupings(dataset), onRowsChange = vi.fn(), onModeChange = vi.fn()
  render(<MantineProvider env="test"><CashPeriodModePanel dataset={dataset} grouped={defaultGroupedCashPeriod()}
    disabled={disabled} available={available}
    rows={[43, 40, 42, 41].flatMap(type => available.filter(row => row.type === type))}
    onRowsChange={onRowsChange} onModeChange={onModeChange} /></MantineProvider>)
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
it('offers the per-currency-record form and sends only the currency-record row 42', () => {
  const view = show(presentedCurrencyRecordCashDataset)
  fireEvent.click(screen.getByRole('combobox', { name: 'Форма руху коштів' }))
  fireEvent.click(screen.getByRole('option', { name: 'Рахунок / каса у валюті з додатковими полями' }))
  expect(view.onRowsChange.mock.calls[0][0].map((row: { type: number }) => row.type)).toEqual([42])
})
it('offers no single currency-record mode and moves a restored one to all accounts', () => {
  const available = datasetGroupings(groupedCashWorkbookDataset), onModeChange = vi.fn()
  render(<MantineProvider env="test"><CashPeriodModePanel dataset={groupedCashWorkbookDataset} grouped={undefined}
    disabled={false} available={available} rows={[]} onRowsChange={vi.fn()} onModeChange={onModeChange} /></MantineProvider>)
  expect(screen.queryByText('Один валютний запис')).toBeNull()
  expect(screen.queryByRole('radiogroup', { name: 'Рахунки звіту коштів' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Перейти до всіх / вибраних рахунків' }))
  expect(onModeChange).toHaveBeenCalledOnce()
})
