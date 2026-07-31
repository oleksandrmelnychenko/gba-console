export type VehicleRegistryProcessingState = 'pending' | 'processed'

export type VehicleRegistryWorkflowStatus =
  | 'new'
  | 'in_progress'
  | 'verified'
  | 'client_matched'
  | 'lead'
  | 'ignored'

export type VehicleRegistryDataQualityStatus =
  | 'valid'
  | 'warning'
  | 'invalid'
  | 'duplicate'

export type VehicleRegistryImportStatus = 'processing' | 'completed' | 'failed'

export type VehicleRegistryImport = {
  NetUid: string
  OriginalFileName: string
  Brand: string
  Status: VehicleRegistryImportStatus
  TotalRows: number
  ValidRows: number
  WarningRows: number
  InvalidRows: number
  DuplicateRows: number
  AddedVehicles: number
  UpdatedVehicles: number
  UnchangedVehicles: number
  CreatedAtUtc: string
  CompletedAtUtc?: string | null
}

export type VehicleRegistrySummary = {
  Total: number
  Pending: number
  Processed: number
  Brands: number
  WorkflowCounts: Record<string, number>
  DataQualityCounts: Record<string, number>
  LatestImport?: VehicleRegistryImport | null
}

export type VehicleRegistryFilters = {
  Brands: string[]
  Models: string[]
  Regions: string[]
  MinimumYear?: number | null
  MaximumYear?: number | null
}

export type VehicleRegistryVehicle = {
  NetUid: string
  PlateNumber?: string | null
  Vin?: string | null
  Brand: string
  Model: string
  EngineVolumeCc?: number | null
  ManufactureYear?: number | null
  OwnerName?: string | null
  Address?: string | null
  Region?: string | null
  WorkflowStatus: VehicleRegistryWorkflowStatus
  DataQualityStatus: VehicleRegistryDataQualityStatus
  LatestChangeType: string
  IsCurrent: boolean
  IsProcessed: boolean
  AssignedUserNetUid?: string | null
  MatchedClientNetUid?: string | null
  UpdatedAtUtc: string
  LastSeenAtUtc: string
  ImportFileName: string
  ImportNetUid: string
}

export type VehicleRegistryWorkflowEvent = {
  NetUid: string
  FromStatus: VehicleRegistryWorkflowStatus
  ToStatus: VehicleRegistryWorkflowStatus
  Note?: string | null
  ChangedByUserNetUid: string
  MatchedClientNetUid?: string | null
  CreatedAtUtc: string
}

export type VehicleRegistryVehicleDetail = VehicleRegistryVehicle & {
  Note?: string | null
  FirstSeenAtUtc: string
  ProcessedAtUtc?: string | null
  Import: VehicleRegistryImport
  SourceSheet: string
  SourceRow: number
  Events: VehicleRegistryWorkflowEvent[]
}

export type VehicleRegistryIssue = {
  NetUid: string
  SourceRow: number
  Severity: 'error' | 'warning' | string
  Code: string
  Field?: string | null
  Message: string
  PlateNumber?: string | null
  Vin?: string | null
  Brand?: string | null
  Model?: string | null
}

export type VehicleRegistryPagedResponse<T> = {
  Items: T[]
  Total: number
  Limit: number
  Offset: number
}

export type VehicleRegistryVehicleQuery = {
  limit: number
  offset: number
  search?: string
  brand?: string | null
  model?: string | null
  region?: string | null
  workflowStatus?: VehicleRegistryWorkflowStatus | null
  dataQualityStatus?: VehicleRegistryDataQualityStatus | null
  processingState?: VehicleRegistryProcessingState | null
  includeRemoved?: boolean
}

export type VehicleRegistryWorkflowPayload = {
  status: VehicleRegistryWorkflowStatus
  note?: string
  assignedUserNetUid?: string | null
  matchedClientNetUid?: string | null
}

export type VehicleRegistryImportOutcome = {
  NetUid: string
  OriginalFileName: string
  Brand: string
  AlreadyImported: boolean
  TotalRows: number
  AddedVehicles: number
  UpdatedVehicles: number
  UnchangedVehicles: number
  InvalidRows: number
  WarningRows: number
  DuplicateRows: number
}
