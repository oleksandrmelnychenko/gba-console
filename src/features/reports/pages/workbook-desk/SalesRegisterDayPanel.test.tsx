import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../../shared/api/apiClient'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { SalesRegisterDayPanel } from './SalesRegisterDayPanel'

vi.mock('../../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('scopes workbook returns to the chosen period and preserves it across worlds', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ From: '2026-11-19', Day: '2026-11-20', CapturedUtc: '2026-11-21T00:00:00Z',
    Totals: [], Lines: [], World: 'Fenix', TotalLines: 0 })
  render(<MantineProvider env="test"><I18nProvider><SalesRegisterDayPanel
    workbook={{ from: '2026-01-19', to: '2026-01-20', returnsOnly: true }} /></I18nProvider></MantineProvider>)
  const run = screen.getByRole('button', { name: 'Сформувати' })
  for (const world of ['Fenix', 'AMG']) {
    fireEvent.change(screen.getByLabelText('База 1С'), { target: { value: world } })
    fireEvent.click(run)
    expect(await screen.findByText('За обраний період рухів немає.')).toBeTruthy()
    expect(apiRequest).toHaveBeenLastCalledWith('/report/datasets/sales-register-day', expect.objectContaining({
      query: expect.objectContaining({ from: '2026-01-19', day: '2026-01-20', world, returnsOnly: true, offset: 0 }),
    }))
  }
  fireEvent.change(screen.getByLabelText('Період з'), { target: { value: '2026-01-21' } })
  expect((run as HTMLButtonElement).disabled).toBe(true)
})

it('shows only the selected register and clears the previous total when switching worlds', async () => {
  const amounts = { Net: 10, Vat: 2, Cost: 8, CostVat: 1, Profit: 2 }
  vi.mocked(apiRequest).mockResolvedValueOnce({ World: 'Fenix', Day: '2026-01-01', CapturedUtc: '2026-01-02T05:00:00Z',
    GrandTotal: amounts, Totals: [{ ...amounts, Organization: 'Фенікс', RecorderType: 290, Lines: 1 }], TotalLines: 1,
    Lines: [{ ...amounts, Organization: 'Фенікс', RecorderType: 290, DocumentId: 'doc', DocumentNumber: 'F-1',
      ProductId: 'product', Article: 'Fenix SKU', Quantity: 1 }] })
    .mockResolvedValueOnce({ World: 'AMG', Day: '2026-01-01', CapturedUtc: '2026-01-02T05:00:00Z',
      GrandTotal: amounts, Totals: [], Lines: [], TotalLines: 0 })
  render(<MantineProvider env="test"><I18nProvider><SalesRegisterDayPanel /></I18nProvider></MantineProvider>)
  fireEvent.change(screen.getByLabelText('Дата рухів'), { target: { value: '2026-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect(await screen.findByText('Fenix SKU')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'База 1С' }), { target: { value: 'AMG' } })
  expect(screen.queryByText('Fenix SKU')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect(await screen.findByText('За цю дату рухів немає.')).toBeTruthy()
  expect(vi.mocked(apiRequest).mock.calls.map(call => call[1]?.query)).toEqual([
    { day: '2026-01-01', world: 'Fenix', offset: 0 }, { day: '2026-01-01', world: 'AMG', offset: 0 },
  ])
})

it('shows historical UAH turnover alongside EUR profit and costs', async () => {
  const amounts = { Net: 2.18, Vat: 0.10, Cost: 1, CostVat: 0, Profit: 1.18, OriginalNetUah: 96, OriginalVatUah: 4 }
  vi.mocked(apiRequest).mockResolvedValue({ World: 'AMG', Day: '2025-02-03', CapturedUtc: '2026-11-24T18:00:00Z',
    GrandTotal: amounts, Totals: [{ ...amounts, Organization: 'АМГ', RecorderType: 345, Lines: 1 }],
    Lines: [], TotalLines: 1 })
  render(<MantineProvider env="test"><I18nProvider><SalesRegisterDayPanel /></I18nProvider></MantineProvider>)
  fireEvent.change(screen.getByLabelText('База 1С'), { target: { value: 'AMG' } })
  fireEvent.change(screen.getByLabelText('Дата рухів'), { target: { value: '2025-02-03' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  expect((await screen.findAllByRole('columnheader', { name: 'Валовий прибуток (€)' })).length).toBe(2)
  expect(screen.getAllByRole('columnheader', { name: 'Продаж без ПДВ у регістрі (₴)' })).toHaveLength(2)
  expect(screen.getAllByText('96,00')).toHaveLength(2)
  expect(screen.getAllByText('1,18')).toHaveLength(2)
})
