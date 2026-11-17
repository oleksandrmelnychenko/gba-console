import { ApiError } from '../../../shared/api/apiClient'

/* A lookup that never answers (the server once hung on GET /pricings/all) left the
   client wizard on «Завантаження» with «Створити» disabled and no explanation.
   Lookups the user waits on fail after `timeoutMs` with a readable message so the
   screen can offer a retry. */
export const LOOKUP_TIMEOUT_MS = 20_000

export function withLookupTimeout<T>(
  promise: Promise<T>,
  message: string,
  timeoutMs: number = LOOKUP_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError(message, 0, null)), timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
