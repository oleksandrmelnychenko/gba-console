import { describe, expect, it } from 'vitest'
import { isExcelFile } from './excelFiles'

describe('supply order Excel files', () => {
  it('accepts common Excel workbook extensions', () => {
    expect(isExcelFile(new File([''], 'order.xls'))).toBe(true)
    expect(isExcelFile(new File([''], 'order.xlsx'))).toBe(true)
    expect(isExcelFile(new File([''], 'order.xlsm'))).toBe(true)
    expect(isExcelFile(new File([''], 'order.xlsb'))).toBe(true)
  })

  it('rejects non-Excel files', () => {
    expect(isExcelFile(new File([''], 'order.csv', { type: 'text/csv' }))).toBe(false)
    expect(isExcelFile(new File([''], 'order.pdf', { type: 'application/pdf' }))).toBe(false)
  })
})
