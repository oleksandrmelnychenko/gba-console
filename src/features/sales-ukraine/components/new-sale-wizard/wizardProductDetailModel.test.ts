import { describe, expect, it } from 'vitest'
import { buildWizardStockPriceLines, getWizardStockCurrencyPrice } from './wizardProductDetailModel'

describe('stock price presentation', () => {
  it('uses VAT stock and suppresses resale rows for VAT sales', () => {
    const rows = buildWizardStockPriceLines({ AvailableQtyUkVAT: 0, AvailableQtyUk: 7, AvailableQtyUkReSale: 3 }, true, 'UAH', 9)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'storage', qty: 0, label: 'ПДВ склад' })
  })

  it('retains EUR agreement prices and UAH conversion separately outside VAT sales', () => {
    const [storage, resale] = buildWizardStockPriceLines({
      CurrentPrice: 10, CurrentLocalPrice: 12, CurrentPriceEurToUah: 500,
      CurrentPriceReSale: 8, CurrentLocalPriceReSale: 9, CurrentPriceReSaleEurToUah: 400,
    }, false, 'EUR', 4)
    expect(storage.qty).toBe(4)
    expect(resale.qty).toBe(0)
    expect(getWizardStockCurrencyPrice(storage, 'EUR')).toBe(12)
    expect(getWizardStockCurrencyPrice(storage, 'UAH')).toBe(500)
    expect(getWizardStockCurrencyPrice(resale, 'EUR')).toBe(9)
    expect(getWizardStockCurrencyPrice(resale, 'UAH')).toBe(400)
  })

  it('keeps missing prices distinct from explicit zero prices', () => {
    const [storage, resale] = buildWizardStockPriceLines({ CurrentPrice: 0, CurrentLocalPrice: 0 }, false, 'UAH', 0)
    expect(getWizardStockCurrencyPrice(storage, 'EUR')).toBe(0)
    expect(getWizardStockCurrencyPrice(storage, 'UAH')).toBe(0)
    expect(getWizardStockCurrencyPrice(resale, 'EUR')).toBeNull()
    expect(getWizardStockCurrencyPrice(storage, 'PLN')).toBeNull()
  })
})
