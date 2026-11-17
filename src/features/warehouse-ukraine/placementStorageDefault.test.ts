import { describe, expect, it } from 'vitest'
import { resolvePlacementStorageId } from './placementStorageDefault'

const storages = [
  { Id: 7, NetUid: 'storage-other', Name: 'F2 Склад' },
  { Id: 1, NetUid: 'storage-main', Name: 'QA Склад основний' },
]

describe('resolvePlacementStorageId', () => {
  it('selects nothing for an order that has not been received yet, never the first storage', () => {
    expect(resolvePlacementStorageId(null, storages, null)).toBeNull()
    expect(resolvePlacementStorageId(undefined, storages, undefined)).toBeNull()
    expect(resolvePlacementStorageId('', storages, '')).toBeNull()
  })

  it('presets the storage the order has already been received to', () => {
    expect(resolvePlacementStorageId(null, storages, 'storage-main')).toBe('storage-main')
    expect(resolvePlacementStorageId(null, storages, 'STORAGE-MAIN')).toBe('storage-main')
  })

  it('keeps the pick of the user over the received storage across reloads', () => {
    expect(resolvePlacementStorageId('storage-other', storages, 'storage-main')).toBe('storage-other')
  })

  it('selects nothing when the received storage is not offered in the list', () => {
    expect(resolvePlacementStorageId(null, storages, 'storage-defective')).toBeNull()
  })

  it('drops a pick that is no longer in the list', () => {
    expect(resolvePlacementStorageId('storage-gone', storages, null)).toBeNull()
    expect(resolvePlacementStorageId('storage-gone', storages, 'storage-main')).toBe('storage-main')
    expect(resolvePlacementStorageId('storage-main', [], 'storage-main')).toBeNull()
  })
})
