import { describe, expect, it } from 'vitest'
import { normalizeCurrentVparivanieV2 } from './currentVparivanieV2'
import { CURRENT_VPARIVANIE_V2_DRAFT, currentVparivanieV2Columns,
  currentVparivanieV2Pdf, currentVparivanieV2PdfDefinition,
  currentVparivanieV2Sheets, currentVparivanieV2Xlsx } from './currentVparivanieV2Export'

function result() {
  return normalizeCurrentVparivanieV2({
    Version: 2, Day: '2026-09-03', ProductCount: 631, SaleFacts: 2, ReturnFacts: 0,
    Rows: Array.from({ length: 631 }, (_, index) => ({
      ProductId: String(index + 1), Article: `A${index + 1}`,
      Name: index === 0 ? '=Небезпечна формула' : `Товар ${index + 1}`,
      Description: null, Group: 'AL-KO', OE: null, Size: null, Top: null,
      Cells: index === 0 ? [
        { Column: 'Stock', RegionCode: null, Quantity: '9007199254740993.00000001', UnitId: '12', FactCount: 1 },
        { Column: 'Sales', RegionCode: null, Quantity: null, UnitId: null, FactCount: 1 },
        { Column: 'CounterpartyRegionCode', RegionCode: 'RI:001:00',
          Quantity: '0.00000001', UnitId: '12', FactCount: 1 },
      ] : index === 1 ? [
        { Column: 'Sales', RegionCode: null, Quantity: '-1.2000', UnitId: '12', FactCount: 1 },
      ] : [],
    })),
  })
}

describe('regional V2 draft exports', () => {
  it('keeps every product, exact decimal text, null and absent values, and a colon in a region code', () => {
    const value = result()
    const columns = currentVparivanieV2Columns(value)
    const sheets = currentVparivanieV2Sheets(value)
    expect(columns).toHaveLength(3)
    expect(sheets.matrix[3]).toContain('Регіон / RI:001:00')
    expect(sheets.matrix).toHaveLength(635)
    expect(sheets.matrix[4].slice(-3)).toEqual(['9007199254740993.00000001', '∅', '0.00000001'])
    expect(sheets.matrix[5].slice(-3)).toEqual(['', '-1.2000', ''])
    expect(sheets.matrix.at(-1)?.[0]).toBe('631')
    expect(sheets.facts.slice(2)).toEqual([
      ['1', 'Stock', '', '9007199254740993.00000001', '12', '1'],
      ['1', 'Sales', '', '∅', '', '1'],
      ['1', 'CounterpartyRegionCode', 'RI:001:00', '0.00000001', '12', '1'],
      ['2', 'Sales', '', '-1.2000', '12', '1'],
    ])
    expect(sheets.about[0][1]).toBe(CURRENT_VPARIVANIE_V2_DRAFT)
  })

  it('writes a real XLSX with text cells and no executable formula', async () => {
    const blob = await currentVparivanieV2Xlsx(result())
    const XLSX = await import('xlsx')
    const book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
    expect(book.SheetNames).toEqual(['About', 'Matrix', 'Cells'])
    const matrix = book.Sheets.Matrix
    expect(matrix['A635'].v).toBe('631')
    expect(matrix['C5']).toMatchObject({ t: 's', v: '=Небезпечна формула' })
    expect(matrix['I5']).toMatchObject({ t: 's', v: '9007199254740993.00000001' })
    expect(matrix['J5']).toMatchObject({ t: 's', v: '∅' })
    expect(matrix['K5']).toMatchObject({ t: 's', v: '0.00000001' })
    expect(matrix['I6']).toMatchObject({ t: 's', v: '' })
    expect(book.Sheets.Cells['C5'].v).toBe('RI:001:00')
  })

  it('includes all products and typed facts in a real PDF download payload', async () => {
    const value = result()
    const definition = currentVparivanieV2PdfDefinition(value)
    const table = definition.content?.[4]
    expect(table).toHaveProperty('table.body')
    const body = (table as { table: { body: unknown[][] } }).table.body
    expect(body).toHaveLength(1 + 631 + 4)
    expect(body[1][0]).toContain('=Небезпечна формула')
    expect(body[2]).toEqual(['1', 'Остатки', '9007199254740993.00000001', '12', '1'])
    expect(body[4]).toEqual(['1', 'Регіон / RI:001:00', '0.00000001', '12', '1'])
    expect(body.at(-1)?.[0]).toContain('ID 631')
    const pdf = await currentVparivanieV2Pdf(value)
    expect(pdf.type).toBe('application/pdf')
    expect(pdf.size).toBeGreaterThan(1000)
    expect(await pdf.slice(0, 8).text()).toBe('%PDF-1.3')
  }, 30_000)
})
