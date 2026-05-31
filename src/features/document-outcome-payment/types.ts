import type {
  ClientAgreement,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentMovementOperation,
  PaymentRegister,
} from '../income-cashflows/types'

export type OutcomePaymentRegister = PaymentRegister & {
  Culture?: string
  DefaultPaymentCurrencyRegister?: PaymentCurrencyRegister | null
}

export type OutcomeOrganization = Organization & {
  Culture?: string
}

export type OutcomePaymentOrder = {
  Amount?: number
  ClientAgreement?: ClientAgreement | null
  Comment?: string
  FromDate?: string
  Organization?: OutcomeOrganization | null
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
}

export type DocumentOutcomePaymentSource =
  | {
      amount: number
      clientNetId?: string
      clientName?: string
      created?: string
      documentNetId: string
      type: 'taxfree'
    }
  | {
      amount: number
      clientNetId?: string
      clientName?: string
      created?: string
      documentNetId: string
      type: 'sad'
    }

export type { ClientAgreement, Organization, PaymentMovement, PaymentRegister }
