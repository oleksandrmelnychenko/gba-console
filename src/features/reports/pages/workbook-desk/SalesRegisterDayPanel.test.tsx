import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../../shared/api/apiClient'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { SalesRegisterDayPanel } from './SalesRegisterDayPanel'

vi.mock('../../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

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
