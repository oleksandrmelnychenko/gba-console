import { describe, expect, it } from 'vitest'
import type {
  SupplyOrganizationAgreementFormValues,
  SupplyOrganizationContactFormValues,
  SupplyOrganizationGeneralFormValues,
} from './types'
import {
  firstSupplierOrganizationValidationError,
  hasSupplierOrganizationEntityIdentity,
  isPersistedSupplyOrganizationAgreement,
  normalizeSupplierOrganizationContactForm,
  normalizeSupplierOrganizationGeneralForm,
  validateSupplierOrganizationContactForm,
  validateSupplierOrganizationGeneralForm,
  validateSupplyOrganizationAgreementForm,
} from './validation'

describe('supplier organization validation', () => {
  it('requires a visible supplier name and validates trimmed email values', () => {
    const values = generalValues({
      EmailAddress: ' invalid@example ',
      Name: '   ',
    })

    const errors = validateSupplierOrganizationGeneralForm(values)

    expect(errors).toEqual({
      EmailAddress: 'Некоректний email',
      Name: 'Вкажіть назву',
    })
    expect(firstSupplierOrganizationValidationError(errors)).toBe('Вкажіть назву')
  })

  it('normalizes general and contact text before it is sent to the API', () => {
    expect(normalizeSupplierOrganizationGeneralForm(generalValues({
      Address: ' Київ ',
      EmailAddress: ' office@example.com ',
      Name: ' Постачальник ',
    }))).toMatchObject({
      Address: 'Київ',
      EmailAddress: 'office@example.com',
      Name: 'Постачальник',
    })

    expect(normalizeSupplierOrganizationContactForm(contactValues({
      ContactPersonEmail: ' person@example.com ',
      ContactPersonName: ' Олена ',
    }))).toMatchObject({
      ContactPersonEmail: 'person@example.com',
      ContactPersonName: 'Олена',
    })
  })

  it('validates the contact email without requiring optional contact fields', () => {
    expect(validateSupplierOrganizationContactForm(contactValues())).toEqual({})
    expect(validateSupplierOrganizationContactForm(contactValues({
      ContactPersonEmail: 'not-an-email',
    }))).toEqual({
      ContactPersonEmail: 'Некоректний email',
    })
  })

  it('requires agreement relations and rejects impossible or reversed dates', () => {
    expect(validateSupplyOrganizationAgreementForm(agreementValues({
      currencyId: '',
      existFrom: '2026-02-30',
      name: ' ',
      organizationId: '',
    }))).toEqual({
      currencyId: 'Оберіть валюту',
      existFrom: 'Некоректна дата початку',
      name: 'Вкажіть назву договору',
      organizationId: 'Оберіть організацію',
    })

    expect(validateSupplyOrganizationAgreementForm(agreementValues({
      existFrom: '2026-08-10',
      existTo: '2026-08-09',
    }))).toEqual({
      existTo: 'Дата завершення не може бути раніше дати початку',
    })
  })

  it('treats either a NetUid or a positive numeric Id as persisted identity', () => {
    expect(hasSupplierOrganizationEntityIdentity({ NetUid: ' supplier-1 ' })).toBe(true)
    expect(hasSupplierOrganizationEntityIdentity({ Id: 7 })).toBe(true)
    expect(hasSupplierOrganizationEntityIdentity({ Id: 0, NetUid: ' ' })).toBe(false)
    expect(isPersistedSupplyOrganizationAgreement({ NetUid: 'agreement-1' })).toBe(true)
  })
})

function generalValues(
  overrides: Partial<SupplyOrganizationGeneralFormValues> = {},
): SupplyOrganizationGeneralFormValues {
  return {
    Address: '',
    EmailAddress: '',
    IsAgreementReceived: false,
    IsBillReceived: false,
    IsNotResident: false,
    Name: 'Постачальник',
    PhoneNumber: '',
    SROI: '',
    TIN: '',
    USREOU: '',
    ...overrides,
  }
}

function contactValues(
  overrides: Partial<SupplyOrganizationContactFormValues> = {},
): SupplyOrganizationContactFormValues {
  return {
    ContactPersonComment: '',
    ContactPersonEmail: '',
    ContactPersonName: '',
    ContactPersonPhone: '',
    ContactPersonSkype: '',
    ContactPersonViber: '',
    ...overrides,
  }
}

function agreementValues(
  overrides: Partial<SupplyOrganizationAgreementFormValues> = {},
): SupplyOrganizationAgreementFormValues {
  return {
    currencyId: 'currency-1',
    existFrom: '2026-07-24',
    existTo: '2027-07-24',
    files: [],
    name: 'Основний договір',
    number: '',
    organizationId: 'organization-1',
    ...overrides,
  }
}
