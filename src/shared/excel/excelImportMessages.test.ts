import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/apiClient'
import { excelImportErrorText } from './excelImportMessages'

describe('excelImportErrorText', () => {
  it('maps raw server keys to Ukrainian texts', () => {
    expect(excelImportErrorText(new ApiError('UnsupportedFileFormat', 400, null), 'x')).toBe('Файл не є коректною книгою Excel (.xlsx).')
    expect(excelImportErrorText(new ApiError('NeedUploadFile', 400, null), 'x')).toBe('Додайте файл.')
    expect(excelImportErrorText(new ApiError('InvalidData', 400, null), 'x')).toMatch(/некоректні значення/)
  })

  it('hides English parser texts and unfilled placeholders', () => {
    expect(excelImportErrorText(new ApiError('Product transfer file import failed unexpectedly.', 500, null), 'x'))
      .toBe('Файл не є коректною книгою Excel (.xlsx).')
    expect(excelImportErrorText(new ApiError('The capitalization file could not be parsed.', 400, null), 'x'))
      .toBe('Файл не є коректною книгою Excel (.xlsx).')
    expect(excelImportErrorText(new ApiError("The availability quantity must be a finite non-negative number. (Parameter 'qty')", 400, null), 'x'))
      .toBe('Кількість у файлі має бути більшою за 0.')
    expect(excelImportErrorText(new ApiError('Товару із кодом {0} не існує.', 400, null), 'x')).toMatch(/код товару/)
  })

  it('keeps readable Ukrainian server messages', () => {
    expect(excelImportErrorText(new ApiError('Значення в рядку 4 відсутнє', 400, null), 'x')).toBe('Значення в рядку 4 відсутнє')
  })
})
