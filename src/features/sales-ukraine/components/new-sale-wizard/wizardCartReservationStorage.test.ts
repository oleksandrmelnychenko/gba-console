import { describe, expect, it } from 'vitest'
import { formatReservationStorages, getReservationStorages } from './wizardCartReservationStorage'

const storage = (name: string, priority: number, reSale = false) => ({ Name: name, RetailPriority: priority, AvailableForReSale: reSale })

describe('cart reservation storage (storage priority rule)', () => {
  it('lists the storages a line reserves from in priority order with their quantities', () => {
    const storages = getReservationStorages({
      ProductReservations: [
        { Qty: 1, IsReSaleReservation: true, ProductAvailability: { StorageId: 10010, Storage: storage('D3 Ресейл', 50, true) } },
        { Qty: 4, IsReSaleReservation: true, ProductAvailability: { StorageId: 10017, Storage: storage('D3 Ресейл 2', 9, true) } },
        { Qty: 2, IsReSaleReservation: true, ProductAvailability: { StorageId: 10017, Storage: storage('D3 Ресейл 2', 9, true) } },
      ],
    })

    expect(storages).toEqual([
      { name: 'D3 Ресейл 2', priority: 9, qty: 6, isReSale: true },
      { name: 'D3 Ресейл', priority: 50, qty: 1, isReSale: true },
    ])
    expect(formatReservationStorages(storages, String)).toBe(
      'Резерв: D3 Ресейл 2 (пріоритет 9, для перепродажу) — 6; D3 Ресейл (пріоритет 50, для перепродажу) — 1',
    )
  })

  it('puts the main storage before resale storages of the same priority', () => {
    const storages = getReservationStorages({
      ProductReservations: [
        { Qty: 3, IsReSaleReservation: true, ProductAvailability: { StorageId: 2, Storage: storage('QA Склад ресейл', 0, true) } },
        { Qty: 5, IsReSaleReservation: false, ProductAvailability: { StorageId: 1, Storage: storage('QA Склад основний', 0) } },
      ],
    })

    expect(storages.map((item) => item.name)).toEqual(['QA Склад основний', 'QA Склад ресейл'])
  })

  it('shows nothing for a line without a live reservation', () => {
    expect(formatReservationStorages(getReservationStorages({}), String)).toBeNull()
    expect(getReservationStorages({ ProductReservations: [{ Qty: 0, ProductAvailability: { Storage: storage('X', 1) } }] })).toEqual([])
  })
})
