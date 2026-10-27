import { useMemo } from 'react'
import { useSystemOfRecordCutover } from '../../shared/system-of-record/systemOfRecordCutover'
import type { Agreement, Client } from './types'

export type SourceEditMode = 'locked' | 'manual'

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

export function isSourceManagedClient(client: Client | null | undefined, afterCutover = false): boolean {
  return !afterCutover && hasSourceIdentity(client)
}

export function isSourceManagedAgreement(agreement: Agreement | null | undefined, afterCutover = false): boolean {
  return !afterCutover && hasSourceIdentity(agreement)
}

export function canEditClientLifecycle(
  client: Client | null | undefined,
  hasPermission: boolean,
  afterCutover = false,
): boolean {
  return hasPermission && !isSourceManagedClient(client, afterCutover)
}

export function useClientSourceOwnership() {
  const { isActive } = useSystemOfRecordCutover()

  return useMemo(() => ({
    afterCutover: isActive,
    canEditClientLifecycle: (client: Client | null | undefined, hasPermission: boolean) =>
      canEditClientLifecycle(client, hasPermission, isActive),
    isSourceManagedAgreement: (agreement: Agreement | null | undefined) =>
      isSourceManagedAgreement(agreement, isActive),
    isSourceManagedClient: (client: Client | null | undefined) =>
      isSourceManagedClient(client, isActive),
  }), [isActive])
}
