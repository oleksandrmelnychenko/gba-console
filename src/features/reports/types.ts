import type { ReactNode } from 'react'

export type ReportEntity = {
  [key: string]: unknown
  Code?: string
  FullName?: string
  Id?: number
  Name?: string
  NetUid?: string
  Value?: number | string
}

export type ReportGroupingItem = {
  key: string
  label: string
  type: number
}

export type ReportGroupingGroup = {
  categoryKey: string
  categoryLabel: string
  items: ReportGroupingItem[]
}

export type ReportMeasurementItem = {
  IsChecked: boolean
  Name: string
  Type: number
}

export type ReportMeasurementGroup = {
  IsChecked: boolean
  Name: string
  SubList: ReportMeasurementItem[]
}

export type ReportMeasurementSelection = ReportMeasurementItem & {
  parentName: string
}

export type ReportFilterCondition = {
  Name: string
  Type: number
}

export type ReportFilterField = {
  Name: string
  ParentType?: string
  Type: number
}

export type ReportSelectedValue = {
  Data: ReportEntity
  Name: string
  Value: number
}

export type ReportSelection = {
  FilterCondition: ReportFilterCondition
  IsChecked: boolean
  SelectedField: ReportFilterField
  Values: ReportSelectedValue[]
}

export type ReportFilterFieldOption = {
  label: string
  type: number
}

export type ReportFilterFieldGroup = {
  children: ReportFilterFieldOption[]
  label: string
  type: number
}

export type ReportRequestBody = {
  from: string
  selections: ReportSelection[]
  sorted: {
    Col: ReportGroupingItem[]
    Measurements: ReportMeasurementSelection[]
    Row: ReportGroupingItem[]
  }
  to: string
}

export type ReportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ReportCellValue = boolean | number | ReactNode | string | null | undefined

export type ReportResultRow = Record<string, ReportCellValue>

export type ReportResultTable = {
  columns: string[]
  rows: ReportResultRow[]
}

export type ReportResult = {
  document: ReportDocument
  raw: unknown
  table: ReportResultTable
  totals: Record<string, number>
}

export type ReportSearchParams = {
  limit: number
  offset: number
  value: string
}

export type SalesReportSearchParams = ReportSearchParams & {
  clientId?: number | string
  fastEcommerce?: boolean
  forEcommerce?: boolean
  from: string
  fromShipments?: boolean
  organisationIds?: number[]
  status: string
  to: string
  type: 'All' | 'Self'
}

export type SaleReturnsReportSearchParams = ReportSearchParams & {
  from: string
  to: string
}

export type ReportTemplate = {
  Data: ReportRequestBody
  Name: string
}

export type SpreadsheetCellValue = boolean | number | string | null

export type SpreadsheetSheet = {
  columns: string[]
  dataRows: SpreadsheetCellValue[][]
  name: string
  rows: SpreadsheetCellValue[][]
  totals: Record<string, number>
}
