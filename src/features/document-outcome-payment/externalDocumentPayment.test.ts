import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_SAFE_MONEY_MAX_VALUE,
  buildPartnerAgreementPayload,
  getExternalDocumentPaymentDateBounds,
  isSupportedAccountingAmount,
  isSupportedVat,
  pickExternalDocumentPaymentCurrencyRegister,
} from './externalDocumentPayment'

describe('external document payment contract', () => {
  it('builds an exclusive client agreement payload', () => {
    expect(buildPartnerAgreementPayload({ Id: 10 }, null)).toEqual({
      ClientAgreement: { Id: 10 },
    })
  })

  it('builds an exclusive organization-client agreement payload', () => {
    expect(buildPartnerAgreementPayload(null, { Id: 20, OrganizationClientId: 30 })).toEqual({
      OrganizationClientAgreement: { Id: 20, OrganizationClientId: 30 },
    })
  })

  it.each([
    [null, null],
    [{ Id: 10 }, { Id: 20 }],
    [{ NetUid: 'not-enough-for-external-orders' }, null],
  ])('rejects missing, ambiguous, or non-persisted agreement references', (clientAgreement, organizationClientAgreement) => {
    expect(buildPartnerAgreementPayload(clientAgreement, organizationClientAgreement)).toBeNull()
  })

  it('uses the backend 180-day payment window', () => {
    expect(getExternalDocumentPaymentDateBounds('2026-01-01T12:00:00')).toEqual({
      min: '2026-01-01',
      max: '2026-06-30',
    })
  })

  it('selects the PLN register instead of trusting the first currency', () => {
    const eurRegister = { Id: 1, Currency: { Code: 'EUR' } }
    const plnRegister = { Id: 2, Currency: { Code: ' pln ' } }

    expect(pickExternalDocumentPaymentCurrencyRegister({
      PaymentCurrencyRegisters: [eurRegister, plnRegister],
    })).toBe(plnRegister)
    expect(pickExternalDocumentPaymentCurrencyRegister({
      PaymentCurrencyRegisters: [eurRegister],
    })).toBeNull()
  })

  it('matches backend money and VAT limits', () => {
    expect(isSupportedAccountingAmount(0)).toBe(false)
    expect(isSupportedAccountingAmount(1.01)).toBe(true)
    expect(isSupportedAccountingAmount(1.15)).toBe(true)
    expect(isSupportedAccountingAmount(1.005)).toBe(false)
    expect(isSupportedAccountingAmount(100.004)).toBe(false)
    expect(isSupportedAccountingAmount(ACCOUNTING_SAFE_MONEY_MAX_VALUE)).toBe(true)
    expect(isSupportedAccountingAmount(ACCOUNTING_SAFE_MONEY_MAX_VALUE + 0.01)).toBe(false)
    expect(isSupportedVat(100, 20, 20)).toBe(true)
    expect(isSupportedVat(100, 101, 20)).toBe(false)
    expect(isSupportedVat(100, 20, 101)).toBe(false)
  })
})
