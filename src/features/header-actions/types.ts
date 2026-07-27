export const TypeOfXmlDocument = {
  Sales: 0,
  ProductIncomes: 1,
} as const

export type TypeOfXmlDocument = (typeof TypeOfXmlDocument)[keyof typeof TypeOfXmlDocument]

export const SyncEntityType = {
  Products: 0,
  Clients: 1,
  Consignments: 2,
  Accounting: 3,
  PaymentRegisters: 4,
} as const

export type SyncEntityType = (typeof SyncEntityType)[keyof typeof SyncEntityType]

export const SyncProductConsignmentType = {
  Order: 0,
  Capitalization: 1,
  SaleReturn: 2,
  ProductTransfers: 3,
  DepreciatedOrders: 4,
  ActProductTransfers: 5,
  Sales: 6,
  IncomeCashOrder: 7,
  IncomeBankOrder: 8,
  OutcomeCashOrder: 9,
  OutcomeBankOrder: 10,
  InternalMovementOfFunds: 11,
} as const

export type SyncProductConsignmentType =
  (typeof SyncProductConsignmentType)[keyof typeof SyncProductConsignmentType]

export const DailyDataSyncStockMode = {
  DocumentsOnly: 0,
  OperationalReplay: 1,
} as const

export type DailyDataSyncStockMode = (typeof DailyDataSyncStockMode)[keyof typeof DailyDataSyncStockMode]

export const DataSyncSessionMode = {
  Full: 0,
  Daily: 1,
} as const

export type DataSyncSessionMode = (typeof DataSyncSessionMode)[keyof typeof DataSyncSessionMode]

export type DataSyncSessionStageProgress = {
  AttemptCount: number
  CompletedAtUtc?: string | null
  FailedStep?: string | null
  From?: string | null
  Kind: string
  Ordinal: number
  StageAttemptId?: string | null
  StartedAtUtc?: string | null
  Status: string
  To?: string | null
}

export type DataSyncSessionProgress = {
  CurrentStageOrdinal?: number | null
  ForAmg: boolean
  From: string
  Mode: string
  Stages: DataSyncSessionStageProgress[]
  To: string
  TotalStages: number
}

export type DataSyncAcceptedScope = {
  ForAmg: boolean
  From?: string | null
  OperationType: string
  StockMode?: string | null
  SyncEntityTypes: SyncEntityType[]
  To?: string | null
  Types: SyncProductConsignmentType[]
}

export type DataSyncPipelineRun = {
  AcceptedScope: DataSyncAcceptedScope
  CompletedAtUtc?: string | null
  FailedStep?: string | null
  PipelineRunId: string
  StartedAtUtc: string
  StartedBy: string
  Status: 'Failed' | 'Finished' | 'Running' | string
  TerminalSequence?: number | null
}

export type DataSyncStatus = {
  ActiveRun?: DataSyncPipelineRun | null
  ActiveSynchronizationType?: string
  InMemorySynchronizationInProgress: boolean
  IsGlobalLockHeld: boolean
  IsGlobalLockStatusAvailable: boolean
  IsInProgress: boolean
  LastTerminalRun?: DataSyncPipelineRun | null
  PipelineRunId?: string | null
  RunId?: string | null
  Session?: DataSyncSessionProgress | null
  StartedBy?: string
}

export type SyncRunResponse = {
  AcceptedScope?: DataSyncAcceptedScope
  Message?: string
  PipelineRunId?: string
}

export type ProductWriteOffRule = {
  Id?: number
  NetUid?: string
  RuleLocale?: string
  RuleType?: number
}
