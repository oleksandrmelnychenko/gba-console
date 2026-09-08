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

export type ReportFilterFieldOption = {
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

export type ReportHideZero = { Version: 1 }
export type ReportHideZeroCapabilities = {
  Version: 1
  GroupingTypes: [42]
  Measures: [24]
  MinimumNativeRowGroups: 1
  MaximumNativeRowGroups: 1
  MaximumColumnGroups: 0
  MinimumActiveMeasures: 1
  MaximumActiveMeasures: 1
  MaximumContributions: 200000
  OptionalGeneratedGrouping: 46
  ProofGrain: 'CurrentPaymentCurrencyRegisterId'
  UnknownAmountsRetained: true
  PresentationOnly: true
  FactsRetainedForTotals: true
  FactsRetainedForAbc: true
  GlobalZeroResourceHidden: true
  CompleteSourceParity: false
}

export type ReportRequestBody = {
  dataSource?: number
  comparison?: unknown
  Comparison?: unknown
  valuationClientAgreementId?: number | null
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
  oneC?: OneCTurnoverFilters
  from: string
  selections: ReportSelection[]
  sorted: {
    Col: ReportGroupingItem[]
    Measurements: ReportMeasurementSelection[]
    Row: ReportGroupingItem[]
  }
  to: string
}

export type ReportDatasetField = { Type: number; Name: string; Selectable?: boolean }

export type ReportDataset = {
  DataSource: number
  Name: string
  Description: string
  PeriodRequired?: boolean
  PeriodSupported?: boolean
  Comparison?: unknown
  Ordering?: unknown
  FilterExpression?: unknown
  TopGroups?: unknown
  HideZero?: unknown
  Threshold?: unknown
  AbcClassification?: unknown
  Groupings: ReportDatasetField[]
  Measurements: ReportDatasetField[]
  Filters: ReportDatasetField[]
  Limitations: string[]
}

export type OneCTurnoverFilters = {
  OrganizationIds: string[]
  ProductKindId: string
  ExcludeServices: boolean
}

export type OneCTurnoverScopeSummary = {
  Key: string
  Filters: OneCTurnoverFilters
  OrganizationNames: string[]
  FirstDay: string
  LastDay: string
  LoadedDayCount: number
  OldestReadCompletedUtc: string
  NewestReadCompletedUtc: string
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
export type ReportDependencyStatus = 'unknown' | 'unmapped' | 'partial' | 'available'
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
export type ReportMigrationSummary = {
  CatalogueEntries: number
  SourceImplementations: number
  BuiltinImplementations: number
  ByStatus: { Unassessed: number; Captured: number; NativePartial: number; ParityVerified: number }
  FullyVerifiedEntries: number
}
export type ReportCatalogueMigration = {
  Version: string
  GeneratedAtUtc: string
  Summary: ReportMigrationSummary
}
export type ReportCatalogueSource = {
  World: string
  SourceId: string
  DefinitionSha256: string | null
  Attributes: string[]
  Migration?: ReportSourceMigration
}
export type ReportCatalogueEntry = {
  Id: string
  Name: string
  Title: string
  Kind: string
  Sources: ReportCatalogueSource[]
}
export type ReportCatalogue = {
  CapturedOn: string
  Reports: ReportCatalogueEntry[]
  Presentations: Array<{ Id: string; Title: string }>
  Migration?: ReportCatalogueMigration
}

export type SpreadsheetCellValue = boolean | number | string | null

// Our own report engine writes a pivot, not a table: «Підсумок: …» closes every group and «Загальний
// підсумок» closes the sheet. Those rows carry the same measures as the data rows, so a viewer has to
// tell them apart before it counts or sums anything.
export type SpreadsheetRowKind = 'data' | 'subtotal' | 'total'

export type SpreadsheetRow = {
  cells: SpreadsheetCellValue[]
  kind: SpreadsheetRowKind
}

// The engine now writes the request into the file, above the table: the period, the groupings of both axes, the
// measures, every filter that was applied — and, when a measure could not be answered, the «немає даних» line that
// says how many cells were left empty and why. That block is the only thing in a saved workbook that says which
// question it answers, so the viewer reads it, shows it, and carries it into its own export rather than skipping
// past it to the numbers.
export type SpreadsheetReportHeader = {
  columnGroupings: string[]
  // every line of the block, in file order, exactly as the file carries it
  lines: string[]
  rowGroupings: string[]
  // the lines a reader must not scroll past: a filter that was not applied, a measure with no data behind it
  warnings: string[]
}

export type SpreadsheetSheet = {
  presentationState?: 'all_confirmed_zero_hidden'
  columns: string[]
  // null for anything that is not one of our report engine's files — a plain CSV, or a workbook produced before
  // the engine started recording its request.
  header: SpreadsheetReportHeader | null
  name: string
  rows: SpreadsheetRow[]
}
