export function procurementLoadError(error: unknown, fallback: string, t: (value: string) => string): string {
  if (error && typeof error === 'object' && 'status' in error && error.status === 503) {
    return t('Підтверджені дані для плану поки недоступні. Повторіть запит.')
  }
  return fallback
}
