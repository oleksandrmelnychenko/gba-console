import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { grossDataset, stockDataset, valuationDataset } from '../data/reportDatasets.test-fixtures'
import { ReportDatasetPicker, ReportDatasetSummary } from './ReportDatasetPicker'

const props = () => ({ datasets: [grossDataset, stockDataset, valuationDataset], selected: 0,
  disabled: false, loaded: true, error: null, onChange: vi.fn(), onRetry: vi.fn() })
const picker = (options: ComponentProps<typeof ReportDatasetPicker>) =>
  <MantineProvider env="test"><ReportDatasetPicker {...options} /></MantineProvider>
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

it('keeps the existing expanded description and limitations by default', () => {
  const options = props()
  render(picker(options))
  expect(screen.getByText(/Зміна набору застосує початкові групування/)).toBeTruthy()
  expect(screen.getByText(grossDataset.Description)).toBeTruthy()
  expect(screen.getByText(grossDataset.Limitations[0])).toBeTruthy()
  expect(options.onChange).not.toHaveBeenCalled()
})

it('searches compact options without applying a selection until explicitly chosen', async () => {
  const user = userEvent.setup()
  const options = props()
  render(picker({ ...options, compact: true }))
  const input = screen.getByRole('combobox', { name: 'Набір даних звіту' })
  expect(screen.queryByText(/Зміна набору застосує/)).toBeNull()
  expect(screen.queryByText(grossDataset.Description)).toBeNull()
  await user.click(input)
  await user.clear(input)
  await user.type(input, 'оцінка')
  expect(options.onChange).not.toHaveBeenCalled()
  expect(await screen.findByRole('option', { name: valuationDataset.Name })).toBeTruthy()
  expect(screen.queryByRole('option', { name: grossDataset.Name })).toBeNull()
  fireEvent.click(screen.getByRole('option', { name: valuationDataset.Name }))
  expect(options.onChange).toHaveBeenCalledExactlyOnceWith(valuationDataset)
})

it('keeps controlled selection and never substitutes an unavailable dataset', () => {
  const options = props()
  const view = render(picker({ ...options, compact: true, selected: 99 }))
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('')
  expect(options.onChange).not.toHaveBeenCalled()
  view.rerender(picker({ ...options, compact: true, selected: stockDataset.DataSource }))
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(stockDataset.Name)
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(screen.getByRole('option', { name: stockDataset.Name }))
  expect(options.onChange).not.toHaveBeenCalled()
})

it('keeps loading and retry visible while selection is unavailable', () => {
  const options = props()
  const view = render(picker({ ...options, compact: true, loaded: false }))
  const input = screen.getByRole('combobox') as HTMLInputElement
  expect(input.disabled).toBe(true)
  expect(input.getAttribute('aria-busy')).toBe('true')
  expect(screen.getByLabelText('Завантаження наборів даних')).toBeTruthy()
  view.rerender(picker({ ...options, compact: true, error: 'Не вдалося отримати набори.' }))
  expect(input.disabled).toBe(true)
  expect(screen.getByText('Не вдалося отримати набори.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(options.onRetry).toHaveBeenCalledOnce()
  expect(options.onChange).not.toHaveBeenCalled()
})

it('retains every financial limitation inside native expandable details', () => {
  const dataset = { ...valuationDataset, Limitations: [...valuationDataset.Limitations,
    'Різні одиниці не підсумовуються.', 'Договір визначає режим ПДВ.'] }
  render(<MantineProvider env="test"><ReportDatasetSummary dataset={dataset} /></MantineProvider>)
  expect(screen.getByText(dataset.Description)).toBeTruthy()
  const summary = screen.getByText('Межі розрахунку')
  const details = summary.closest('details')!
  expect(details.open).toBe(false)
  fireEvent.click(summary)
  expect(details.open).toBe(true)
  for (const limitation of dataset.Limitations) expect(details.contains(screen.getByText(limitation))).toBe(true)
})

it('shows no fabricated limitations or summary without an available dataset', () => {
  const view = render(<MantineProvider env="test"><ReportDatasetSummary /></MantineProvider>)
  expect(screen.queryByText('Межі розрахунку')).toBeNull()
  view.rerender(<MantineProvider env="test"><ReportDatasetSummary dataset={{ ...grossDataset, Limitations: [] }} /></MantineProvider>)
  expect(screen.getByText(grossDataset.Description)).toBeTruthy()
  expect(screen.queryByText('Межі розрахунку')).toBeNull()
})
