import { isUserReadableText, technicalErrorText } from '../../shared/api/userErrorText'

export const PROCUREMENT_RETRY_DELAY_MS = 20_000
const PREPARING_TEXT = 'План закупівлі ще готується. Повторіть запит за хвилину.'

const NOT_CONFIGURED_TEXT = 'Сервіс планування закупівель не налаштований. Зверніться до адміністратора.'
const NOT_CONFIGURED_CODES = /ai_service_not_configured|ai_source_environment_misconfigured/

function isServiceUnavailable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 503)
}

/** A 503 that waiting will not fix: the procurement service is not configured for this server. */
export function isProcurementNotConfigured(error: unknown): boolean {
  return isServiceUnavailable(error) && NOT_CONFIGURED_CODES.test(technicalErrorText(error))
}

/** A 503 that clears by itself (data still being prepared), so one delayed retry makes sense. */
export function isProcurementPreparing(error: unknown): boolean {
  return isServiceUnavailable(error) && !isProcurementNotConfigured(error)
}

export function procurementLoadError(error: unknown, fallback: string, t: (value: string) => string): string {
  if (isProcurementNotConfigured(error)) {
    console.warn('[gba] procurement service is not configured:', technicalErrorText(error))
    return t(NOT_CONFIGURED_TEXT)
  }
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
