import { describe, expect, it, vi } from 'vitest'
import {
  TRANSFER_IMPORT_MAX_ROWS,
  buildTransferImportTemplate,
  resolveTransferImportEndRow,
  transferImportTemplateRows,
} from './transferImport'

/* WH-26: empty «Кінцевий рядок» means «to the end»; the dialog offers a template. */
describe('transfer import', () => {
  it('keeps an explicit end row', () => {
    expect(resolveTransferImportEndRow(2, 7)).toBe(7)
  })

  it('reads to the end of the file when the end row is empty', () => {
    expect(resolveTransferImportEndRow(2, '')).toBe(2 + TRANSFER_IMPORT_MAX_ROWS - 1)
    expect(resolveTransferImportEndRow('', '')).toBe('')
  })

  it('template has the header row and code / quantity in columns 1 and 2', () => {
    const t = vi.fn((key: string) => key)
    const rows = transferImportTemplateRows(t)

    expect(rows[0]).toEqual(['Код товару', 'Кількість'])
    expect(rows.slice(1).every((row) => typeof row[0] === 'string' && typeof row[1] === 'number')).toBe(true)
  })

  it('builds an .xlsx workbook', async () => {
    const blob = await buildTransferImportTemplate((key) => key)

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(blob.size).toBeGreaterThan(0)
  })
})
