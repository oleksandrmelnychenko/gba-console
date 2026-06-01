export type SalesPredictionPoint = {
  MonthNamePL?: string
  MonthNameUK?: string
  SaleAmount?: number
}

export type SalesPredictionClientOption = {
  FullName?: string
  NetUid?: string
}

export type SalesPredictionProductOption = {
  Name?: string
  NetUid?: string
  VendorCode?: string
}

export type SalesPredictionChartPoint = {
  amount: number
  month: string
}
