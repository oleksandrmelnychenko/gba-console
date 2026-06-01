export type SaleNumber = {
  Value?: string
}

export type Sale = {
  Number?: string
  SaleNumber?: SaleNumber | null
}

export type SupplyInvoice = {
  Number?: string
}

export type VatReport = {
  FromDate?: string
  Sale?: Sale | null
  SupplyInvoice?: SupplyInvoice | null
  VatAmountEU?: number
  VatAmountPL?: number
  VatPercent?: number
}

export type VatReportsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}
