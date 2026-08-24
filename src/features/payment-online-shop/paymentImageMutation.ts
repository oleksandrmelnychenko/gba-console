import { ApiError } from '../../shared/api/apiClient'
import {
  classifySalesMutationFailure,
  type SalesMutationFailureStatus,
} from '../sales-ukraine/salesMutationOperation'
import type {
  AddPaymentImagePayload,
  PaymentShopUser,
  PaymentTypeValue,
} from './types'

export const RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT =
  'RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT'
export const RETAIL_PAYMENT_STATUS_VERSION_CONFLICT =
  'RETAIL_PAYMENT_STATUS_VERSION_CONFLICT'

export type RetailPaymentImageConcurrencyCode =
  | typeof RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT
  | typeof RETAIL_PAYMENT_STATUS_VERSION_CONFLICT

export type PaymentImageFileMetadata = {
  lastModified: number
  name: string
  sha256: string
  size: number
  type: string
}

export type AddPaymentImageMutationPayload = {
  amount: number
  comment: string
  file: PaymentImageFileMetadata
  paymentImageId: number
  paymentType: PaymentTypeValue | number
  user: PaymentShopUser | null
}

export class PaymentImageReplayFileMismatchError extends Error {
  constructor() {
    super(
      'Попередній платіж очікує перевірки. Оберіть той самий файл, щоб безпечно повторити запит.',
    )
    this.name = 'PaymentImageReplayFileMismatchError'
  }
}

export async function createAddPaymentImageMutationPayload(
  payload: AddPaymentImagePayload,
): Promise<AddPaymentImageMutationPayload> {
  return {
    amount: payload.amount,
    comment: payload.comment,
    file: await getPaymentImageFileMetadata(payload.image),
    paymentImageId: payload.paymentImageId,
    paymentType: payload.paymentType,
    user: payload.user,
  }
}

export function ensurePaymentImageReplayFileMatches(
  persisted: PaymentImageFileMetadata,
  current: PaymentImageFileMetadata,
): void {
  if (
    persisted.sha256 !== current.sha256 ||
    persisted.size !== current.size ||
    getFileExtension(persisted.name) !== getFileExtension(current.name)
  ) {
    throw new PaymentImageReplayFileMismatchError()
  }
}

export function classifyRetailPaymentImageMutationFailure(
  error: unknown,
): SalesMutationFailureStatus {
  if (
    error instanceof ApiError &&
    [401, 403, 413, 415].includes(error.status)
  ) {
    return 'definitive-failure'
  }

  return classifySalesMutationFailure(error)
}

export function isRetailPaymentImageConcurrencyConflict(
  error: unknown,
): boolean {
  return getRetailPaymentImageConcurrencyCode(error) !== null
}

export function getRetailPaymentImageConcurrencyCode(
  error: unknown,
): RetailPaymentImageConcurrencyCode | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null
  }

  const payloadCode = readErrorCode(error.payload)

  if (
    payloadCode === RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT ||
    payloadCode === RETAIL_PAYMENT_STATUS_VERSION_CONFLICT
  ) {
    return payloadCode
  }

  // Compatibility with a rolling deployment where the old server may not
  // expose ErrorCode yet. Keep this deliberately narrow: other 409 responses
  // (locked item or reused idempotency key) need different recovery.
  if (error.message.includes('payment image item changed')) {
    return RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT
  }

  if (error.message.includes('shop payment status changed')) {
    return RETAIL_PAYMENT_STATUS_VERSION_CONFLICT
  }

  return null
}

export function isDefinitiveRetailPaymentImageConcurrencyConflict(
  error: unknown,
): boolean {
  return (
    isRetailPaymentImageConcurrencyConflict(error) &&
    classifyRetailPaymentImageMutationFailure(error) ===
      'definitive-failure'
  )
}

async function getPaymentImageFileMetadata(
  file: File,
): Promise<PaymentImageFileMetadata> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Браузер не підтримує SHA-256 перевірку файла; запит не надіслано',
    )
  }

  const bytes = await file.arrayBuffer()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)

  return {
    lastModified: file.lastModified,
    name: file.name,
    sha256: Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join(''),
    size: file.size,
    type: file.type,
  }
}

function getFileExtension(fileName: string): string {
  const separatorIndex = fileName.lastIndexOf('.')

  return separatorIndex >= 0
    ? fileName.slice(separatorIndex + 1).toLowerCase()
    : ''
}

function readErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ''
  }

  const value = (payload as { ErrorCode?: unknown }).ErrorCode

  return typeof value === 'string' ? value.trim() : ''
}
