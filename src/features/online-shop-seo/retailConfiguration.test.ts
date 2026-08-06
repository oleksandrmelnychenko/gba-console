import { describe, expect, it } from 'vitest'
import { hasCompatibleEcommerceStorage, hasValidRetailConfiguration } from './retailConfiguration'
import type { OnlineShopClient, OnlineShopStorage } from './types'

const storages: OnlineShopStorage[] = [
  {
    Id: 2618,
    ForEcommerce: true,
    ForVatProducts: true,
    OrganizationId: 10485,
    RetailPriority: 0,
  },
  {
    Id: 2625,
    ForEcommerce: true,
    ForVatProducts: false,
    OrganizationId: 10487,
    RetailPriority: 2,
  },
]

function createClient(organizationId: number, withVat: boolean, isForRetail = false): OnlineShopClient {
  return {
    IsForRetail: isForRetail,
    ClientAgreements: [{
      Agreement: {
        IsActive: true,
        OrganizationId: organizationId,
        WithVATAccounting: withVat,
      },
    }],
  }
}

describe('online-shop retail configuration', () => {
  it('requires the agreement organization and VAT mode to match the same ecommerce storage', () => {
    expect(hasCompatibleEcommerceStorage(createClient(10485, true), storages)).toBe(true)
    expect(hasCompatibleEcommerceStorage(createClient(10485, false), storages)).toBe(false)
    expect(hasCompatibleEcommerceStorage(createClient(10487, false), storages)).toBe(true)
  })

  it('ignores disabled agreements and unselected storages', () => {
    const client = createClient(10485, true)
    client.ClientAgreements![0].Agreement!.IsActive = false

    expect(hasCompatibleEcommerceStorage(client, storages)).toBe(false)
    expect(hasCompatibleEcommerceStorage(createClient(10485, true), [{ ...storages[0], ForEcommerce: false }])).toBe(false)
  })

  it('requires an active retail client with a compatible storage', () => {
    expect(hasValidRetailConfiguration([createClient(10485, true, true)], storages)).toBe(true)
    expect(hasValidRetailConfiguration([createClient(10485, false, true)], storages)).toBe(false)
    expect(hasValidRetailConfiguration([createClient(10485, true, false)], storages)).toBe(false)
  })
})
