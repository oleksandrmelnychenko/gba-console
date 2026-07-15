import {
  classifySalesMutationFailure,
  normalizeSalesOperationNetUid,
  snapshotSalesMutationPayload,
  type SalesMutationOperationOptions,
} from './salesMutationOperation'
import type { SalesUkraineSale } from './types'
import { createWizardOperationId } from './components/new-sale-wizard/wizardMutationOperation'

export type SaleFileMutationKind = 'sale-update-file' | 'sale-vat-document'

export const SALE_FILE_MUTATION_SURFACES = {
  management: 'sale-management',
  wizard: 'new-sale-wizard',
} as const

export type SaleFileMutationSurface = (
  typeof SALE_FILE_MUTATION_SURFACES
)[keyof typeof SALE_FILE_MUTATION_SURFACES]

export const SALE_FILE_MUTATION_INTENTS = {
  deliverySave: 'delivery-save',
  invoiceConversion: 'invoice-conversion',
  save: 'save',
  submit: 'submit',
} as const

export type SaleFileMutationIntent = (
  typeof SALE_FILE_MUTATION_INTENTS
)[keyof typeof SALE_FILE_MUTATION_INTENTS]

export type SaleFileMutationOperationIdentity = {
  intent: SaleFileMutationIntent
  surface: SaleFileMutationSurface
}

export type SaleFileMetadata = {
  lastModified: number
  name: string
  sha256?: string | null
  size: number
  type: string
}

export type SaleFileMutationSubmission = {
  file: File | null
  fileMetadata: SaleFileMetadata | null
  kind: SaleFileMutationKind
  operationId: string
  payload: SalesUkraineSale
}

export type PersistedSaleFileMutation = Omit<SaleFileMutationSubmission, 'file'> & {
  hasFile: boolean
}

export type SaleFileMutationRequest<TResult> = (
  sale: SalesUkraineSale,
  file: File | null,
  operation: SalesMutationOperationOptions,
) => Promise<TResult>

export type SaleFileMutationSessionResult<TResult> =
  | { result: TResult; status: 'acknowledged' | 'reconciled'; submission: null }
  | { error: unknown; status: 'pending-reconciliation'; submission: SaleFileMutationSubmission }
  | { error: unknown; status: 'definitive-failure'; submission: null }

export function getSaleFileMutationContext(
  sale: SalesUkraineSale | null | undefined,
  surface: SaleFileMutationSurface = SALE_FILE_MUTATION_SURFACES.management,
): string {
  const identity = getSaleIdentity(sale)

  return identity ? `sale-file:${surface}:${identity}` : ''
}

export function getLegacySaleFileMutationContext(
  sale: SalesUkraineSale | null | undefined,
): string {
  const identity = getSaleIdentity(sale)

  return identity ? `sale-file:${identity}` : ''
}

export function getLegacySaleFileMutationContextFromContext(context: string): string {
  for (const surface of Object.values(SALE_FILE_MUTATION_SURFACES)) {
    const prefix = `sale-file:${surface}:`

    if (context.startsWith(prefix) && context.length > prefix.length) {
      return `sale-file:${context.slice(prefix.length)}`
    }
  }

  return ''
}

export function getSaleFileMutationJournalContext(
  context: string,
  intent: SaleFileMutationIntent,
): string {
  if (!context || intent === SALE_FILE_MUTATION_INTENTS.save) {
    return context
  }

  return `${context}:intent:${intent}`
}

export async function createSaleFileMutationSubmission(
  kind: SaleFileMutationKind,
  payload: SalesUkraineSale,
  file: File | null,
  operationId: string = createWizardOperationId(),
): Promise<SaleFileMutationSubmission> {
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)

  return {
    file,
    fileMetadata: await getSaleFileMetadata(file),
    kind,
    operationId: normalizedOperationId,
    payload: snapshotSalesMutationPayload(payload, normalizedOperationId),
  }
}

export function persistSaleFileMutationSubmission(
  submission: SaleFileMutationSubmission,
): PersistedSaleFileMutation {
  return {
    fileMetadata: submission.fileMetadata,
    hasFile: submission.file !== null,
    kind: submission.kind,
    operationId: submission.operationId,
    payload: submission.payload,
  }
}

export function restoreSaleFileMutationSubmission(
  persisted: PersistedSaleFileMutation,
): SaleFileMutationSubmission | null {
  if (!isPersistedSaleFileMutation(persisted) || persisted.hasFile) {
    return null
  }

  return {
    file: null,
    fileMetadata: null,
    kind: persisted.kind,
    operationId: normalizeSalesOperationNetUid(persisted.operationId),
    payload: snapshotSalesMutationPayload(persisted.payload, persisted.operationId),
  }
}

export async function resumeSaleFileMutationSubmission(
  persisted: PersistedSaleFileMutation,
  file: File,
): Promise<SaleFileMutationSubmission> {
  if (!isPersistedSaleFileMutation(persisted) || !persisted.hasFile || !persisted.fileMetadata) {
    throw new Error('Збережена операція не містить перевірених даних файла')
  }

  if (!persisted.fileMetadata.sha256) {
    throw new Error('Попередній файл не має SHA-256 відбитка і не може бути безпечно повторений')
  }

  const candidateMetadata = await getSaleFileMetadata(file)

  if (!candidateMetadata || !isSameSaleFile(candidateMetadata, persisted.fileMetadata)) {
    throw new Error('Оберіть той самий файл: назва, розмір, дата, тип або SHA-256 не збігаються')
  }

  return {
    file,
    fileMetadata: candidateMetadata,
    kind: persisted.kind,
    operationId: normalizeSalesOperationNetUid(persisted.operationId),
    payload: snapshotSalesMutationPayload(persisted.payload, persisted.operationId),
  }
}

export function isPersistedSaleFileMutation(value: unknown): value is PersistedSaleFileMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<PersistedSaleFileMutation>

  return (
    (candidate.kind === 'sale-update-file' || candidate.kind === 'sale-vat-document') &&
    typeof candidate.operationId === 'string' &&
    Boolean(candidate.operationId) &&
    Boolean(candidate.payload) &&
    typeof candidate.payload === 'object' &&
    typeof candidate.hasFile === 'boolean' &&
    (candidate.fileMetadata === null || isFileMetadata(candidate.fileMetadata))
  )
}

export async function advanceSaleFileMutationSession<TResult>({
  createOperationId,
  file,
  kind,
  payload,
  request,
  submission,
}: {
  createOperationId?: () => string
  file?: File | null
  kind: SaleFileMutationKind
  payload?: SalesUkraineSale
  request: SaleFileMutationRequest<TResult>
  submission?: SaleFileMutationSubmission | null
}): Promise<SaleFileMutationSessionResult<TResult>> {
  if (!submission && !payload) {
    throw new Error('A payload is required to start a sale file mutation')
  }

  if (submission && submission.kind !== kind) {
    throw new Error('Pending sale mutation kind does not match the requested operation')
  }

  const current = submission ?? await createSaleFileMutationSubmission(
    kind,
    payload as SalesUkraineSale,
    file ?? null,
    createOperationId?.(),
  )

  try {
    const result = await request(current.payload, current.file, { operationId: current.operationId })

    return {
      result,
      status: submission ? 'reconciled' : 'acknowledged',
      submission: null,
    }
  } catch (error) {
    if (classifySalesMutationFailure(error) === 'definitive-failure') {
      return { error, status: 'definitive-failure', submission: null }
    }

    return { error, status: 'pending-reconciliation', submission: current }
  }
}

async function getSaleFileMetadata(file: File | null): Promise<SaleFileMetadata | null> {
  return file
    ? {
        lastModified: file.lastModified,
        name: file.name,
        sha256: await calculateFileSha256(file),
        size: file.size,
        type: file.type,
      }
    : null
}

function isFileMetadata(value: unknown): value is SaleFileMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const metadata = value as Partial<SaleFileMetadata>

  return (
    typeof metadata.lastModified === 'number' &&
    Number.isFinite(metadata.lastModified) &&
    typeof metadata.name === 'string' &&
    (metadata.sha256 === undefined || metadata.sha256 === null || isSha256(metadata.sha256)) &&
    typeof metadata.size === 'number' &&
    Number.isFinite(metadata.size) &&
    metadata.size >= 0 &&
    typeof metadata.type === 'string'
  )
}

async function calculateFileSha256(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Браузер не підтримує SHA-256 перевірку файла; запит не надіслано')
  }

  const bytes = await file.arrayBuffer()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isSameSaleFile(left: SaleFileMetadata, right: SaleFileMetadata): boolean {
  return (
    left.lastModified === right.lastModified &&
    left.name === right.name &&
    left.sha256 === right.sha256 &&
    left.size === right.size &&
    left.type === right.type
  )
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value)
}

function getSaleIdentity(sale: SalesUkraineSale | null | undefined): string {
  const netUid = sale?.NetUid?.trim().toLowerCase()
  const persistedNetUid = netUid && netUid !== '00000000-0000-0000-0000-000000000000' ? netUid : ''

  return persistedNetUid || (typeof sale?.Id === 'number' && sale.Id > 0 ? `id-${sale.Id}` : '')
}
