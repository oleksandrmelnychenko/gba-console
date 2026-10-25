import { describe, expect, it } from 'vitest'
import { buildWizardProductAvailabilityChips, buildWizardProductAvailabilityRows, getDefaultWizardProductChipIndex, getWizardProductChipRows } from './wizardProductAvailabilityModel'

describe('product detail availability model', () => {
  it('preserves visual order while reading legacy numeric total keys', () => {
    const chips = buildWizardProductAvailabilityChips({ TotalAvailabilities: { 0: 10, 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 } }, label => `translated:${label}`)
    expect(chips.map(chip => chip.count)).toEqual([10, 11, 12, 16, 13, 14, 15])
    expect(chips[3]).toEqual({ key: 'AvailableQtyUkReSale', name: 'translated:Перепродаж', count: 16 })
    expect(getDefaultWizardProductChipIndex(true)).toBe(1)
    expect(getDefaultWizardProductChipIndex(false)).toBe(2)
  })

  it('uses detailed rows ahead of totals and preserves row identity for cart transfer', () => {
    const row = { Amount: 2.5, Name: 'Київ', RegionCode: 'UA', OrderItem: { NetUid: 'order-row', User: { LastName: 'Петренко' } } }
    const data = { InAccounts: [row], TotalAvailabilities: { InAccount: 100 } }
    expect(buildWizardProductAvailabilityChips(data, s => s)[0].count).toBe(2.5)
    expect(getWizardProductChipRows(data, 0)[0]).toBe(row)
    expect(buildWizardProductAvailabilityRows(data, 0)).toEqual([
      { amount: 2.5, analyst: 'Петренко', key: 'order-row', name: 'Київ', regionCode: 'UA' },
    ])
  })

  it('maps resale and incoming stock to their actual collections', () => {
    const data = { AvailableQtyUkReSale: [{ Amount: 4, NetId: 'resale' }], AvailabilityInvoiceModel: [{ Amount: 3, Name: 'В дорозі' }] }
    expect(buildWizardProductAvailabilityRows(data, 3)[0]).toMatchObject({ amount: 4, key: 'resale' })
    expect(buildWizardProductAvailabilityRows(data, 6)[0]).toMatchObject({ amount: 3, name: 'В дорозі' })
  })

  it('handles missing snapshots, invalid selection and incomplete stock rows', () => {
    expect(buildWizardProductAvailabilityChips(null, s => s).every(chip => chip.count === 0)).toBe(true)
    for (const index of [null, -1, 99]) expect(buildWizardProductAvailabilityRows({}, index)).toEqual([])
    expect(buildWizardProductAvailabilityRows({ InStorageUkrVat: [{ Name: 'Склад' }] }, 1)).toEqual([
      { amount: 0, analyst: '', key: 'Склад|', name: 'Склад', regionCode: '' },
    ])
  })
})
