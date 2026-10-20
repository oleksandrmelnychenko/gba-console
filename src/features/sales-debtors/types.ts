export const TypeOfClientAgreement = {
  All: 0,
  VAT: 1,
  WithoutVAT: 2,
} as const

export type TypeOfClientAgreement = (typeof TypeOfClientAgreement)[keyof typeof TypeOfClientAgreement]

export const TypeOfCurrencyOfAgreement = {
  None: 0,
  UAH: 1,
  PLN: 2,
  EUR: 3,
  USD: 4,
} as const

export type TypeOfCurrencyOfAgreement = (typeof TypeOfCurrencyOfAgreement)[keyof typeof TypeOfCurrencyOfAgreement]

export type DebtorsFilters = {
  typeAgreement: TypeOfClientAgreement
  userNetId: string | null
  organizationNetId: string | null
  typeCurrency: TypeOfCurrencyOfAgreement
  days: number
  limit: number
  offset: number
}

export type ClientCurrencyDebt = {
  CurrencyCode?: string
  RemainderDebt?: number
  OverdueDebt?: number
  TotalDebtInDays?: number
  RemainderDebtEuro?: number
  OverdueDebtEuro?: number
  TotalDebtInDaysEuro?: number
}

export type ClientInDebt = {
  CreatedDebt?: string
  ClientNetId?: string
  RegionCode?: string
  ClientName?: string
  UserName?: string
  MissedDays?: number
  RemainderDebt?: number
  OverdueDebt?: number
  TotalDebtInDays?: number
  RemainderDebtEuro?: number
  OverdueDebtEuro?: number
  TotalDebtInDaysEuro?: number
  CurrencyDebts?: ClientCurrencyDebt[]
}

export type DebtorDebtCurrencyTotal = {
  CurrencyCode?: string
  Total?: number
  Overdue?: number
  TotalInEuro?: number
  OverdueInEuro?: number
  MaxOverdueDays?: number
}

export type DebtorDebtTotal = {
  TotalEuro?: number
  TotalLocal?: number
  TotalInEuro?: number
  OverdueInEuro?: number
  Currencies?: DebtorDebtCurrencyTotal[]
}

export type DebtorsCurrencyTotal = {
  CurrencyCode?: string
  RemainderDebt?: number
  OverdueDebt?: number
  RemainderDebtEuro?: number
  OverdueDebtEuro?: number
}

export type DebtorDebtEntity = {
  Code?: string
  Created?: string
  Id?: number
  Name?: string
  NetUid?: string
  Number?: string
  Updated?: string
  Value?: string
}

export type DebtorDebtCurrency = DebtorDebtEntity

export type DebtorDebtOrganization = DebtorDebtEntity

export type DebtorDebtStatus = DebtorDebtEntity & {
  SaleLifeCycleType?: number | string
  SalePaymentStatusType?: number | string
}

export type DebtorDebtSale = DebtorDebtEntity & {
  BaseLifeCycleStatus?: DebtorDebtStatus | null
  BaseSalePaymentStatus?: DebtorDebtStatus | null
  ChangedToInvoice?: string
  SaleNumber?: DebtorDebtEntity | null
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type DebtorDebtAgreement = DebtorDebtEntity & {
  Currency?: DebtorDebtCurrency | null
  Organization?: DebtorDebtOrganization | null
}

export type DebtorDebt = DebtorDebtEntity & {
  Days?: number
  Total?: number
  EuroTotal?: number
  OverdueTotal?: number
  OverdueEuroTotal?: number
}

export type DebtorDebtItem = DebtorDebtEntity & {
  Agreement?: DebtorDebtAgreement | null
  AgreementId?: number
  Debt?: DebtorDebt | null
  DebtId?: number
  ReSale?: DebtorDebtSale | null
  ReSaleId?: number
  Sale?: DebtorDebtSale | null
  SaleId?: number
}

export type ClientDebtors = {
  ClientInDebtors: ClientInDebt[]
  TotalQtyClients: number
  TotalMissedDays: number
  TotalRemainderDebtorsValue: number
  TotalOverdueDebtorsValue: number
  CurrencyTotals: DebtorsCurrencyTotal[]
}

export type DebtorsManagerOption = {
  Id?: number
  NetUid?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Abbreviation?: string
  FullName?: string
  Name?: string
}

export type DebtorsOrganizationOption = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type DebtorsDocumentResult = {
  excelUrl: string | null
  pdfUrl: string | null
}
