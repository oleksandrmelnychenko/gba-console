import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { presentedCashDataset, presentedCashRequest, presentedDayDataset, presentedSettlementDataset } from '../data/workbookPresentation.test-fixtures'
import { WorkbookPresentationPanel } from './WorkbookPresentationPanel'

it('offers exact current captions and emits an ordered subset without a financial grouping change', () => {
  const onChange = vi.fn(), request = presentedCashRequest()
  render(<MantineProvider env="test"><WorkbookPresentationPanel dataset={presentedCashDataset} request={request}
    value={{ version: 1, additionalFields: [33], ordering: null }} disabled={false} onChange={onChange} /></MantineProvider>)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Валюта рахунку (каси)' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ version: 1, additionalFields: [33, 30], ordering: null })
  expect(request.sorted.Row.map(row => row.type)).toEqual([40])
})
it('keeps retained Article/Top labels as settings and explicitly selects MonthAscending', () => {
  const request = defaultDatasetRequest(presentedDayDataset, '2026-10-01', '2026-10-04'), onChange = vi.fn()
  render(<MantineProvider env="test"><WorkbookPresentationPanel dataset={presentedDayDataset} request={request}
    value={undefined} disabled={false} onChange={onChange} /></MantineProvider>)
  expect(screen.getByText(/Значення товарів на рівні день/)).toBeTruthy()
  fireEvent.click(screen.getByRole('combobox', { name: 'Порядок форми' }))
  fireEvent.click(screen.getByRole('option', { name: 'Місяць за зростанням' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ version: 1, additionalFields: [], ordering: 'MonthAscending' })
})
it('keeps manager and region visibly disabled for AMG while allowing its currency field', () => {
  const request = defaultDatasetRequest(presentedSettlementDataset, '2026-10-01', '2026-10-04')
  request.groupedSettlementPeriod = { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' }
  render(<MantineProvider env="test"><WorkbookPresentationPanel dataset={presentedSettlementDataset} request={request}
    value={undefined} disabled={false} onChange={vi.fn()} /></MantineProvider>)
  expect((screen.getByRole('checkbox', { name: 'Основний менеджер покупця' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('checkbox', { name: 'Код по региону' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('checkbox', { name: 'Валюта взаєморозрахунків' }) as HTMLInputElement).disabled).toBe(false)
})
it('does not silently convert an unknown saved selector and offers an explicit clear action', () => {
  const onChange = vi.fn()
  render(<MantineProvider env="test"><WorkbookPresentationPanel dataset={presentedCashDataset} request={presentedCashRequest()}
    value={{ version: 9, additionalFields: [999], ordering: null }} disabled={false} onChange={onChange} /></MantineProvider>)
  expect(screen.getByText(/Збережені налаштування не змінено/)).toBeTruthy()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Очистити налаштування форми' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined)
})
it('disables setting changes and clearing while permission is missing or a run is active', () => {
  const onChange = vi.fn()
  render(<MantineProvider env="test"><WorkbookPresentationPanel dataset={presentedCashDataset} request={presentedCashRequest()}
    value={{ version: 1, additionalFields: [30], ordering: null }} disabled onChange={onChange} /></MantineProvider>)
  expect((screen.getByRole('checkbox', { name: 'Валюта рахунку (каси)' }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Очистити налаштування форми' }) as HTMLButtonElement).disabled).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
})
