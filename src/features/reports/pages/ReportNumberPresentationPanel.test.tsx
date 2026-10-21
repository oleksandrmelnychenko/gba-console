import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ReportNumberPresentationPanel } from './ReportNumberPresentationPanel'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
const dataset = { ...reportDatasets[0], numberPresentation: { version: 1, moneyScales: [1, 1000, 1000000], minimumDecimalPlaces: 0, maximumDecimalPlaces: 6 }, Measurements: [{ Type: 2, Name: 'Перейменована сума', valueSemantics: { kind: 'money' as const, currencyPolicy: 'EUR', unitPolicy: 'currency', scalable: true, aggregation: 'sum', defaultDecimalPlaces: 2 } }] }
it('keeps legacy default explicit, edits only supported kinds and resets to absent rather than persisting replacement defaults', () => {
  const change = vi.fn()
  const view = render(<MantineProvider env="test"><ReportNumberPresentationPanel dataset={dataset} value={undefined} disabled={false} onChange={change} /></MantineProvider>)
  expect(screen.getByRole('combobox', { name: 'Формат чисел' })).toHaveProperty('value', 'Як у звіті')
  fireEvent.click(screen.getByRole('combobox', { name: 'Формат чисел' }))
  fireEvent.click(screen.getByRole('option', { name: 'Налаштувати' }))
  expect(change).toHaveBeenLastCalledWith({ version: 1, moneyScale: 1 })
  view.rerender(<MantineProvider env="test"><ReportNumberPresentationPanel dataset={dataset} value={{ version: 1, moneyScale: 1000 }} disabled={false} onChange={change} /></MantineProvider>)
  expect(screen.getByRole('combobox', { name: 'Грошові суми: знаки після коми' })).toBeTruthy()
  expect(screen.queryByRole('combobox', { name: 'Кількість: знаки після коми' })).toBeNull()
  fireEvent.click(screen.getByRole('combobox', { name: 'Формат чисел' }))
  fireEvent.click(screen.getByRole('option', { name: 'Як у звіті' }))
  expect(change).toHaveBeenLastCalledWith(undefined)
})
