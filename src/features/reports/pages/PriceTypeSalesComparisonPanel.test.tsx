import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOneCTurnoverScopes, searchDatasetReportValues } from '../api/reportsApi'
import { PRICE_TYPE_ID, PRICE_TYPE_SCOPE } from '../data/priceTypeSalesComparison.test-fixtures'
import PriceTypeSalesComparisonPanel from './PriceTypeSalesComparisonPanel'

vi.mock('../api/reportsApi', async original => ({
  ...await original<typeof import('../api/reportsApi')>(),
  getOneCTurnoverScopes: vi.fn(),
  searchDatasetReportValues: vi.fn(),
}))

describe('PriceTypeSalesComparisonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([{
      Key: 'A'.repeat(64), Filters: structuredClone(PRICE_TYPE_SCOPE), OrganizationNames: ['Організація Fenix'],
      FirstDay: '2026-09-01', LastDay: '2026-09-30', LoadedDayCount: 30,
      OldestReadCompletedUtc: '2026-09-01T00:00:00Z', NewestReadCompletedUtc: '2026-09-30T00:00:00Z',
    }])
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: PRICE_TYPE_ID.toLowerCase(), Name: 'Оптова глобальна' }])
  })

  it('selects an available exact scope and one bounded global Fenix price type without agreement semantics', async () => {
    const onChange = vi.fn(), onScopeChange = vi.fn()
    render(<MantineProvider env="test"><PriceTypeSalesComparisonPanel dataSource={27} disabled={false}
      value={{ Version: 1, SourceWorld: 1, PriceTypeId: '' }} scope={undefined}
      onChange={onChange} onScopeChange={onScopeChange} /></MantineProvider>)

    expect(screen.getByText(/не формує договірних рекомендацій/)).toBeTruthy()
    expect(screen.getByText(/ніколи не підставляє ціну договору/)).toBeTruthy()
    expect(screen.getByText(/зовнішнє приєднання.*не включає день/)).toBeTruthy()
    expect(screen.getByText(/якщо ціни немає в усій групі/)).toBeTruthy()
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(27, 46,
      { value: '', offset: 0, limit: 30 }, expect.any(AbortSignal)))

    fireEvent.click(screen.getByRole('combobox', { name: 'Локальне покриття Fenix' }))
    fireEvent.click(await screen.findByRole('option', { name: /Організація Fenix/ }))
    expect(onScopeChange).toHaveBeenCalledWith(PRICE_TYPE_SCOPE)

    fireEvent.click(screen.getByRole('combobox', { name: 'Глобальний тип ціни Fenix' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Оптова глобальна' }))
    expect(onChange).toHaveBeenCalledWith({ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID })
  })
})
