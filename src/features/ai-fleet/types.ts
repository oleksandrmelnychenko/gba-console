export type AiFleetServiceDefinition = {
  description: string
  healthPath?: string
  id: string
  location: string
  name: string
  source: string
}

export type AiFleetState = 'down' | 'healthy' | 'unknown'

export type AiFleetHealthState = {
  message?: string
  state: AiFleetState
}

export type AiFleetWarmupState = {
  lastFinishedAtUtc?: string
  lastStartedAtUtc?: string
  message?: string
  source?: string
  state: AiFleetState
}

export type AiFleetOperationState = {
  generatedAtUtc?: string
  lastFinishedAtUtc?: string
  lastStartedAtUtc?: string
  logFilePath?: string
  state: AiFleetState
}

export type AiFleetServiceStatus = {
  health: AiFleetHealthState
  operation?: AiFleetOperationState
  serviceId: string
  warmup: AiFleetWarmupState
}

export type AiFleetServicesSnapshot = {
  statuses: AiFleetServiceStatus[]
  telemetryError?: string
}
