import { describe, expect, it } from 'vitest'
import { defaultDatasetRequest, datasetConfigurationError } from './reportDatasets'
import { currentProfitMaximumDays, isProfitReadModeCapability } from './profitReadMode'
import { profitDayDataset, profitSupplierDataset, profitReadModeCapability } from './profitReadMode.test-fixtures'

describe('current GBA profit period advertised by the server', () => {
  it.each([profitDayDataset, profitSupplierDataset])('accepts two full months for form $DataSource and rejects day 63', dataset => {
    const supported = { ...dataset, profitReadMode: { ...profitReadModeCapability, CurrentDocumentsMaximumDays: 62 } }
    const request = {
      ...defaultDatasetRequest(dataset, '2026-07-01', '2026-08-31'),
      profitReadMode: 0,
      workbookPresentation: undefined,
      ...(dataset.DataSource === 35 ? { dayOrganizationBasis: 0 } : { supplierBasis: 0 }),
    }
    expect(datasetConfigurationError(request, supported)).toBeNull()
    expect(datasetConfigurationError({ ...request, to: '2026-09-01' }, supported)).toContain('62')
    expect(datasetConfigurationError(request, dataset)).toContain('31')
  })

  it('understands the two exact capabilities without widening an old server', () => {
    expect(isProfitReadModeCapability(profitReadModeCapability)).toBe(true)
    expect(currentProfitMaximumDays(profitReadModeCapability)).toBe(31)
    const current = { ...profitReadModeCapability, CurrentDocumentsMaximumDays: 62 }
    expect(isProfitReadModeCapability(current)).toBe(true)
    expect(currentProfitMaximumDays(current)).toBe(62)
    const lowerCase = Object.fromEntries(Object.entries(current).map(([key, value]) => [key.toLowerCase(), value]))
    expect(currentProfitMaximumDays(lowerCase)).toBe(62)
    expect(currentProfitMaximumDays(undefined)).toBe(31)
    expect(isProfitReadModeCapability({ ...current, currentDocumentsMaximumDays: 62 })).toBe(false)
  })

  it.each([0, 30, 32, 63, 62.5, '62', null])('refuses an unrecognized limit %s', limit => {
    const unsupported = { ...profitReadModeCapability, CurrentDocumentsMaximumDays: limit }
    expect(isProfitReadModeCapability(unsupported)).toBe(false)
    expect(currentProfitMaximumDays(unsupported)).toBe(31)
  })
})
