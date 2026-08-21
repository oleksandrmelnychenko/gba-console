import { describe, expect, it } from 'vitest'
import type { Client, ClientAgreement } from '../../../clients/types'
import {
  buildWizardClientStacks,
  getWizardAgreementDebtAgeDays,
  getWizardAgreementDebtPresentation,
  getWizardAgreementOverdueDays,
  isWizardSaleClientSelectable,
} from './wizardClientStepModel'

describe('wizard client folder selection', () => {
  it('expands all exact XM05200 children and does not expose the folder as a sale client', () => {
    const folder = createClient(100, 'XM05200')
    const children = ['XM05202', 'XM05203', 'XM05205', 'XM05206', 'XM05201', 'XM05204']
      .map((code, index) => createClient(index + 1, code))

    folder.SubClients = children.map((child, index) => ({
      Id: index + 1,
      SubClient: child,
    }))

    expect(isWizardSaleClientSelectable(folder)).toBe(false)
    expect(buildWizardClientStacks(folder)).toEqual({
      bottom: children,
      top: [],
    })
  })

  it('keeps a consolidated non-00 root selectable while exposing its persisted children', () => {
    const client = createClient(1, 'VI03501')
    const child = createClient(2, 'VI03503')
    client.SubClients = [{ Id: 1, SubClient: child }]

    expect(isWizardSaleClientSelectable(client)).toBe(true)
    expect(buildWizardClientStacks(client)).toEqual({ bottom: [child], top: [] })
  })
})

describe('wizard agreement debt presentation', () => {
  it('keeps available advance separate from accounting balance and outstanding debt', () => {
    const clientAgreement: ClientAgreement = {
      AccountBalance: 999,
      CurrentAmount: 125.5,
      Agreement: {
        AmountDebt: 300,
        IsControlAmountDebt: true,
        NumberDaysDebt: 30,
        ClientInDebts: [
          { Debt: { Days: 45, Total: 100.127 } },
          { Debt: { Days: 20, Total: 50 } },
          { Debt: { Days: 10, Total: -25 } },
        ],
      },
    }

    expect(getWizardAgreementDebtPresentation(clientAgreement)).toEqual({
      availableAdvance: 125.5,
      creditLimit: 300,
      debtAgeDays: 45,
      isOverdue: true,
      outstandingDebt: 150.13,
      overdueDays: 15,
    })
  })

  it('treats a zero debt amount as an unconfigured credit limit', () => {
    const presentation = getWizardAgreementDebtPresentation({
      Agreement: {
        AmountDebt: 0,
        IsControlAmountDebt: true,
      },
    })

    expect(presentation.creditLimit).toBeNull()
  })

  it('uses explicit backend debt age and overdue days, including explicit zero', () => {
    const agreement = {
      DebtAgeDays: 12,
      IsOverdue: false,
      NumberDaysDebt: 30,
      OverdueDays: 0,
      ClientInDebts: [{ Debt: { Days: 90, Total: 10 } }],
    }

    expect(getWizardAgreementDebtAgeDays(agreement)).toBe(12)
    expect(getWizardAgreementOverdueDays(agreement)).toBe(0)
    expect(getWizardAgreementDebtPresentation({ Agreement: agreement }).isOverdue).toBe(false)
  })

  it('derives overdue days from debt age minus the agreement term only when explicit data is absent', () => {
    const agreement = {
      NumberDaysDebt: 14,
      ClientInDebts: [
        { Debt: { Days: 8, Total: 10 } },
        { Debt: { Days: 36, Total: 20 } },
      ],
    }

    expect(getWizardAgreementDebtAgeDays(agreement)).toBe(36)
    expect(getWizardAgreementOverdueDays(agreement)).toBe(22)
  })

  it('marks the credit limit as not configured when amount control is disabled', () => {
    const presentation = getWizardAgreementDebtPresentation({
      CurrentAmount: -20,
      Agreement: {
        AmountDebt: 500,
        IsControlAmountDebt: false,
      },
    })

    expect(presentation.availableAdvance).toBe(0)
    expect(presentation.creditLimit).toBeNull()
  })
})

function createClient(id: number, code: string): Client {
  return {
    FullName: code,
    Id: id,
    NetUid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    RegionCode: { Value: code },
  }
}
