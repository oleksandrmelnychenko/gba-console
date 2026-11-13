import type { ReactNode } from 'react'

export type ReportEntity = {
  [key: string]: unknown
  Code?: string
  FullName?: string
  Id?: number | string
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
  Label?: string
  Name: string
  Type: number
}

export type ReportMeasurementGroup = {
  IsChecked: boolean
  Label?: string
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

type ReportFilterFieldOption = {
  label: string
  type: number
}

export type ReportFilterFieldGroup = {
  children: ReportFilterFieldOption[]
  label: string
  type: number
}

export type ReportOrderRule = {
  Grouping: number
  By: 1 | 2 | 3
  Direction: 1 | 2
  Nulls: 1 | 2
  Measure?: number | null
}
export type ReportOrdering = { Version: 1; Rows: ReportOrderRule[]; Columns: ReportOrderRule[] }
export type ReportOrderingCapabilities = {
  Version: 1
  MaximumRules: number
  Groupings: Array<{ Type: number; By: Array<1 | 2 | 3> }>
}

export type ReportFilterNode =
  | { Kind: 1 | 2; Children: ReportFilterNode[]; SelectionIndex?: null }
  | { Kind: 3; SelectionIndex: number; Children?: null }
export type ReportFilterExpression = { Version: 1; Root: ReportFilterNode }
export type ReportFilterExpressionCapabilities = {
  Version: 1
  MaximumDepth: number
  MaximumLeaves: number
  MaximumNodes: number
  Operators: Array<1 | 2>
}

export type ReportTopGroups = {
  Version: 1
  Axis: 1
  Grouping: number
  Mode: 1 | 2
  Value: number
  Measure: number
  Direction: 1 | 2
}
export type ReportTopGroupsCapabilities = {
  Version: 1
  MaximumRules: 1
  Axes: [1]
  Modes: Array<1 | 2>
  MaximumCount: number
  PercentMinimum: number
  PercentMaximum: number
  PercentScale: 0
  Directions: Array<1 | 2>
  Scope: 'GlobalKey'
  TotalsScope: 'RetainedFactsOnly'
  UnknownScores: 'Reject'
  GroupingTypes: number[]
  RankingMeasures: number[]
}

export type ReportAbcClassification = {
  Version: 1
  Axis: 1
  Grouping: number
  Measure: number
  PercentA: number
  PercentB: number
  PercentC: number
}
export type ReportAbcClassificationCapabilities = {
  Version: 1
  MaximumRules: 1
  Axes: [1]
  GeneratedGrouping: 46
  GroupingTypes: number[]
  RankingMeasures: number[]
  PercentMinimum: 0
  PercentMaximum: 100
  PercentScale: 0
  PercentTotal: 100
  Scope: 'GlobalKeyAfterTop'
  ClassBasis: 'CumulativeBeforeCurrentGroup'
  UnknownScores: 'Reject'
  NegativeScores: 'Reject'
  TotalsScope: 'AllRetainedFacts'
  TieBreak: 'TypedKeyAscending'
}

export type ReportThreshold = {
  Version: 1
  Axis: 1
  Grouping: number
  Measure: number
  Percent: number
}
export type ReportThresholdCapabilities = {
  Version: 1
  MaximumRules: 1
  Axes: [1]
  PercentMinimum: 1
  PercentMaximum: 100
  PercentScale: 0
  MaximumNativeRowGroupings: 1
  MaximumNativeColumnGroupings: 0
  MaximumActiveMeasures: 1
  GroupingTypes: number[]
  RankingMeasures: number[]
  Scope: 'GlobalKeyAfterTop'
  TotalsScope: 'AllInputFactsIncludingOther'
  UnknownScores: 'Reject'
  NegativeScores: 'Reject'
  NonPositiveTotal: 'RejectExceptEmpty'
  ZeroOnlyRemainder: 'Reject'
  OtherIdentityKind: 'ThresholdOther'
  SyntheticOtherSelectable: false
  MaximumContributions: 200000
  SupportsAbc: true
  SupportsTop: true
  SupportsOrdering: true
}

export type ReportProductClassification = {
  Version: 1
  SourceWorld: 0
  ProductKindId: string
  IsService: boolean
}

export type ReportProductClassificationCapabilities = {
  Version: 1
  SourceWorld: 0
  RequiresIsService: true
  RequiresProductKindId: true
  ProductKindIdFormat: '32 hexadecimal characters (16 bytes)'
}

export type ReportSourceOrganizations = {
  Version: 1
  SourceWorld: 'fenix'
  OrganizationIds: string[]
}

export type ReportSourceOrganizationsCapabilities = {
  Version: 1
  SourceWorlds: ['fenix']
  MaximumOrganizationIds: 64
  OrganizationIdFormat: '32 hexadecimal characters (16 bytes)'
  RequiresDurableNativeBinding: true
  RequiresCompleteFactLineage: true
}

export type ReportSourceBuyerSubtree = {
  Version: 1
  SourceWorld: 'fenix'
  BuyerRootId: string
}

export type ReportSourceBuyerSubtreeCapabilities = {
  Version: 1
  SourceWorld: 'fenix'
  BuyerRootId: string
  RequiresCompletePeriodLineage: true
  UsesCurrentCapturedHierarchy: true
}

export type ReportRequestBody = {
  stockQuantityFilter?: unknown
  StockQuantityFilter?: unknown
  constructorPresentation?: unknown
  ConstructorPresentation?: unknown
  reportProfile?: unknown
  ReportProfile?: unknown
  presentationCurrency?: unknown
  PresentationCurrency?: unknown
  currentVparivanieAnalysis?: unknown
  CurrentVparivanieAnalysis?: unknown
  supplierWarehouse?: unknown
  SupplierWarehouse?: unknown
  numberPresentation?: unknown
  NumberPresentation?: unknown
  workbookPresentation?: unknown
  WorkbookPresentation?: unknown
  currentVparivanieMovements?: unknown
  CurrentVparivanieMovements?: unknown
  currentVparivanieFullScope?: unknown
  CurrentVparivanieFullScope?: unknown
  dataSource?: number
  groupedSettlementPeriod?: unknown
  GroupedSettlementPeriod?: unknown
  sourceCounterpartyGroups?: unknown
  SourceCounterpartyGroups?: unknown
  settlementPeriod?: unknown
  groupedCashPeriod?: unknown
  cashPeriod?: unknown
  SettlementPeriod?: unknown
  GroupedCashPeriod?: unknown
  CashPeriod?: unknown
  returnsOnly?: boolean
  ReturnsOnly?: boolean
  nativePriceComparison?: import('./data/nativePriceComparison').NativePriceComparison
  NativePriceComparison?: import('./data/nativePriceComparison').NativePriceComparison
  customerGroups?: import('./data/customerGroups').CustomerGroups
  CustomerGroups?: import('./data/customerGroups').CustomerGroups
  // Preserve unknown imported versions/properties for explicit validation; never sanitize them away.
  ordering?: unknown
  Ordering?: unknown
  filterExpression?: unknown
  FilterExpression?: unknown
  abcClassification?: unknown
  AbcClassification?: unknown
  hideZero?: unknown
  HideZero?: unknown
  threshold?: unknown
  Threshold?: unknown
  topGroups?: unknown
  TopGroups?: unknown
  productClassification?: unknown
  ProductClassification?: unknown
  productServiceFilter?: unknown
  ProductServiceFilter?: unknown
  sourceOrganizations?: unknown
  SourceOrganizations?: unknown
  sourceBuyerSubtree?: unknown
  SourceBuyerSubtree?: unknown
  profitReadMode?: unknown
  ProfitReadMode?: unknown
  settlementReadMode?: unknown
  SettlementReadMode?: unknown
  cashReadMode?: unknown
  CashReadMode?: unknown
  dayOrganizationBasis?: unknown
  DayOrganizationBasis?: unknown
  supplierBasis?: unknown
  SupplierBasis?: unknown
  supplierSourceWorld?: unknown
  SupplierSourceWorld?: unknown
  oneC?: unknown
  from: string
  selections: ReportSelection[]
  sorted: {
    Col: ReportGroupingItem[]
    Measurements: ReportMeasurementSelection[]
    Row: ReportGroupingItem[]
  }
  to: string
}

export type ReportDatasetField = { Type: number; Name: string; Selectable?: boolean; valueSemantics?: import('./data/reportNumberPresentation').ReportValueSemantics; hierarchy?: import('./data/currentVparivanieAnalysis').AnalysisHierarchy }

export type ReportDataset = {
  productLookup?: unknown
  priceFilterLookup?: unknown
  salesProductLookup?: unknown
  salesDocumentLookup?: unknown
  returnItemStatuses?: unknown
  documentDetails?: unknown
  stockQuantityFilter?: unknown
  StockQuantityFilter?: unknown
  constructorPresentation?: unknown
  reportProfiles?: unknown
  profileGroupings?: unknown
  currentFinancialPresentationCurrency?: unknown
  configuration?: unknown
  numberPresentation?: unknown
  workbookPresentation?: unknown
  currentProductGroupLists?: unknown
  currentProductColumns?: unknown
  customerReturnFilters?: boolean
  returnsOnly?: boolean
  groupedSettlementPeriod?: unknown
  sourceCounterpartyGroups?: unknown
  settlementPeriod?: unknown
  groupedCashPeriod?: unknown
  cashPeriod?: unknown
  currentVparivanie?: unknown
  agreementPrices?: unknown
  originalClientDiscounts?: unknown
  DataSource: number
  Name: string
  Description: string
  PeriodRequired?: boolean
  PeriodSupported?: boolean
  Ordering?: unknown
  FilterExpression?: unknown
  TopGroups?: unknown
  Threshold?: unknown
  AbcClassification?: unknown
  productClassification?: unknown
  productServiceFilter?: unknown
  sourceOrganizations?: unknown
  sourceBuyerSubtree?: unknown
  financialAxes?: unknown
  currentFinancialAxes?: unknown
  currentFinancialProductTimeAxes?: unknown
  currentFinancialDocumentAxes?: unknown
  currentFinancialDocumentFilter?: unknown
  currentFinancialBuyerManagerFilter?: unknown
  currentFinancialFilterConditions?: unknown
  profitReadModeLookup?: unknown
  profitReadMode?: unknown
  settlementReadMode?: unknown
  cashReadMode?: unknown
  dayOrganizationBasis?: unknown
  supplierBasis?: unknown
  supplierSourceWorld?: unknown
  Groupings: ReportDatasetField[]
  Measurements: ReportDatasetField[]
  Filters: ReportDatasetField[]
  Limitations: string[]
}

export type ReportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ReportCellValue = boolean | number | ReactNode | string | null | undefined

// «/report/get/all/filtered» answers with the two file links and nothing else (ReportController returns
// «new { DocumentURL, PdfDocumentURL }»), so there is no row collection to model here. The report is read
// from the file, in «Перегляд звіту з файла».
export type ReportResult = {
  document: ReportDocument
  raw: unknown
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
  Id?: string
  Revision?: number
  UpdatedAtUtc?: string
  Data: ReportRequestBody
  Name: string
}

export type ReportMigrationStatus = 'captured' | 'native_partial' | 'parity_verified'
type ReportDependencyStatus = 'unknown' | 'unmapped' | 'partial' | 'available'
export type ReportSourceMigration = {
  CaptureStatus: 'metadata_only' | 'assets_captured' | 'incomplete' | 'unknown'
  SourceRevisionSha256: string | null
  Status: ReportMigrationStatus
  NativeDataSources: number[]
  CoveredScope: string[]
  MissingScope: string[]
  Dependencies: Array<{ Key: string; Title: string; Status: ReportDependencyStatus; Note: string | null }>
  Validation: {
    Kind: 'native_scope' | 'source_parity'
    EvidenceId: string
    VerifiedAtUtc: string
    SourceRevisionSha256: string
    NativeRevision: string
  } | null
}

export type SpreadsheetCellValue = boolean | number | string | null
