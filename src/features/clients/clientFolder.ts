import type { Client } from './types'

/**
 * 1C uses region codes ending in `00` for structural folders. The persisted
 * ClientSubClient edges remain the source of truth for folder membership.
 */
export function isClientFolder(client: Client): boolean {
  return /^.+00$/u.test(getClientRegionCode(client))
}

export function getClientRegionCode(client: Client): string {
  return client.RegionCode?.Value?.trim()
    || client.OriginalRegionCode?.trim()
    || ''
}

export function getClientFolderChildren(client: Client): Client[] {
  if (!isClientFolder(client) || !Array.isArray(client.SubClients)) {
    return []
  }

  const seen = new Set<string>()
  const children: Client[] = []

  client.SubClients.forEach((link) => {
    const child = link?.SubClient
    const stableKey = child ? getClientStableKey(child) : ''

    if (!child || !stableKey || seen.has(stableKey)) {
      return
    }

    seen.add(stableKey)
    children.push(child)
  })

  return children
}

export function getClientStableKey(client: Client): string {
  const netUid = client.NetUid?.trim()

  if (netUid) {
    return `net:${netUid.toLowerCase()}`
  }

  return typeof client.Id === 'number' && Number.isFinite(client.Id)
    ? `id:${client.Id}`
    : ''
}
