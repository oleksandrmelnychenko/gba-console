import { describe, expect, it } from 'vitest'
import type { Organization } from '../../types'
import { organizationHasVat } from './organizationVat'

const amg: Organization = { Id: 10561, VatRateId: 40, VatRate: { Id: 40, Value: 20 }, IsVatAgreements: true }
const fenix: Organization = { Id: 10562, VatRateId: 41, VatRate: { Id: 41, Value: 0 }, IsVatAgreements: false }

describe('organizationHasVat', () => {
  it('treats an explicit zero rate as a non-VAT organization', () => {
    expect(organizationHasVat(fenix)).toBe(false)
    expect(organizationHasVat(amg)).toBe(true)
  })

  it('resolves an unloaded rate from the organizations already known to the form', () => {
    const unloadedZero: Organization = { Id: 10563, VatRateId: 41 }
    const unloadedVat: Organization = { Id: 10564, VatRateId: 40 }

    expect(organizationHasVat(unloadedZero, [amg, fenix])).toBe(false)
    expect(organizationHasVat(unloadedVat, [amg, fenix])).toBe(true)
  })

  it('keeps the previous fallback when the rate value is unknown', () => {
    expect(organizationHasVat({ Id: 1, VatRateId: 41 })).toBe(true)
    expect(organizationHasVat({ Id: 1, VatRateId: 41 }, [{ Id: 2, VatRate: { Id: 41 } }])).toBe(true)
    expect(organizationHasVat({ Id: 1, IsVatAgreements: true })).toBe(true)
    expect(organizationHasVat({ Id: 1 })).toBe(false)
    expect(organizationHasVat(undefined, [amg])).toBe(false)
  })
})
