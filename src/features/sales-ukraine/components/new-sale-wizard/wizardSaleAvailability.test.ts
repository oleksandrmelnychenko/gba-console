import { describe, expect, it } from 'vitest'
import type { WizardTotalProductAvailabilities } from './newSaleWizardApi'
import {
  getWizardAvailabilityChipCount,
  getWizardAvailabilityRows,
  getWizardDetailedSellableQty,
  getWizardDetailedStorageQty,
} from './wizardSaleAvailability'
import type { WizardSaleProduct } from './wizardSaleProduct'

describe('wizard sale detailed availability', () => {
  it('uses storage rows before stale total aggregates', () => {
    const availabilities: WizardTotalProductAvailabilities = {
      AvailableQtyUkReSale: [{ Amount: 4, Name: 'Resale' }],
      InStorageUkrNotVat: [
        { Amount: 2, Name: 'Phoenix' },
        { Amount: 3, Name: 'AMG' },
      ],
      TotalAvailabilities: {
        AvailableQtyUkReSale: 99,
        StorageUkrNotVat: 99,
      },
    }

    expect(getWizardAvailabilityChipCount(availabilities, 'StorageUkrNotVat', 2)).toBe(5)
    expect(getWizardAvailabilityChipCount(availabilities, 'AvailableQtyUkReSale', 6)).toBe(4)
    expect(getWizardDetailedStorageQty({ AvailableQtyUk: 1, AvailableQtyUkReSale: 1 } as WizardSaleProduct, false, availabilities)).toBe(5)
    expect(getWizardDetailedSellableQty({ AvailableQtyUk: 1, AvailableQtyUkReSale: 1 } as WizardSaleProduct, false, availabilities)).toBe(9)
  })

  it('keeps warehouse and resale rows separate', () => {
    const availabilities: WizardTotalProductAvailabilities = {
      AvailableQtyUkReSale: [{ Amount: 2, Name: 'AMG' }],
      InStorageUkrNotVat: [{ Amount: 7, Name: 'Phoenix' }],
    }

    expect(getWizardAvailabilityRows(availabilities, 'StorageUkrNotVat').map((row) => row.Name)).toEqual(['Phoenix'])
    expect(getWizardAvailabilityRows(availabilities, 'AvailableQtyUkReSale').map((row) => row.Name)).toEqual(['AMG'])
  })
})
