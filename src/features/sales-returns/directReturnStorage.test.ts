import { describe, expect, it } from 'vitest'
import {
  filterDirectReturnStorages,
  getDirectReturnStorageRequirement,
  isDirectReturnStorageAllowed,
} from './directReturnStorage'
import type { DirectSalesReturnProduct, SalesReturnStorage } from './types'

const regularStorage: SalesReturnStorage = { Id: 1, Name: 'Основний склад', ForDefective: false }
const defectiveStorage: SalesReturnStorage = { Id: 2, Name: 'Брак', ForDefective: true }
const unknownStorage: SalesReturnStorage = { Id: 3, Name: 'Склад без ознаки' }

describe('direct return storage rules', () => {
  it('does not expose storages before a return reason is known', () => {
    expect(filterDirectReturnStorages([regularStorage, defectiveStorage], [])).toEqual([])
    expect(getDirectReturnStorageRequirement([])).toEqual({ kind: null, mixed: false })
  })

  it('allows only defective storages for defect returns', () => {
    expect(filterDirectReturnStorages([regularStorage, defectiveStorage, unknownStorage], [], 6)).toEqual([
      defectiveStorage,
    ])
    expect(isDirectReturnStorageAllowed(defectiveStorage, 'defective')).toBe(true)
    expect(isDirectReturnStorageAllowed(regularStorage, 'defective')).toBe(false)
  })

  it('allows only regular storages for non-defect return reasons', () => {
    expect(filterDirectReturnStorages([regularStorage, defectiveStorage, unknownStorage], [], 4)).toEqual([
      regularStorage,
      unknownStorage,
    ])
    expect(isDirectReturnStorageAllowed(regularStorage, 'regular')).toBe(true)
    expect(isDirectReturnStorageAllowed(defectiveStorage, 'regular')).toBe(false)
  })

  it('marks mixed defect and regular reasons as incompatible for one direct return', () => {
    const items: DirectSalesReturnProduct[] = [
      {
        batch: {},
        product: { Id: 10 },
        qty: 1,
        status: 6,
      },
    ]

    expect(getDirectReturnStorageRequirement(items, 4)).toEqual({ kind: null, mixed: true })
    expect(filterDirectReturnStorages([regularStorage, defectiveStorage], items, 4)).toEqual([])
  })
})
