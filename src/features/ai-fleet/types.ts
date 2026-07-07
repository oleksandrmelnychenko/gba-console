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
  message?: string
  state: AiFleetState
}

export type AiFleetServiceStatus = {
  health: AiFleetHealthState
  serviceId: string
  warmup: AiFleetWarmupState
}
