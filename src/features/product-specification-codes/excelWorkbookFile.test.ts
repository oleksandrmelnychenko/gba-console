import { describe, expect, it } from 'vitest'
import { excelWorkbookFileError } from './excelWorkbookFile'

const t = (value: string) => value

describe('excelWorkbookFileError', () => {
  it('accepts real workbooks by extension and content', async () => {
    expect(await excelWorkbookFileError(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])], 'codes.xlsx'), t)).toBeNull()
    expect(await excelWorkbookFileError(new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'codes.xls'), t)).toBeNull()
  })

  it('rejects CSV and text renamed to .xlsx with Ukrainian reasons', async () => {
    expect(await excelWorkbookFileError(new File(['a;b'], 'codes.csv'), t))
      .toBe('Підтримуються лише книги Excel (.xlsx, .xls). CSV не підтримується.')
    expect(await excelWorkbookFileError(new File(['not a workbook'], 'codes.xlsx'), t))
      .toBe('Файл не є коректною книгою Excel (.xlsx).')
  })
})
