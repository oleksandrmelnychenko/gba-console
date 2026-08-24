import { describe, expect, it } from 'vitest'
import {
  getRetailPaymentStatusPresentation,
  isRetailPaymentManagerConfirmed,
} from './retailPaymentStatus'
import { RetailPaymentStatusType } from './types'

describe('retail payment status', () => {
  it('keeps the full manager-to-accounting lifecycle visible', () => {
    expect(
      getRetailPaymentStatusPresentation(RetailPaymentStatusType.New).label,
    ).toBe('Очікує підтвердження')
    expect(
      getRetailPaymentStatusPresentation(RetailPaymentStatusType.Confirmed).label,
    ).toBe('Підтверджено менеджером')
    expect(
      getRetailPaymentStatusPresentation(
        RetailPaymentStatusType.ChangedToInvoice,
      ).label,
    ).toBe('Змінено на накладну')
    expect(
      getRetailPaymentStatusPresentation(RetailPaymentStatusType.PartialPaid)
        .label,
    ).toBe('Частково оплачено')
    expect(
      getRetailPaymentStatusPresentation(RetailPaymentStatusType.Paid).label,
    ).toBe('Оплачено')
  })

  it('treats only a known non-new state as manager-confirmed', () => {
    expect(isRetailPaymentManagerConfirmed(RetailPaymentStatusType.New)).toBe(false)
    expect(isRetailPaymentManagerConfirmed(RetailPaymentStatusType.Confirmed)).toBe(true)
    expect(isRetailPaymentManagerConfirmed(RetailPaymentStatusType.ChangedToInvoice)).toBe(true)
    expect(isRetailPaymentManagerConfirmed(RetailPaymentStatusType.PartialPaid)).toBe(true)
    expect(isRetailPaymentManagerConfirmed(RetailPaymentStatusType.Paid)).toBe(true)
    expect(isRetailPaymentManagerConfirmed(undefined)).toBe(false)
    expect(isRetailPaymentManagerConfirmed(99)).toBe(false)
  })
})
