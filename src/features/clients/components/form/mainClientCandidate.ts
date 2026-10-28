import type { Client } from '../../types'

export function getMainClientCandidateName(client: Client): string {
  return client.FullName?.trim() || client.Name?.trim() || ''
}

export function isMainClientCandidate(candidate: Client, clientNetUid: string | undefined): boolean {
  return Boolean(candidate.NetUid)
    && candidate.NetUid !== clientNetUid
    && !candidate.IsSubClient
    && !candidate.IsTradePoint
    && candidate.MainClientId == null
    && candidate.Deleted !== true
}
