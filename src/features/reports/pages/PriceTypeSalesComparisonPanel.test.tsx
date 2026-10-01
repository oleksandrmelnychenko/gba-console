import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPriceTypeSalesScopeChoices, getOneCTurnoverScopes, searchDatasetReportValues } from '../api/reportsApi'
import { PRICE_TYPE_ID, PRICE_TYPE_SCOPE, priceTypeSalesComparisonCapability } from '../data/priceTypeSalesComparison.test-fixtures'
import PriceTypeSalesComparisonPanel from './PriceTypeSalesComparisonPanel'

vi.mock('../api/reportsApi', async original => ({
  ...await original<typeof import('../api/reportsApi')>(),
  getCurrentPriceTypeSalesScopeChoices: vi.fn(),
  getOneCTurnoverScopes: vi.fn(),
  searchDatasetReportValues: vi.fn(),
}))

describe('PriceTypeSalesComparisonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentPriceTypeSalesScopeChoices).mockResolvedValue({
      Organizations: [{ Id: PRICE_TYPE_SCOPE.OrganizationIds[0], Name: 'Наша організація' }],
      ProductKinds: [{ Id: PRICE_TYPE_SCOPE.ProductKindId, Name: 'Товар' }], BuyerRootId: PRICE_TYPE_SCOPE.BuyerRootId,
    })
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

  it('explains the missing sales import when no local Fenix scope exists', async () => {
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([])
    render(<MantineProvider env="test"><PriceTypeSalesComparisonPanel dataSource={27} disabled={false}
      value={{ Version: 1, SourceWorld: 1, PriceTypeId: '' }} scope={undefined}
      onChange={vi.fn()} onScopeChange={vi.fn()} /></MantineProvider>)

    expect(await screen.findByText(/немає завантажених продажів Fenix/)).toBeTruthy()
  })

  it('selects current native organization and kind without captured turnover days or guessed IDs', async () => {
    const onScopeChange = vi.fn()
    const { rerender } = render(<MantineProvider env="test"><PriceTypeSalesComparisonPanel dataSource={27} disabled={false}
      capability={priceTypeSalesComparisonCapability} value={{ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, SalesBasis: 0 }}
      scope={undefined} onChange={vi.fn()} onScopeChange={onScopeChange} /></MantineProvider>)
    expect(screen.queryByRole('combobox', { name: 'Локальне покриття Fenix' })).toBeNull()
    expect(screen.getByText(/відповідна клітинка та залежний підсумок/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Організації поточних продажів'))
    fireEvent.click(await screen.findByRole('option', { name: 'Наша організація' }))
    const partial = onScopeChange.mock.calls.at(-1)![0]
    expect(partial).toEqual({ ...PRICE_TYPE_SCOPE, ProductKindId: '' })
    rerender(<MantineProvider env="test"><PriceTypeSalesComparisonPanel dataSource={27} disabled={false}
      capability={priceTypeSalesComparisonCapability} value={{ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, SalesBasis: 0 }}
      scope={partial} onChange={vi.fn()} onScopeChange={onScopeChange} /></MantineProvider>)
    fireEvent.click(screen.getByRole('combobox', { name: 'Вид товару поточних продажів' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Товар' }))
    expect(onScopeChange).toHaveBeenLastCalledWith(PRICE_TYPE_SCOPE)
    expect(getOneCTurnoverScopes).not.toHaveBeenCalled()
  })

  it('displays omitted saved basis as signed and changes it only on explicit choice', async () => {
    const onChange = vi.fn()
    render(<MantineProvider env="test"><PriceTypeSalesComparisonPanel dataSource={27} disabled={false}
      capability={priceTypeSalesComparisonCapability} value={{ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID }}
      scope={PRICE_TYPE_SCOPE} onChange={onChange} onScopeChange={vi.fn()} /></MantineProvider>)
    expect((screen.getByRole('combobox', { name: 'Основа продажів' }) as HTMLInputElement).value).toBe('Збережені рухи 1С')
    await waitFor(() => expect(getOneCTurnoverScopes).toHaveBeenCalled())
    expect(getCurrentPriceTypeSalesScopeChoices).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('combobox', { name: 'Основа продажів' }))
    fireEvent.click(screen.getByRole('option', { name: 'Наші продажі й повернення' }))
    expect(onChange).toHaveBeenCalledWith({ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, SalesBasis: 0 })
  })

  it('retains saved scope despite missing current choices and does not call an unadvertised API', async () => {
    const capability = { ...priceTypeSalesComparisonCapability }
    delete capability.OperationalScopePath
    delete capability.OperationalLookupFields
    const onScopeChange = vi.fn()
    render(<MantineProvider env="test"><PriceTypeSalesComparisonPanel dataSource={27} disabled={false}
      capability={capability} value={{ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, SalesBasis: 0 }}
      scope={PRICE_TYPE_SCOPE} onChange={vi.fn()} onScopeChange={onScopeChange} /></MantineProvider>)
    expect(screen.getByText(/Збережені точні відбори можна використовувати/)).toBeTruthy()
    expect(getCurrentPriceTypeSalesScopeChoices).not.toHaveBeenCalled()
    expect(getOneCTurnoverScopes).not.toHaveBeenCalled()
    expect(onScopeChange).not.toHaveBeenCalled()
  })

})
