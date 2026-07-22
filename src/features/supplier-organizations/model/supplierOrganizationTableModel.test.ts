import { describe, expect, it } from 'vitest'
import type { SupplyOrganization } from '../types'
import {
  deduplicateSupplyOrganizationsByIdentity,
  getAgreementCurrencies,
  getAgreementNames,
  getAgreementOrganizations,
  getSupplyOrganizationAgreementCellText,
  getSupplyOrganizationBankCellText,
  getSupplyOrganizationContactCellText,
  getSupplyOrganizationNameCellText,
} from './supplierOrganizationTableModel'

describe('supplierOrganizationTableModel', () => {
  it('keeps agreement owners out of the supplier name subtitle', () => {
    const organization = supplier({
      Name: 'Постачальник',
      Address: 'Київ',
      ContactPersonName: 'Олена',
      SupplyOrganizationAgreements: [
        { Organization: { Name: 'Фенікс' } },
      ],
    })

    expect(getSupplyOrganizationNameCellText(organization)).toEqual({
      primary: 'Постачальник',
      secondary: 'Київ',
    })
  })

  it('does not repeat the same phone or bank account on both cell lines', () => {
    const organization = supplier({
      BankAccount: 'UA123',
      PhoneNumber: '+380501234567',
    })

    expect(getSupplyOrganizationContactCellText(organization)).toEqual({
      primary: '+380501234567',
      secondary: '',
    })
    expect(getSupplyOrganizationBankCellText(organization)).toEqual({
      primary: 'UA123',
      secondary: '',
    })
  })

  it('keeps distinct secondary contact and bank values', () => {
    const organization = supplier({
      Bank: 'Банк',
      BankAccount: 'UA123',
      ContactPersonEmail: 'person@example.com',
      ContactPersonName: 'Олена',
    })

    expect(getSupplyOrganizationContactCellText(organization)).toEqual({
      primary: 'Олена',
      secondary: 'person@example.com',
    })
    expect(getSupplyOrganizationBankCellText(organization)).toEqual({
      primary: 'Банк',
      secondary: 'UA123',
    })
  })

  it('aggregates unique agreement data from every agreement', () => {
    const organization = supplier({
      SupplyOrganizationAgreements: [
        {
          Currency: { Code: 'UAH' },
          Name: 'Основний договір',
          Organization: { Name: 'Фенікс' },
        },
        {
          Currency: { Code: 'EUR' },
          Name: 'Договір EUR',
          Organization: { Name: 'ТОВ «АМГ»' },
        },
        {
          Currency: { Code: 'UAH' },
          Name: 'Основний договір',
          Organization: { Name: 'Фенікс' },
        },
      ],
    })

    expect(getAgreementOrganizations(organization)).toBe('Фенікс · ТОВ «АМГ»')
    expect(getAgreementNames(organization)).toBe('Основний договір · Договір EUR')
    expect(getAgreementCurrencies(organization)).toBe('UAH · EUR')
    expect(getSupplyOrganizationAgreementCellText(organization)).toEqual({
      primary: 'Фенікс · ТОВ «АМГ»',
      secondary: 'Основний договір · Договір EUR · UAH · EUR',
    })
  })

  it('removes only repeated identities and keeps same-name records distinct', () => {
    const first = supplier({ NetUid: 'supplier-1', Name: 'Одна назва' })
    const repeatedIdentity = supplier({ NetUid: 'supplier-1', Name: 'Одна назва' })
    const distinctIdentity = supplier({ NetUid: 'supplier-2', Name: 'Одна назва' })
    const idLessFirst = supplier({ Name: 'Без id' })
    const idLessSecond = supplier({ Name: 'Без id' })

    expect(deduplicateSupplyOrganizationsByIdentity([
      first,
      repeatedIdentity,
      distinctIdentity,
      idLessFirst,
      idLessSecond,
    ])).toEqual([
      first,
      distinctIdentity,
      idLessFirst,
      idLessSecond,
    ])
  })

  it('uses the numeric id only when NetUid is absent', () => {
    const first = supplier({ Id: 7 })
    const repeatedIdentity = supplier({ Id: 7 })
    const sameIdWithNetUid = supplier({ Id: 7, NetUid: 'supplier-7' })

    expect(deduplicateSupplyOrganizationsByIdentity([
      first,
      repeatedIdentity,
      sameIdWithNetUid,
    ])).toEqual([
      first,
      sameIdWithNetUid,
    ])
  })
})

function supplier(overrides: SupplyOrganization): SupplyOrganization {
  return overrides
}
