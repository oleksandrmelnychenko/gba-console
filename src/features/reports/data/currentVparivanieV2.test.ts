import { describe, expect, it } from 'vitest'
import { currentVparivanieDataset } from './currentVparivanie.test-fixtures'
import { currentVparivanieV2Available, currentVparivanieV2Csv,
  normalizeCurrentVparivanieV2 } from './currentVparivanieV2'

const available = { ...currentVparivanieDataset, currentVparivanie: {
  ...currentVparivanieDataset.currentVparivanie as object,
  RegionalV2Available: true, RegionalV2Day: '2026-09-03',
} }
const payload = () => ({ Version: 2, Day: '2026-09-03', ProductCount: 631, SaleFacts: 1, ReturnFacts: 1,
  Rows: Array.from({ length: 631 }, (_, index) => ({ ProductId: String(index + 1),
    Article: `A${index + 1}`, Name: 'Товар', Description: null, Group: 'AL-KO', OE: null,
    Size: null, Top: null, Cells: index === 0 ? [
      { Column: 'Stock', RegionCode: null, Quantity: '7.00', UnitId: '12', FactCount: 1 },
      { Column: 'Sales', RegionCode: null, Quantity: '3.00', UnitId: '12', FactCount: 2 },
      { Column: 'CounterpartyTotal', RegionCode: null, Quantity: '3.00', UnitId: '12', FactCount: 2 },
      { Column: 'CounterpartyRegionCode', RegionCode: 'RI00100', Quantity: '3.00', UnitId: '12', FactCount: 2 },
    ] : [] })) })

describe('regional V2 matrix wire', () => {
  it('requires explicit server publication and an exact pinned day', () => {
    expect(currentVparivanieV2Available(currentVparivanieDataset)).toBe(false)
    expect(currentVparivanieV2Available(available)).toBe(true)
    expect(currentVparivanieV2Available({ ...available, currentVparivanie: {
      ...available.currentVparivanie, RegionalV2Day: '2026-09-04',
    } })).toBe(false)
  })

  it('retains exact decimal text, empty products and a faithful export', () => {
    const result = normalizeCurrentVparivanieV2(payload())
    expect(result.Rows[0].Cells[1].Quantity).toBe('3.00')
    expect(result.Rows[1].Cells).toEqual([])
    const csv=currentVparivanieV2Csv(result)
    expect(csv).toContain('"3.00","12","2"')
    expect(csv).toContain('"2","A2","Товар"')
    result.Rows[0].Name = '=SUM(1,1)'
    expect(currentVparivanieV2Csv(result)).toContain('"\'=SUM(1,1)"')
  })

  it('refuses missing rows, duplicate facts and coerced numeric values', () => {
    const short=payload();short.Rows.pop();expect(() => normalizeCurrentVparivanieV2(short)).toThrow()
    const duplicate=payload();duplicate.Rows[1].ProductId='1'
    expect(() => normalizeCurrentVparivanieV2(duplicate)).toThrow()
    const copied=payload();copied.Rows[0].Cells.push(copied.Rows[0].Cells[0])
    expect(() => normalizeCurrentVparivanieV2(copied)).toThrow()
    const numeric=payload() as unknown as { Rows: Array<{ Cells: Array<{ Quantity: unknown }> }> }
    numeric.Rows[0].Cells[0].Quantity=7
    expect(() => normalizeCurrentVparivanieV2(numeric)).toThrow()
    const wrongTotal=payload();wrongTotal.SaleFacts=2
    expect(() => normalizeCurrentVparivanieV2(wrongTotal)).toThrow()
  })
})
