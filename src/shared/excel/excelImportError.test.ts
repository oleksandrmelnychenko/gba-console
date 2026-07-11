import { describe, expect, it } from 'vitest'
import {
  EXCEL_COLUMN_NUMBER_MAX,
  formatExcelArticleColumnError,
} from './excelImportError'

describe('formatExcelArticleColumnError', () => {
  it('explains the allowed range when the article column is outside Excel bounds', () => {
    const error = new Error(
      `Invalid 1-based column index: ${EXCEL_COLUMN_NUMBER_MAX + 1}. Valid range is 1 to ${EXCEL_COLUMN_NUMBER_MAX}`,
    )

    expect(formatExcelArticleColumnError(error, EXCEL_COLUMN_NUMBER_MAX + 1, 'fallback')).toBe(
      'У полі «Артикул» вкажіть номер колонки від 1 до 16 384.',
    )
  })

  it('recognizes the alternate EPPlus column-range message with a parameter suffix', () => {
    const error = new Error("Column out of range. Spans from 1 to 16384\n(Parameter 'column')")

    expect(formatExcelArticleColumnError(error, EXCEL_COLUMN_NUMBER_MAX + 1, 'fallback')).toBe(
      'У полі «Артикул» вкажіть номер колонки від 1 до 16 384.',
    )
  })

  it('does not mask other server errors', () => {
    const error = new Error('Файл не вдалося прочитати')

    expect(formatExcelArticleColumnError(error, EXCEL_COLUMN_NUMBER_MAX + 1, 'fallback')).toBe(error.message)
  })

  it('does not rewrite a range error when the article column is valid', () => {
    const error = new Error('Column out of range')

    expect(formatExcelArticleColumnError(error, 3, 'fallback')).toBe(error.message)
  })

  it('uses the fallback for non-Error failures', () => {
    expect(formatExcelArticleColumnError(null, 3, 'Не вдалося розпізнати файл')).toBe(
      'Не вдалося розпізнати файл',
    )
  })
})
