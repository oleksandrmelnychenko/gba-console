import type { Client } from './types'

export function isSourceManagedClient(client: Client | null | undefined): boolean {
  return client?.SourceAmgCode != null || client?.SourceFenixCode != null
}

export function canEditClientLifecycle(client: Client | null | undefined, hasPermission: boolean): boolean {
  return hasPermission && !isSourceManagedClient(client)
}
