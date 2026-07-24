export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  FullName?: string
  Name?: string
}

export type Organization = NamedEntity

export type User = NamedEntity & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
}

export type AdvancePayment = EntityFields & {
  Amount?: number
  ClientAgreement?: ExternalClientAgreement | null
  Comment?: string
  FromDate?: string
  Number?: string
  Organization?: Organization | null
  OrganizationClientAgreement?: ExternalOrganizationClientAgreement | null
  User?: User | null
  VatAmount?: number
  VatPercent?: number
}

export type AdvancePaymentMutationPayload = {
  Amount: number
  Comment?: string
  FromDate: string
  Organization: Organization
  VatAmount: number
  VatPercent: number
} & PartnerAgreementPayload<ExternalClientAgreement, ExternalOrganizationClientAgreement>

export type AdvancePaymentSource =
  | {
      sadNetId: string
      taxFreeNetId?: never
    }
  | {
      sadNetId?: never
      taxFreeNetId: string
    }

export type AdvancePaymentsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}
import type {
  ExternalClientAgreement,
  ExternalOrganizationClientAgreement,
} from '../document-outcome-payment/types'
import type { PartnerAgreementPayload } from '../document-outcome-payment/externalDocumentPayment'
