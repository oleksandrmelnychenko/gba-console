import { describe, expect, it } from 'vitest'
import { allDailySyncTypes, dailySyncTypeOptions } from './syncOptions'
import { SyncProductConsignmentType } from './types'

describe('daily sync type options', () => {
  it('keeps every daily checkbox mapped to the backend enum value', () => {
    expect(dailySyncTypeOptions).toEqual([
      { label: 'Прихідні накладні на товар', value: String(SyncProductConsignmentType.Order) },
      { label: 'Оприходування', value: String(SyncProductConsignmentType.Capitalization) },
      { label: 'Повернення від клієнта', value: String(SyncProductConsignmentType.SaleReturn) },
      { label: 'Переміщення товарів', value: String(SyncProductConsignmentType.ProductTransfers) },
      { label: 'Списання товарів', value: String(SyncProductConsignmentType.DepreciatedOrders) },
      { label: 'Акт списання оприходування', value: String(SyncProductConsignmentType.ActProductTransfers) },
      { label: 'Рахунки та Видаткові накладні', value: String(SyncProductConsignmentType.Sales) },
      { label: 'Прибуткові касові ордери', value: String(SyncProductConsignmentType.IncomeCashOrder) },
      { label: 'Прибуткові банківські ордери', value: String(SyncProductConsignmentType.IncomeBankOrder) },
      { label: 'Видаткові касові ордери', value: String(SyncProductConsignmentType.OutcomeCashOrder) },
      { label: 'Видаткові банківські ордери', value: String(SyncProductConsignmentType.OutcomeBankOrder) },
      {
        label: 'Внутрішнє переміщення грошових коштів',
        value: String(SyncProductConsignmentType.InternalMovementOfFunds),
      },
    ])
  })

  it('uses all daily checkbox values for select-all', () => {
    expect(allDailySyncTypes).toEqual(dailySyncTypeOptions.map((option) => option.value))
    expect(allDailySyncTypes).toHaveLength(12)
  })
})
