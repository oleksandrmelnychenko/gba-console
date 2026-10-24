import actualPublications from './originalWarehouseMovement.publications.http-fixture.json'
import actualNonzero from './originalWarehouseMovement.nonzero.http-fixture.json'
import actualZero from './originalWarehouseMovement.zero.http-fixture.json'
import type { MovementRequest } from './originalWarehouseMovement'
import { describe, expect, it } from 'vitest'
import { isMovementCapability, normalizeMovementPublications, normalizeMovementResult, movementRequestError, normalizeMovementWire } from './originalWarehouseMovement'
import { movementFixture, movementPublication, movementRequest, movementCapability } from './originalWarehouseMovement.test-fixtures'
import { movementHeaders, movementMatrix, movementCsv, movementPdf, movementPdfDefinition, movementXlsx } from './originalWarehouseMovementExport'
import * as XLSX from 'xlsx'
const clone = () => structuredClone(movementFixture)
const camel = (v: unknown): unknown => Array.isArray(v) ? v.map(camel) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k.charAt(0).toLowerCase() + k.slice(1), camel(x)])) : v
it('accepts actual anonymized server fold with lowercase recorder identity and exact 40 + 17 - 32 = 25', () => {
  const result = normalizeMovementResult(clone(), movementRequest, movementPublication)
  expect(result.Totals).toEqual({ Opening: '40.000', Incoming: '17.000', Outgoing: '32.000', Closing: '25.000' })
  expect(result.Rows[0].Registrars[0].RecorderType).toBe('00003f3d')
  expect(normalizeMovementResult(camel(clone()), movementRequest, movementPublication)).toEqual(result)
  expect(normalizeMovementPublications(camel([movementPublication]))).toEqual([movementPublication])
  expect(isMovementCapability(normalizeMovementWire(camel(movementCapability)))).toBe(true)
})
it('accepts zero/signed physical line numbers without inventing a positive-only contract', () => {
  const value = clone(); value.Rows[0].Registrars[0].SourceLineNumbers = [-1, 0]
  expect(normalizeMovementResult(value, movementRequest, movementPublication).Available).toBe(true)
})
describe('refuses inconsistent or foreign result before showing/exporting', () => {
  it.each(['capture', 'scope', 'total', 'running', 'missingWarehouse', 'duplicateWarehouse', 'timeTie', 'foreignProduct', 'alias', 'partial'] as const)('%s', kind => {
    const value = clone()
    if (kind === 'capture') value.Capture!.ManifestSha256 = 'd'.repeat(64)
    if (kind === 'scope') value.Scope.From = '2026-09-02'
    if (kind === 'total') value.Totals!.Closing = '26.000'
    if (kind === 'running') value.Rows[0].Registrars[0].Quantity.Opening = '2.000'
    if (kind === 'missingWarehouse') value.Rows.pop()
    if (kind === 'duplicateWarehouse') value.Rows[1] = value.Rows[0]
    if (kind === 'timeTie') value.Rows[0].Registrars[1].SourcePeriod = value.Rows[0].Registrars[0].SourcePeriod
    if (kind === 'foreignProduct') value.Rows[0].SourceProductReference = 'F'.repeat(32)
    if (kind === 'alias') Object.assign(value, { available: false })
    if (kind === 'partial') value.Available = false
    expect(() => normalizeMovementResult(value, movementRequest, movementPublication)).toThrow()
  })
})
it('preserves unavailable input without fabricated zero or export', () => {
  const value = { ...clone(), Available: false, Code: 'original_warehouse_opening_publication_unavailable', Rows: [], Totals: null, InputWitnessSha256: null, ResultSha256: null }
  const result = normalizeMovementResult(value, movementRequest, movementPublication)
  expect(result.Totals).toBeNull(); expect(() => movementMatrix(result)).toThrow()
})
it('constrains one article and selected source warehouses to the same publication and 366-day maximum', () => {
  expect(movementRequestError(movementRequest, movementPublication)).toBeNull()
  for (const change of [{ From: '2024-12-31' }, { From: '2025-01-01', Through: '2026-10-01' }, { Article: 'unknown' }, { Warehouses: [] }, { Warehouses: ['F'.repeat(32)] }]) {
    expect(movementRequestError({ ...movementRequest, ...change }, movementPublication)).not.toBeNull()
  }
  expect(() => normalizeMovementPublications([{ ...movementPublication, Capture: { ...movementPublication.Capture, SourceCompletedUtc: '2026-10-24T10:04:41' } }])).toThrow()
  expect(isMovementCapability({ ...movementCapability, World: 'amg' })).toBe(false)
})
it('exports exact running registrar states while totals add only warehouses', async () => {
  const result = normalizeMovementResult(clone(), movementRequest, movementPublication), matrix = movementMatrix(result)
  expect(matrix).toHaveLength(22)
  expect(matrix[2].slice(4)).toEqual(['1.000', '2.000', '0.000', '3.000'])
  const registrarClosingSum = result.Rows.flatMap(row => row.Registrars).reduce((sum, row) => sum + BigInt(row.Quantity.Closing.replace('.', '')), 0n)
  expect(registrarClosingSum).not.toBe(BigInt(result.Totals!.Closing.replace('.', '')))
  expect(matrix.at(-1)?.slice(4)).toEqual(['40.000', '17.000', '32.000', '25.000'])
  const definition = movementPdfDefinition(result)
  expect(JSON.stringify(definition)).toContain('17.000')
  expect(movementCsv(result)).toContain('"40.000","17.000","32.000","25.000"')
  const blob = await movementXlsx(result)
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob) })
  const workbook = XLSX.read(bytes, { type: 'array' }), sheet = workbook.Sheets['Рух товару']
  expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })).toEqual(matrix)
  expect(sheet.E2.t).toBe('s')
})
it('CSV labels cannot become formulas and signed quantities remain exact', () => {
  const result = clone(); result.Rows[0].Caption = '=SUM(1,2)'
  expect(movementCsv(result)).toContain("\"'=SUM(1,2)\"")
})

it('keeps a genuinely observed blank document number and falls back to source identity', () => {
  const result = clone(); result.Rows[0].Registrars[0].Number = ''; result.Rows[0].Registrars[0].SourceDate = null
  const accepted = normalizeMovementResult(result, movementRequest, movementPublication)
  expect(movementMatrix(accepted)[2][2]).toBe(`${accepted.Rows[0].Registrars[0].RecorderType}:${accepted.Rows[0].Registrars[0].RecorderReference}`)
})

it('roundtrips independently produced camelCase source fixtures including genuine observed zero', () => {
  const publications = normalizeMovementPublications(actualPublications)
  for (const actual of [actualNonzero, actualZero]) {
    const request: MovementRequest = { Version: 1, World: 'fenix', From: actual.scope.from, Through: actual.scope.through, Article: actual.scope.article, Warehouses: actual.scope.warehouses }
    const result = normalizeMovementResult(actual, request, publications[0])
    expect(result.Available).toBe(true)
    expect(result.Rows).toHaveLength(2)
    expect(result.Totals?.Closing).toBe(actual === actualNonzero ? '25.000' : '0.000')
    expect(movementMatrix(result).at(-1)?.slice(4)).toEqual(Object.values(actual.totals!))
  }
})

it('isolates PDF table normalization from shared headers, the accepted result and subsequent exports', () => {
  const result = clone(), before = structuredClone(result), headers = [...movementHeaders], matrix = movementMatrix(result)
  const definition = movementPdfDefinition(result)
  const table = definition.content.find(item => typeof item === 'object' && item !== null && 'table' in item) as { table: { body: unknown[][] } }
  expect(table.table.body[0]).not.toBe(movementHeaders)
  table.table.body[0].forEach((text, index) => { table.table.body[0][index] = { text, fillColor: '#fff', _margin: null } })
  table.table.body[1][4] = { text: table.table.body[1][4] }
  expect(movementHeaders).toEqual(headers)
  expect(movementMatrix(result)).toEqual(matrix)
  expect(result).toEqual(before)
  expect(movementCsv(result)).not.toContain('[object Object]')
})
it('the real PDF engine generates a PDF without mutating screen headers or the next matrix', async () => {
  const result = clone(), before = movementMatrix(result), headers = [...movementHeaders]
  const blob = await movementPdf(result)
  const prefix = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob.slice(0, 5)) })
  expect(prefix).toBe('%PDF-')
  expect(movementHeaders).toEqual(headers)
  expect(movementMatrix(result)).toEqual(before)
}, 20_000)

it('prints a concise business header and keeps capture hashes out of shared files', async () => {
  const result = clone()
  result.Scope.Through = result.Capture!.Through
  result.Capture!.ThroughDayComplete = false
  const before = structuredClone(result), pdf = movementPdfDefinition(result)
  const tableIndex = pdf.content.findIndex(item => 'table' in item)
  expect(tableIndex).toBe(4)
  const text = JSON.stringify(pdf)
  expect(text).toContain(result.Scope.Article)
  expect(text).toContain(result.Scope.From)
  expect(text).toContain('Дані за останній день неповні.')
  expect(pdf.content.slice(tableIndex + 1)).toContainEqual(expect.objectContaining({ text: 'Дані за останній день неповні.' }))
  for (const hidden of [result.Capture!.ManifestSha256, result.ResultSha256!, 'Зріз:', 'Результат:', 'SourceWarehouseReference']) {
    expect(text).not.toContain(hidden)
    expect(movementCsv(result)).not.toContain(hidden)
  }
  const blob = await movementXlsx(result)
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob) })
  const book = XLSX.read(bytes, { type: 'array' })
  expect(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets['Про звіт'], { header: 1 }))).not.toContain(result.ResultSha256)
  expect(result).toEqual(before)
})
