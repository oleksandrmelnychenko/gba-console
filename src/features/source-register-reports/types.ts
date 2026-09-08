/** Version 1 register codec. UUIDs, hashes and exact operands remain strings. */
export type RegisterSchemaKey = Readonly<{ world: string; schemaHash: string; registerUuid: string }>
export type ExactRegisterNumber = Readonly<{ coefficient: string; scale: string }>
export type RegisterStage = 'Opening' | 'Receipt' | 'Expense' | 'Turnover' | 'Closing'
export type RegisterSelection = Readonly<{ resourceUuid: string; stage: RegisterStage }>
export type RegisterAlternative =
  | Readonly<{ kind: 'Reference'; sourceTypeUuid: string }>
  | Readonly<{ kind: 'Number'; precision: string; scale: string }>
  | Readonly<{ kind: 'Undefined' | 'Null' | 'Boolean' | 'String' | 'LocalDateTime' }>
export type RegisterField = Readonly<{
  uuid: string
  caption: string
  isResource: boolean
  referenceLayout: 'None' | 'Fixed' | 'Composite'
  alternatives: readonly RegisterAlternative[]
}>
export type SourceRegisterDescriptorWire = Readonly<{
  version: 1
  kind: 'register-schema'
  schema: RegisterSchemaKey
  dimensions: readonly RegisterField[]
  resources: readonly RegisterField[]
}>
export type SourceRegisterQueryWire = Readonly<{
  version: 1
  kind: 'register-query'
  schema: RegisterSchemaKey
  from: string
  toExclusive: string
  rowFields: readonly string[]
  columnFields: readonly string[]
  selections: readonly RegisterSelection[]
}>
export type RegisterPeriodDraft = Readonly<{ date: string; time: string; fraction: string }>
/** Editable query choices only. Capture facts and publication proof are never draft fields. */
export type SourceRegisterQueryDraft = Readonly<{
  from: RegisterPeriodDraft
  toExclusive: RegisterPeriodDraft
  rowFields: readonly string[]
  columnFields: readonly string[]
  selections: readonly RegisterSelection[]
}>
export type RegisterAtom =
  | Readonly<{ kind: 'Undefined' | 'Null' }>
  | Readonly<{ kind: 'Number'; coefficient: string; scale: string }>
  | Readonly<{ kind: 'Boolean'; value: boolean }>
  | Readonly<{ kind: 'String' | 'LocalDateTime'; value: string }>
  | Readonly<{
      kind: 'Reference'
      sourceTypeUuid: string
      rawReferenceHex: string
      rawPhysicalTypeTagHex?: string
      rawPhysicalTableTagHex?: string
    }>
export type RegisterCaptureMetadata = Readonly<{
  schema: RegisterSchemaKey
  scopeHash: string
  principalPolicyHash: string
  captureId: string
  revision: string
  coverageStart: string
  coverageEndExclusive: string
  sourceReceiptHash: string
  complete: boolean
}>
export type RegisterPublicationReference = Readonly<{ metadata: RegisterCaptureMetadata; contentHash: string }>
export type RegisterStatementGroup = Readonly<{
  rowKey: readonly RegisterAtom[]
  columnKey: readonly RegisterAtom[]
  values: readonly ExactRegisterNumber[]
}>
export type SourceRegisterResultWire = Readonly<{
  version: 1
  kind: 'register-statement'
  schema: RegisterSchemaKey
  publication: RegisterPublicationReference
  query: SourceRegisterQueryWire
  groups: readonly RegisterStatementGroup[]
  grandValues: readonly ExactRegisterNumber[]
  sourceParityVerified: false
}>
