import { describe, expect, it } from 'vitest'
import type { ClientAgreement } from '../../../clients/types'
import {
  getWizardAgreementDebtAgeDays,
  getWizardAgreementDebtPresentation,
  getWizardAgreementOverdueDays,
} from './wizardClientStepModel'

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
