export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  Name?: string
  Number?: string
}

export type Currency = NamedEntity & {
  CurrencyTranslations?: unknown[]
}

export type Organization = NamedEntity & {
  Address?: string
}

export type SupplyOrganizationDocument = EntityFields & {
  DocumentURL?: string
  FileName?: string
  Name?: string
  PdfDocumentURL?: string
  URL?: string
}

export type SupplyOrganizationAgreement = EntityFields & {
  Currency?: Currency | null
  CurrentAmount?: number
  CurrentEuroAmount?: number
  ExistFrom?: string
  ExistTo?: string
  IsSelected?: boolean
  Name?: string
  Number?: string
  Organization?: Organization | null
  SupplyOrganizationDocuments?: SupplyOrganizationDocument[]
  SupplyOrganizationId?: number
}

export type SupplyOrganization = EntityFields & {
  AccountNumber?: string
  Address?: string
  AgreementReceiveDate?: string
  Bank?: string
  BankAccount?: string
  BankAccountEUR?: string
  Beneficiary?: string
  BeneficiaryBank?: string
  BillReceiveDate?: string
  ContactPersonComment?: string
  ContactPersonEmail?: string
  ContactPersonName?: string
  ContactPersonPhone?: string
  ContactPersonSkype?: string
  ContactPersonViber?: string
  EmailAddress?: string
  IntermediaryBank?: string
  IsAgreementReceived?: boolean
  IsBillReceived?: boolean
  IsNotResident?: boolean
  IsSelected?: boolean
  Name?: string
  PhoneNumber?: string
  Requisites?: string
  SROI?: string
  SupplyOrganizationAgreements?: SupplyOrganizationAgreement[]
  Swift?: string
  SwiftBic?: string
  TIN?: string
  TotalAgreementsCurrentAmount?: number
  TotalAgreementsCurrentEuroAmount?: number
  USREOU?: string
}

export type SupplyOrganizationDocumentExport = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type SupplyOrganizationGeneralFormValues = {
  Address: string
  EmailAddress: string
  IsAgreementReceived: boolean
  IsBillReceived: boolean
  IsNotResident: boolean
  Name: string
  PhoneNumber: string
  SROI: string
  TIN: string
  USREOU: string
}

export type SupplyOrganizationBankFormValues = {
  AccountNumber: string
  Bank: string
  BankAccount: string
  BankAccountEUR: string
  Beneficiary: string
  BeneficiaryBank: string
  IntermediaryBank: string
  Requisites: string
  Swift: string
  SwiftBic: string
}

export type SupplyOrganizationContactFormValues = {
  ContactPersonComment: string
  ContactPersonEmail: string
  ContactPersonName: string
  ContactPersonPhone: string
  ContactPersonSkype: string
  ContactPersonViber: string
}

export type SupplyOrganizationAgreementFormValues = {
  currencyId: string
  existFrom: string
  existTo: string
  files: File[]
  name: string
  number: string
  organizationId: string
}

export type SupplierOrganizationCashFlowSearchParams = {
  from: string
  netId: string
  to: string
  typePaymentTask: number
}
