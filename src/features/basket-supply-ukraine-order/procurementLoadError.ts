import { isUserReadableText, technicalErrorText } from '../../shared/api/userErrorText'

export const PROCUREMENT_RETRY_DELAY_MS = 20_000
const PREPARING_TEXT = 'План закупівлі ще готується. Повторіть запит за хвилину.'

export function isProcurementPreparing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 503)
}

export function procurementLoadError(error: unknown, fallback: string, t: (value: string) => string): string {
  if (isProcurementPreparing(error)) {
    const message = technicalErrorText(error)
    return isUserReadableText(message) ? message : t(PREPARING_TEXT)
  }
  const technical = technicalErrorText(error)
  if (technical) console.warn('[gba] procurement load failed:', technical)
  return fallback
}

export function procurementRetryNotice(error: unknown, t: (value: string) => string): string {
  return `${procurementLoadError(error, '', t)} ${t('Автоматично повторимо запит за 20 с.')}`
}

export async function loadProcurementWithRetry<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
  onPreparing: (error: unknown) => void,
  delayMs: number = PROCUREMENT_RETRY_DELAY_MS,
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (!isProcurementPreparing(error) || signal.aborted) throw error
    onPreparing(error)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(error)
      }, { once: true })
    })
    return load()
  }
}
