import type {
  ClientAgreement,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentMovementOperation,
  PaymentRegister,
} from '../income-cashflows/types'
import type { PersistedEntityReference } from './externalDocumentPayment'

export type ExternalClientAgreement = PersistedEntityReference & {
  Agreement?: {
    Currency?: {
      Code?: string
      Name?: string
    } | null
    Name?: string
    Number?: string
  } | null
  ClientId?: number
  Name?: string
  Number?: string
}

export type ExternalOrganizationClientAgreement = PersistedEntityReference & {
  Currency?: {
    Code?: string
    Name?: string
  } | null
  Number?: string
  OrganizationClientId?: number
}

export type OutcomePaymentRegister = PaymentRegister & {
  Culture?: string
  DefaultPaymentCurrencyRegister?: PaymentCurrencyRegister | null
}

export type OutcomeOrganization = Organization & {
  Culture?: string
}

export type OutcomePaymentOrder = {
  Amount?: number
  ClientAgreement?: ExternalClientAgreement | null
  Comment?: string
  FromDate?: string
  Organization?: OutcomeOrganization | null
  OrganizationClientAgreement?: ExternalOrganizationClientAgreement | null
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
}

export type DocumentOutcomePaymentSource =
  | {
      amount: number
      clientNetId?: string
      clientName?: string
      documentDate?: string
      documentNetId: string
      type: 'taxfree'
    }
  | {
      amount: number
      clientAgreement?: ExternalClientAgreement | null
      clientNetId?: string
      clientName?: string
      counterpartyKind: 'client' | 'organization'
      documentDate?: string
      documentNetId: string
      organizationClientAgreement?: ExternalOrganizationClientAgreement | null
      organizationClientAgreements?: ExternalOrganizationClientAgreement[]
      type: 'sad'
    }

export type { ClientAgreement, Organization, PaymentMovement, PaymentRegister }
