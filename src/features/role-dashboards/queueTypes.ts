import type { DashboardWorkspaceKey } from './types'

export type WorkspaceQueueRequest = {
  workspace: DashboardWorkspaceKey
  key: string
  from: string
  to: string
  asOf: string
  offset: number
  limit: number
}

export type WorkspaceQueueRow = {
  id: number
  netUid: string | null
  documentDate: string | null
  number: string
  description: string
  quantity: number | null
  route: string | null
}

export type WorkspaceQueue = Omit<WorkspaceQueueRequest, 'asOf'> & {
  label: string
  unit: string
  timeBasis: 'current' | 'period'
  formula: string
  source: string
  grain: string
  scope: string
  asOfUtc: string
  readAtUtc: string
  total: number
  aggregateValue: number | null
  rows: WorkspaceQueueRow[]
}
