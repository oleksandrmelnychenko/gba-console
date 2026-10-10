import { describe, expect, it } from 'vitest'
import { isMatrixCapability, matrixQuantity, matrixRequest, normalizeMatrixResult } from './originalVparivanie'
import { matrixCapability, matrixFixture, matrixWire } from '../testing/originalVparivanieFixtures'
describe('original matrix transport', () => {
  it('preserves decimals, duplicate captions, empty child and absent cells without sorting or number conversion', () => {
    const result = normalizeMatrixResult(matrixFixture(), matrixWire())
    expect(result.Rows.map(row => row.ProductReference)).toEqual(['B'.repeat(32), 'C'.repeat(32)])
    expect(result.Rows[0].Values).toEqual(['0', '0', null, null])
    expect(result.Rows[1].Values[2]).toBe('-9007199254740993.125')
    expect(result.Columns.map(column => column.RegionCode)).toEqual([null, '', null, ''])
    expect(result.SourceParityVerified).toBe(false)
  })
  it.each([['2025-02-30','2025-02-30'],['2025-01-01','2035-01-01'],['2024-12-31','2024-12-31'],['2025-04-23','2025-04-22'],['2099-12-01','2100-01-01']])('rejects unsupported period %s…%s', (from, through) => {
    expect(() => matrixRequest(matrixCapability(), from, through, 3569, 'A'.repeat(32))).toThrow()
  })
  it.each([['2025-01-01','2026-10-09'],['2025-12-31','2026-01-01'],['2028-02-29','2028-03-01'],['2025-01-01','2034-12-31']])('preserves the full period %s…%s through request and response', (from, through) => {
    const request = matrixRequest(matrixCapability(), from, through, 3569, 'A'.repeat(32))
    const result = normalizeMatrixResult({ ...matrixFixture(), From: from, Through: through }, request)
    expect([result.From, result.Through]).toEqual([from, through])
    expect(result.Rows[1].Values[2]).toBe('-9007199254740993.125')
    expect(result.SourceParityVerified).toBe(false)
  })
  it('rejects an invalid period echoed by a response even if its request was not constructed by the helper', () => {
    const request = { ...matrixWire(), From: '2025-01-01', Through: '2035-01-01' }
    expect(() => normalizeMatrixResult({ ...matrixFixture(), ...request }, request)).toThrow()
    expect(isMatrixCapability({ ...matrixCapability(), PeriodPolicy: 'InclusiveCalendarWholeSecondsSingleMonth' })).toBe(false)
  })
  it('cannot confuse local group aliases, another Source schema, period, world or definition', () => {
    for (const patch of [{ GroupId: 3568 },{ GroupReference: 'D'.repeat(32) },{ SchemaId: matrixWire().SourceId },{ World: 'amg' },{ Through: '2025-04-22' },{ DefinitionSha256: 'b'.repeat(64) }])
      expect(() => normalizeMatrixResult({ ...matrixFixture(), ...patch }, matrixWire())).toThrow()
    expect(() => matrixRequest(matrixCapability(), '2025-04-01', '2025-04-23', 3569, '0'.repeat(32))).toThrow()
    expect(isMatrixCapability({ ...matrixCapability(), QuantityEncoding: 'Number' })).toBe(false)
  })
  it.each([0, 1.25, '1e3', 'NaN', '1,25', '=1+2', '79228162514264337593543950336', '0.12345678901234567890123456789'])('rejects invalid or inexact decimal %s', value => {
    expect(() => matrixQuantity(value)).toThrow()
  })
  it('retains maximum decimal and never casts to Number', () => {
    expect(matrixQuantity('79228162514264337593543950335')).toBe('79228162514264337593543950335')
    expect(matrixQuantity('0.0000000000000000000000000001')).toBe('0.0000000000000000000000000001')
  })
  it('rejects a truncated row, duplicate identity and inconsistent repeated total', () => {
    for (const mutate of [(r: ReturnType<typeof matrixFixture>) => { r.Rows[0].Values.pop() },
      (r: ReturnType<typeof matrixFixture>) => { r.Rows[1].ProductReference = r.Rows[0].ProductReference },
      (r: ReturnType<typeof matrixFixture>) => { r.Rows[0].Values[1] = '1' },
      (r: ReturnType<typeof matrixFixture>) => { r.Rows[0].Values[0] = null },
      (r: ReturnType<typeof matrixFixture>) => { r.Columns[1] = { ...r.Columns[0] } },
      (r: ReturnType<typeof matrixFixture>) => { r.Columns.splice(1, 1); r.Rows.forEach(row => row.Values.splice(1, 1)) }]) {
      const value = matrixFixture(); mutate(value); expect(() => normalizeMatrixResult(value, matrixWire())).toThrow()
    }
  })
  it('unavailable response cannot contain a partial matrix or fabricated zero row', () => {
    const empty = { ...matrixFixture(), Available: false, Code: 'original_vparivanie_normal_party_metadata_unavailable',
      NormalInputsComplete: false, OurSnapshotVerified: false, InputWitnessSha256: null, GroupCaption: null, Columns: [], Rows: [] }
    expect(normalizeMatrixResult(empty, matrixWire()).Available).toBe(false)
    expect(() => normalizeMatrixResult({ ...empty, Rows: matrixFixture().Rows }, matrixWire())).toThrow()
    expect(() => normalizeMatrixResult({ ...empty, InputWitnessSha256: 'a'.repeat(64) }, matrixWire())).toThrow()
  })
})
