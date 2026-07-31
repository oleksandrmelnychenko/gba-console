import { describe, expect, it } from 'vitest'
import {
  getRetailItemAvailableQty,
  getRetailItemBrand,
  getRetailItemImage,
  getRetailItemLocalCurrencyCode,
  getRetailItemMainOriginalNumber,
  getRetailItemProductName,
  getRetailItemSourceCurrencyCode,
  getRetailItemSourceUnitPrice,
  getRetailItemTotal,
  getRetailItemUnitPrice,
} from './onlineShopDisplay'
import type { RetailCartItem } from './onlineShopTypes'

describe('online-shop cart display', () => {
  it('maps the live retail cart payload to local and source money values', () => {
    const item: RetailCartItem = {
      PricePerItem: 30.39,
      Qty: 1,
      TotalAmount: 30.39,
      TotalAmountLocal: 1_562.05,
      Product: {
        AvailableQtyUk: 4,
        CurrencyCode: 'EUR',
        CurrentLocalPrice: 1_562.05,
        CurrentPrice: 30.39,
        Description: 'MERCEDES',
        MainOriginalNumber: '9603233200',
        NameUA: 'Амортизатор',
        VendorCode: 'SEM18250',
      },
    }

    expect(getRetailItemProductName(item, item.Product)).toBe('Амортизатор')
    expect(getRetailItemTotal(item)).toBe(1_562.05)
    expect(getRetailItemUnitPrice(item)).toBe(1_562.05)
    expect(getRetailItemLocalCurrencyCode(item)).toBe('UAH')
    expect(getRetailItemSourceCurrencyCode(item, item.Product)).toBe('EUR')
    expect(getRetailItemSourceUnitPrice(item, item.Product)).toBe(30.39)
    expect(getRetailItemMainOriginalNumber(item.Product)).toBe('9603233200')
    expect(getRetailItemBrand(item.Product)).toBe('MERCEDES')
    expect(getRetailItemAvailableQty(item.Product)).toBe(4)
    expect(getRetailItemImage(item, item.Product)).toBe(
      'https://concord-shop.com/userdata/shop/product/sem18250_water.jpg',
    )
  })

  it('prefers a persisted main image and rewrites internal API image origins', () => {
    const item: RetailCartItem = {
      Product: {
        ProductImages: [
          { ImageUrl: 'https://example.test/secondary.jpg' },
          { ImageUrl: 'https://85.17.167.167:20001/Images/products/main.jpg', IsMainImage: true },
        ],
        VendorCode: 'SEM18250',
      },
    }

    expect(getRetailItemImage(item, item.Product)).toBe('/Images/products/main.jpg')
  })
})
