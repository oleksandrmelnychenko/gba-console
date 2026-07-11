export const EXCEL_COLUMN_NUMBER_MAX = 16_384
export const EXCEL_COLUMN_NUMBER_MIN = 1

const EXCEL_COLUMN_RANGE_ERROR_PATTERNS = [
  /^Invalid 1-based column index: .+\. Valid range is 1 to 16384\.?$/i,
  /^Column out of range(?:\. Spans from 1 to 16384\.?)?$/i,
]

const ARTICLE_COLUMN_RANGE_MESSAGE = 'У полі «Артикул» вкажіть номер колонки від 1 до 16 384.'

export function formatExcelArticleColumnError(
  error: unknown,
  articleColumnNumber: number,
  fallbackMessage: string,
): string {
  const message = error instanceof Error ? error.message : fallbackMessage
  const normalizedMessage = message.replace(/\s*\(Parameter ['"]?column['"]?\)\s*$/i, '').trim()
  const articleColumnIsOutOfRange = articleColumnNumber < EXCEL_COLUMN_NUMBER_MIN
    || articleColumnNumber > EXCEL_COLUMN_NUMBER_MAX

  if (
    articleColumnIsOutOfRange
    && EXCEL_COLUMN_RANGE_ERROR_PATTERNS.some((pattern) => pattern.test(normalizedMessage))
  ) {
    return ARTICLE_COLUMN_RANGE_MESSAGE
  }

  return message
}
