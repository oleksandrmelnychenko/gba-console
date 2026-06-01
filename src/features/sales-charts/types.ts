export const SalesChartsTopType = {
  TopX: 0,
  TopN: 1,
} as const

export type SalesChartsTopType = (typeof SalesChartsTopType)[keyof typeof SalesChartsTopType]

export const SalesChartsPeriodType = {
  Day: 0,
  Week: 1,
  Month: 2,
  Year: 3,
} as const

export type SalesChartsPeriodType = (typeof SalesChartsPeriodType)[keyof typeof SalesChartsPeriodType]

export type SalesChartsManagerOption = {
  Id?: number
  NetUid?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
  FullName?: string
  Name?: string
  Abbreviation?: string
}

export type SalesChartsOrganizationOption = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type SalesChartsClientOption = {
  Id?: number
  NetUid?: string
  FullName?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type SalesByProductTopReportManager = {
  NetId: string
  ManagerName: string
  TotalManagerSold: number
  TypeOrder?: number
}

export type SalesByProductTopReportProduct = {
  ProductNetId: string
  VendorCode: string
  ManagersSoldProduct: Record<string, number>
  TotalValueSoldProduct: number
}

export type SalesByProductTopReport = {
  Managers: SalesByProductTopReportManager[]
  Products: SalesByProductTopReportProduct[]
}

export type SalesByManagerAndProductTopItem = {
  ManagerNetId: string
  ManagerName: string
  TotalValueSales: number
  SalesValueByProductTop: Record<string, number>
}

export type SalesByManagersAndTopReport = {
  SalesByManagerAndProductTop: SalesByManagerAndProductTopItem[]
  TotalByColumn: Record<string, number>
}

export type SalesChartsTopNXRow = {
  rowId: string
  label: string
  isManager: boolean
  isTotal: boolean
  values: Record<string, number | undefined>
  total: number | undefined
}

export type SalesChartsManagerTopRow = {
  rowId: string
  label: string
  isTotal: boolean
  values: Record<string, number | undefined>
  total: number | undefined
}

export type SalesChartsClientPoint = {
  name: string
  amount: number
}
