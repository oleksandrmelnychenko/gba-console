function statusOf(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined
}

/** 409: someone saved the record after it was loaded (optimistic concurrency). */
export function isConflictError(error: unknown): boolean {
  return statusOf(error) === 409
}

/** 404: the record no longer exists (deleted in another tab, or a broken link). */
export function isNotFoundError(error: unknown): boolean {
  return statusOf(error) === 404
}
