import type { Client } from './types'

/**
 * 1C usually uses region codes ending in `00` for structural folders, but GBA
 * may keep a canonical client code (for example VI03501) after consolidating
 * the source folder. Persisted ClientSubClient edges are therefore the primary
 * source of truth; the `00` suffix is only a fallback for an empty folder.
 */
export function isClientFolder(client: Client): boolean {
  return getLinkedChildren(client).length > 0
    || /^.+00$/u.test(getClientRegionCode(client))
}

export function getClientRegionCode(client: Client): string {
  return client.RegionCode?.Value?.trim()
    || client.OriginalRegionCode?.trim()
    || ''
}

export function getClientFolderChildren(client: Client): Client[] {
  return getLinkedChildren(client)
}

/**
 * Resolves the persisted card that represents a row selection. Source-folder
 * rows are virtual and use the 1C folder identifier as NetUid, so opening the
 * virtual row directly would request a client that does not exist. The first
 * linked card is the deterministic folder anchor returned by the server.
 */
export function getClientFolderSelection(client: Client): Client | null {
  if (!isClientFolder(client)) {
    return client
  }

  return getLinkedChildren(client)[0] || null
}

function getLinkedChildren(client: Client): Client[] {
  if (!Array.isArray(client.SubClients)) return []

  const seen = new Set<string>()
  const children: Client[] = []
  const rootKey = getClientStableKey(client)

  client.SubClients.forEach((link) => {
    const child = link?.SubClient
    const stableKey = child ? getClientStableKey(child) : ''

    if (!child || !stableKey || stableKey === rootKey || seen.has(stableKey)) {
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
