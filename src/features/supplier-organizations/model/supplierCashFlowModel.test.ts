import { describe, expect, it } from 'vitest'
import { getSupplierCashFlowCurrency, getSupplierCashFlowTypeLabel } from './supplierCashFlowModel'

const agreements = [
  { Currency: { Code: 'UAH' }, NetUid: 'agreement-uah' },
  { Currency: { Code: 'EUR' }, NetUid: 'agreement-eur' },
]

describe('supplier settlements model', () => {
  it('labels one agreement in its own currency and all agreements in EUR', () => {
    expect(getSupplierCashFlowCurrency(agreements, 'agreement-uah')).toBe('UAH')
    expect(getSupplierCashFlowCurrency(agreements, '')).toBe('EUR')
  })

  it.each([
    [10, 'Прихідна накладна'],
    [11, 'Видатковий ордер'],
    [17, 'Акт надання послуг'],
    [39, 'Витрати на доставку'],
  ])('names document type %s', (type, label) => {
    expect(getSupplierCashFlowTypeLabel(type)).toBe(label)
  })
})
