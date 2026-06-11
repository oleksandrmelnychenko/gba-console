import { describe, expect, it } from 'vitest'
import type { Client } from '../../../clients/types'
import type { SalesUkraineSale } from '../../types'
import {
  canReassignWizardSale,
  getReassignRootClientNetId,
  needsReassignRootLookup,
  SALE_LIFE_CYCLE_NEW,
} from './wizardReassignSaleModel'

const billSale = { BaseLifeCycleStatus: { SaleLifeCycleType: SALE_LIFE_CYCLE_NEW }, NetUid: 'sale-1' } as SalesUkraineSale

describe('reassign sale trigger gate', () => {
  it('requires both client and sale', () => {
    expect(canReassignWizardSale(null, billSale)).toBe(false)
    expect(canReassignWizardSale({ SubClients: [{ Id: 1 }] } as Client, null)).toBe(false)
  })

  it('allows only bill-stage sales', () => {
    const client = { SubClients: [{ Id: 1 }] } as Client

    expect(canReassignWizardSale(client, billSale)).toBe(true)
    expect(canReassignWizardSale(client, { BaseLifeCycleStatus: { SaleLifeCycleType: 1 } } as SalesUkraineSale)).toBe(false)
    expect(canReassignWizardSale(client, {} as SalesUkraineSale)).toBe(false)
  })

  it('requires the client to belong to a client structure', () => {
    expect(canReassignWizardSale({} as Client, billSale)).toBe(false)
    expect(canReassignWizardSale({ SubClients: [] } as Client, billSale)).toBe(false)
    expect(canReassignWizardSale({ SubClients: [{ Id: 1 }] } as Client, billSale)).toBe(true)
    expect(canReassignWizardSale({ IsSubClient: true } as Client, billSale)).toBe(true)
    expect(canReassignWizardSale({ IsTradePoint: true } as Client, billSale)).toBe(true)
  })
})

describe('reassign root client resolution', () => {
  it('prefers the root client net id over the clicked client', () => {
    expect(getReassignRootClientNetId({ NetUid: 'child', RootClient: { NetUid: 'root' } } as Client)).toBe('root')
  })

  it('falls back to the clicked client when no root is attached', () => {
    expect(getReassignRootClientNetId({ NetUid: 'self' } as Client)).toBe('self')
    expect(getReassignRootClientNetId({} as Client)).toBe(null)
  })

  it('requires a server root lookup for sub-clients and trade points without an attached root', () => {
    expect(needsReassignRootLookup({ IsSubClient: true, NetUid: 'child' } as Client)).toBe(true)
    expect(needsReassignRootLookup({ IsTradePoint: true, NetUid: 'point' } as Client)).toBe(true)
    expect(needsReassignRootLookup({ IsSubClient: true, NetUid: 'child', RootClient: { NetUid: 'root' } } as Client)).toBe(false)
    expect(needsReassignRootLookup({ IsSubClient: true } as Client)).toBe(false)
    expect(needsReassignRootLookup({ NetUid: 'root-self', SubClients: [{ Id: 1 }] } as Client)).toBe(false)
  })
})
