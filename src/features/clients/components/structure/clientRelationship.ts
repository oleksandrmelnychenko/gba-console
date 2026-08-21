import type { Client } from '../../types'

export type ClientRelationshipKind = 'structural-unit' | 'subclient'

export function extractRelatedClients(
  client: Client,
  relationKind: ClientRelationshipKind,
): Client[] {
  return extractRelatedClientsFromLinks(client.SubClients || [], relationKind)
}

export function extractRelatedClientsFromLinks(
  links: NonNullable<Client['SubClients']>,
  relationKind: ClientRelationshipKind,
): Client[] {
  return links.reduce<Client[]>((acc, link) => {
    if (link.SubClient && isClientRelationshipKind(link.SubClient, relationKind)) {
      acc.push(link.SubClient)
    }

    return acc
  }, [])
}

export function isClientRelationshipKind(
  client: Client,
  relationKind: ClientRelationshipKind,
): boolean {
  if (relationKind === 'structural-unit') {
    return Boolean(client.IsTradePoint && !client.IsSubClient)
  }

  return Boolean(client.IsSubClient)
}
