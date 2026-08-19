import type {
  Client,
  ClientCommercialCard,
  ClientCommercialStructure,
} from './types'

const ROOT_FOLDER_SUFFIX = '00'

export type ClientFolderTreeItem = {
  clientId: number
  clientNetUid: string
  code?: string
  isActive: boolean
  isBlocked: boolean
  name: string
  requiresReview: boolean
}

export type ClientFolderTree = {
  code: string
  isPartial: boolean
  items: ClientFolderTreeItem[]
  name: string
  requiresReview: boolean
  rootClientNetUid: string
}

/**
 * Builds the editable folder projection from the source-safe commercial
 * structure. A suffix alone is deliberately insufficient: a regular client
 * ending in 00 remains on the standard form unless the API also proves a
 * hierarchy. For synchronized source folders the API exposes the virtual
 * ...00 code while the persisted root card can legitimately be ...01.
 */
export function buildClientFolderTree(
  client: Client,
  structure: ClientCommercialStructure | null,
): ClientFolderTree | null {
  if (!client.NetUid || !structure) {
    return null
  }

  const cards = structure.LegalParties.flatMap((party) =>
    party.Cards.flatMap((card) => card.IsRejectedCandidate ? [] : [card]),
  )
  const target = cards.find((card) =>
    card.ClientNetUid === client.NetUid && card.IsTarget,
  ) || cards.find((card) => card.ClientNetUid === client.NetUid)

  if (!target || target.MainClientId != null) {
    return null
  }

  const projectedFolderCode = normalizeCode(structure.GroupCode)
  const directFolderCode = [
    target.CurrentRegionCode,
    client.RegionCode?.Value,
    target.OriginalRegionCode,
    client.OriginalRegionCode,
  ]
    .map(normalizeCode)
    .find(isRootFolderCode)
  const hasProjectedFolderEvidence = isRootFolderCode(projectedFolderCode)
  const folderCode = hasProjectedFolderEvidence
    ? projectedFolderCode
    : directFolderCode

  if (!folderCode) {
    return null
  }

  const cardsById = new Map(cards.map((card) => [card.ClientId, card]))
  const descendants = cards.filter((card) =>
    card.ClientId !== target.ClientId
    && isDescendantOf(card, target.ClientId, cardsById),
  )
  const legacyLinkedChildren = cards.filter((card) =>
    card.ClientId !== target.ClientId
    && card.MainClientId == null
    && card.HasExplicitRelationship
    && (card.IsSubClient || card.IsTradePoint),
  )
  const linkedChildren = uniqueCards([
    ...descendants,
    ...legacyLinkedChildren,
  ])

  // A coincidental ...00 client code must never fabricate a folder.
  if (!hasProjectedFolderEvidence && linkedChildren.length === 0) {
    return null
  }

  const targetCode = getCardCode(target, client)
  const targetRepresentsPersistedFolder = codesEqual(targetCode, folderCode)

  // Once the API has proved a real folder, every non-rejected card returned
  // for that commercial family must remain reachable. Some source-only cards
  // deliberately have no persisted MainClientId yet and are marked for review;
  // hiding them here loses their agreements and contradicts the source tree.
  const memberCards = uniqueCards(cards)

  return {
    code: folderCode,
    isPartial: structure.IsPartial,
    items: memberCards
      .map((card) => toFolderTreeItem(
        card,
        folderCode,
        targetRepresentsPersistedFolder,
      ))
      .filter((item): item is ClientFolderTreeItem => item !== null)
      .sort(compareFolderTreeItems),
    name: structure.GroupName?.trim()
      || getClientDisplayName(client)
      || folderCode,
    requiresReview: structure.RequiresReview,
    rootClientNetUid: client.NetUid,
  }
}

function isDescendantOf(
  card: ClientCommercialCard,
  rootClientId: number,
  cardsById: ReadonlyMap<number, ClientCommercialCard>,
): boolean {
  const visited = new Set<number>([card.ClientId])
  let parentId = card.MainClientId

  while (parentId != null) {
    if (parentId === rootClientId) {
      return true
    }
    if (visited.has(parentId)) {
      return false
    }

    visited.add(parentId)
    parentId = cardsById.get(parentId)?.MainClientId
  }

  return false
}

function uniqueCards(cards: ClientCommercialCard[]): ClientCommercialCard[] {
  const unique = new Map<number, ClientCommercialCard>()
  cards.forEach((card) => unique.set(card.ClientId, card))
  return [...unique.values()]
}

function toFolderTreeItem(
  card: ClientCommercialCard,
  folderCode: string,
  preferSourceFolderCodes: boolean,
): ClientFolderTreeItem | null {
  const currentCode = normalizeCode(card.CurrentRegionCode)
    || normalizeCode(card.OriginalRegionCode)
  const sourceCode = preferSourceFolderCodes
    ? getSourceMemberCode(card, folderCode)
    : ''
  const code = sourceCode || currentCode

  // A persisted folder can also have a backing Client row. It is a navigation
  // container, not an individual counterparty, unless immutable source
  // evidence maps that row to a real child code (for example BXM05202).
  if (codesEqual(code, folderCode)) {
    return null
  }

  return {
    clientId: card.ClientId,
    clientNetUid: card.ClientNetUid,
    code: code || undefined,
    isActive: card.IsActive,
    isBlocked: card.IsBlocked,
    name: getSourceMemberName(card)
      || card.DisplayName?.trim()
      || card.ClientNetUid,
    requiresReview: !card.HasExplicitRelationship && !card.IsConfirmedMember,
  }
}

function getSourceMemberCode(
  card: ClientCommercialCard,
  folderCode: string,
): string {
  const activeSourceCodes = card.SourceSnapshots.flatMap((snapshot) => {
    if (snapshot.SourceMarkedDeleted) {
      return []
    }

    const code = normalizeFolderMemberCode(snapshot.RegionCode, folderCode)
    return code ? [code] : []
  })

  return activeSourceCodes[0]
    || normalizeFolderMemberCode(card.OriginalRegionCode, folderCode)
}

function normalizeFolderMemberCode(
  value: string | null | undefined,
  folderCode: string,
): string {
  const normalized = normalizeCode(value)
  const withoutFolderPrefix = normalized.replace(/^(?:B|В)/iu, '')
  const family = folderCode.slice(0, -ROOT_FOLDER_SUFFIX.length)
  const normalizedCandidate = withoutFolderPrefix.toLocaleUpperCase('uk')
  const normalizedFamily = family.toLocaleUpperCase('uk')

  return withoutFolderPrefix.length === folderCode.length
    && normalizedCandidate.startsWith(normalizedFamily)
    && !isRootFolderCode(withoutFolderPrefix)
      ? withoutFolderPrefix
      : ''
}

function getSourceMemberName(card: ClientCommercialCard): string {
  const activeSnapshots = card.SourceSnapshots
    .filter((snapshot) => !snapshot.SourceMarkedDeleted)
    .sort((left, right) => {
      const leftFolderMember = /^(?:B|В)/iu.test(normalizeCode(left.RegionCode))
      const rightFolderMember = /^(?:B|В)/iu.test(normalizeCode(right.RegionCode))

      if (leftFolderMember !== rightFolderMember) {
        return leftFolderMember ? -1 : 1
      }

      return sourcePriority(left.SourceSystem) - sourcePriority(right.SourceSystem)
    })

  return activeSnapshots
    .map((snapshot) => snapshot.ClientName?.trim() || snapshot.FullName?.trim())
    .find(Boolean) || ''
}

function sourcePriority(sourceSystem: string): number {
  if (sourceSystem.toLowerCase() === 'fenix') {
    return 0
  }
  if (sourceSystem.toLowerCase() === 'amg') {
    return 1
  }
  return 2
}

function compareFolderTreeItems(
  left: ClientFolderTreeItem,
  right: ClientFolderTreeItem,
): number {
  return (left.code || '').localeCompare(right.code || '', 'uk', {
    numeric: true,
    sensitivity: 'base',
  }) || left.name.localeCompare(right.name, 'uk')
}

function getCardCode(card: ClientCommercialCard, client: Client): string {
  return normalizeCode(card.CurrentRegionCode)
    || normalizeCode(client.RegionCode?.Value)
    || normalizeCode(card.OriginalRegionCode)
    || normalizeCode(client.OriginalRegionCode)
}

function getClientDisplayName(client: Client): string {
  return client.FullName?.trim()
    || client.Name?.trim()
    || [client.LastName, client.FirstName, client.MiddleName]
      .filter(Boolean)
      .join(' ')
      .trim()
}

function normalizeCode(value?: string | null): string {
  return value?.trim() || ''
}

function isRootFolderCode(value: string): boolean {
  return value.endsWith(ROOT_FOLDER_SUFFIX)
}

function codesEqual(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0
}
