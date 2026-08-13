import type { Agreement, Client } from './types'

type SourceIdentity = Pick<
  Client,
  'SourceAmgCode' | 'SourceFenixCode' | 'SourceAmgId' | 'SourceFenixId'
>

function hasSourceIdentity(value: SourceIdentity | null | undefined): boolean {
  return value?.SourceAmgCode != null
    || value?.SourceFenixCode != null
    || value?.SourceAmgId != null
    || value?.SourceFenixId != null
}

export function isSourceManagedClient(client: Client | null | undefined): boolean {
  return hasSourceIdentity(client)
}

export function isSourceManagedAgreement(agreement: Agreement | null | undefined): boolean {
  return hasSourceIdentity(agreement)
}

export function canEditClientLifecycle(client: Client | null | undefined, hasPermission: boolean): boolean {
  return hasPermission && !isSourceManagedClient(client)
}
