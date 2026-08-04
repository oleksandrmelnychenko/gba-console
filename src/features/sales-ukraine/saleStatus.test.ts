import { describe, expect, it } from 'vitest'
import {
  getSaleLifecycleStatusKey,
  getStatusTypeKey,
  isDiscountEditableSaleLifecycle,
  isDiscountPercentageEditableSaleLifecycle,
  isPackingAcceptanceSaleLifecycle,
  isStatusType,
} from './saleStatus'

describe('sale status helpers', () => {
  it('normalizes numeric and string enum values to the same key', () => {
    expect(getStatusTypeKey(0)).toBe('0')
    expect(getStatusTypeKey('0')).toBe('0')
    expect(getStatusTypeKey(null)).toBe('')
    expect(getStatusTypeKey(undefined)).toBe('')
  })

  it('matches numeric and string enum values against expected status', () => {
    expect(isStatusType(1, 1)).toBe(true)
    expect(isStatusType('1', 1)).toBe(true)
    expect(isStatusType('2', 1)).toBe(false)
    expect(isStatusType(undefined, 1)).toBe(false)
  })

  it('maps lifecycle enum values and legacy names to readable status keys', () => {
    expect(getSaleLifecycleStatusKey(0)).toBe('New')
    expect(getSaleLifecycleStatusKey('1')).toBe('Packaging')
    expect(getSaleLifecycleStatusKey('Packaged')).toBe('Packaged')
    expect(getSaleLifecycleStatusKey('SaleLifeCyclePackaging')).toBe('Packaging')
    expect(getSaleLifecycleStatusKey(102)).toBe('InvoiceChanged')
    expect(getSaleLifecycleStatusKey(undefined)).toBe('')
  })

  it('allows one-time discount comments only for lifecycle states the server accepts (New, Packaging)', () => {
    expect(isDiscountEditableSaleLifecycle(0)).toBe(true)
    expect(isDiscountEditableSaleLifecycle('0')).toBe(true)
    expect(isDiscountEditableSaleLifecycle('New')).toBe(true)
    expect(isDiscountEditableSaleLifecycle('new')).toBe(true)
    expect(isDiscountEditableSaleLifecycle(1)).toBe(true)
    expect(isDiscountEditableSaleLifecycle('1')).toBe(true)
    expect(isDiscountEditableSaleLifecycle('Packaging')).toBe(true)
    expect(isDiscountEditableSaleLifecycle(2)).toBe(false)
    expect(isDiscountEditableSaleLifecycle('2')).toBe(false)
    expect(isDiscountEditableSaleLifecycle('Packaged')).toBe(false)
    expect(isDiscountEditableSaleLifecycle(3)).toBe(false)
    expect(isDiscountEditableSaleLifecycle('Shipping')).toBe(false)
    expect(isDiscountEditableSaleLifecycle(undefined)).toBe(false)
  })

  it('allows percentage editing only while the sale is New', () => {
    expect(isDiscountPercentageEditableSaleLifecycle(0)).toBe(true)
    expect(isDiscountPercentageEditableSaleLifecycle('New')).toBe(true)
    expect(isDiscountPercentageEditableSaleLifecycle(1)).toBe(false)
    expect(isDiscountPercentageEditableSaleLifecycle('Packaging')).toBe(false)
    expect(isDiscountPercentageEditableSaleLifecycle('Packaged')).toBe(false)
    expect(isDiscountPercentageEditableSaleLifecycle(undefined)).toBe(false)
  })

  it('matches the server packing-acceptance lifecycle contract (New, Packaging)', () => {
    expect(isPackingAcceptanceSaleLifecycle(0)).toBe(true)
    expect(isPackingAcceptanceSaleLifecycle('New')).toBe(true)
    expect(isPackingAcceptanceSaleLifecycle(1)).toBe(true)
    expect(isPackingAcceptanceSaleLifecycle('SaleLifeCyclePackaging')).toBe(true)
    expect(isPackingAcceptanceSaleLifecycle(2)).toBe(false)
    expect(isPackingAcceptanceSaleLifecycle('Packaged')).toBe(false)
    expect(isPackingAcceptanceSaleLifecycle(3)).toBe(false)
    expect(isPackingAcceptanceSaleLifecycle('Received')).toBe(false)
    expect(isPackingAcceptanceSaleLifecycle(undefined)).toBe(false)
  })
})
