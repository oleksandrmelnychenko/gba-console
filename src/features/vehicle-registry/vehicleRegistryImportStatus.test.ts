import { describe, expect, it } from 'vitest'
import { isRejectedVehicleRegistryImport } from './vehicleRegistryText'

describe('vehicle registry import history', () => {
  it('marks a refused file (failed, no rows) as rejected', () => {
    expect(isRejectedVehicleRegistryImport({ Status: 'failed', TotalRows: 0 })).toBe(true)
  })

  it('keeps real imports and imports that failed midway as they are', () => {
    expect(isRejectedVehicleRegistryImport({ Status: 'completed', TotalRows: 0 })).toBe(false)
    expect(isRejectedVehicleRegistryImport({ Status: 'failed', TotalRows: 120 })).toBe(false)
    expect(isRejectedVehicleRegistryImport({ Status: 'processing', TotalRows: 0 })).toBe(false)
  })
})
