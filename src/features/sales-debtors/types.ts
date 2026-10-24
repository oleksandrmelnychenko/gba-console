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

export type DebtAging = {
  KnownOverdueCount: number
  KnownNotOverdueCount: number
  UnknownDateDebtCount: number
  UnknownTermsDebtCount: number
  KnownOverdueEuro: number | null
  KnownNotOverdueEuro: number | null
  UnknownDateDebtEuro: number | null
  UnknownTermsDebtEuro: number | null
  MaxKnownDaysPastDue: number | null
  HasCompleteAging: boolean
  AsOfBusinessDay?: string
  TermBasis?: string
}

export type DebtCurrencyAging = DebtAging & {
  KnownOverdue: number
  KnownNotOverdue: number
  UnknownDateDebt: number
  UnknownTermsDebt: number
}

export type ClientCurrencyDebt = {
  Aging?: DebtCurrencyAging | null
  CurrencyCode?: string
  RemainderDebt?: number
  OverdueDebt?: number | null
  TotalDebtInDays?: number
  RemainderDebtEuro?: number | null
  OverdueDebtEuro?: number | null
  TotalDebtInDaysEuro?: number | null
  CreditBalance?: number
  CreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
}

export type ClientInDebt = {
  Aging?: DebtAging | null
  CreatedDebt?: string
  ClientNetId?: string
  RegionCode?: string
  ClientName?: string
  UserName?: string
  MissedDays?: number | null
  RemainderDebt?: number | null
  OverdueDebt?: number | null
  TotalDebtInDays?: number
  RemainderDebtEuro?: number | null
  OverdueDebtEuro?: number | null
  TotalDebtInDaysEuro?: number | null
  CurrencyDebts?: ClientCurrencyDebt[]
  CreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
}

export type DebtorDebtCurrencyTotal = {
  Aging?: DebtCurrencyAging | null
  CurrencyCode?: string
  Total?: number
  Overdue?: number | null
  TotalInEuro?: number | null
  OverdueInEuro?: number | null
  MaxOverdueDays?: number | null
  CreditBalance?: number
  CreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
}

export type DebtorDebtTotal = {
  Aging?: DebtAging | null
  TotalEuro?: number
  TotalLocal?: number
  TotalInEuro?: number | null
  OverdueInEuro?: number | null
  Currencies?: DebtorDebtCurrencyTotal[]
  CreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
}

export type DebtorsCurrencyTotal = {
  Aging?: DebtCurrencyAging | null
  CurrencyCode?: string
  RemainderDebt?: number
  OverdueDebt?: number | null
  RemainderDebtEuro?: number | null
  OverdueDebtEuro?: number | null
  CreditBalance?: number
  CreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
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
  Aging?: DebtCurrencyAging | null
  Days?: number | null
  Total?: number
  EuroTotal?: number | null
  OverdueTotal?: number | null
  OverdueEuroTotal?: number | null
  CreditBalance?: number
  CreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
}

export type DebtorDebtItem = DebtorDebtEntity & {
  Aging?: DebtAging | null
  UnknownEuroDebtCount?: number
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
  Aging?: DebtAging | null
  DueCutoffBusinessDay?: string | null
  ClientInDebtors: ClientInDebt[]
  TotalQtyClients: number
  TotalMissedDays: number | null
  TotalRemainderDebtorsValue: number | null
  TotalOverdueDebtorsValue: number | null
  CurrencyTotals: DebtorsCurrencyTotal[]
  TotalCreditBalanceEuro?: number | null
  UnknownEuroDebtCount?: number
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
