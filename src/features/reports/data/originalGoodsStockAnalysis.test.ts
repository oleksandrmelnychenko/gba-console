import { expect, it } from 'vitest'
import { emptyGoodsAnalysis, goodsAnalysisCapability, goodsAnalysisResponse, goodsProduct, goodsWarehouse, missingGoodsAnalysis } from '../testing/originalGoodsStockAnalysisFixtures'
import { isGoodsAnalysisCapability, goodsAnalysisRequest, normalizeGoodsAnalysis } from './originalGoodsStockAnalysis'
import { goodsAnalysisCsv, goodsAnalysisMatrix, goodsAnalysisPdfDefinition, goodsAnalysisXlsx } from './originalGoodsStockAnalysisExport'
const request = () => goodsAnalysisRequest(goodsAnalysisCapability, '2026-09-10', '2026-09-12')
it('keeps both signed quantity strings identical across screen, CSV, XLSX and PDF', async () => {
  const result = normalizeGoodsAnalysis(goodsAnalysisResponse(), request()), matrix = goodsAnalysisMatrix(result)
  expect(matrix[2]).toEqual(['Наш склад', 'Наш товар', '-5.000', '-4.000'])
  expect(goodsAnalysisCsv(result)).toContain('"-5.000","-4.000"')
  const definition = goodsAnalysisPdfDefinition(result)
  expect(definition.content.find(item => 'table' in item)?.table.body).toEqual(matrix)
  const blob = await goodsAnalysisXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Залишки'], { header: 1 })).toEqual(matrix)
})
it('complete empty and missing parents remain distinct; missing parents cannot be exported as zero balances', () => {
  expect(normalizeGoodsAnalysis(emptyGoodsAnalysis(), request()).Available).toBe(true)
  const missing = normalizeGoodsAnalysis(missingGoodsAnalysis(), request())
  expect(missing.Totals).toBeNull(); expect(() => goodsAnalysisMatrix(missing)).toThrow()
  expect(() => normalizeGoodsAnalysis({ ...missing, Totals: emptyGoodsAnalysis().Totals }, request())).toThrow()
})
it('rejects an inconsistent warehouse subtotal or grand total instead of showing partial amounts', () => {
  const subtotal = goodsAnalysisResponse(); subtotal.Rows[0].Values.КоличествоНачальныйОстаток = '99.000'
  expect(() => normalizeGoodsAnalysis(subtotal, request())).toThrow()
  const total = goodsAnalysisResponse(); total.Totals!.КоличествоКонечныйОстаток = '-5.000'
  expect(() => normalizeGoodsAnalysis(total, request())).toThrow()
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'From', 'Through', 'OpeningRowPolicy', 'AntiSalesPolicy', 'SourceParityVerified'])(
  'rejects a changed original scope or unsupported policy %s', field => {
    expect(() => normalizeGoodsAnalysis({ ...goodsAnalysisResponse(), [field]: 'foreign' }, request())).toThrow()
  })
it('exact filter echo cannot include a foreign warehouse or product', () => {
  const selected = goodsAnalysisRequest(goodsAnalysisCapability, '2026-09-10', '2026-09-12', [goodsWarehouse], [goodsProduct])
  expect(() => normalizeGoodsAnalysis(goodsAnalysisResponse(), selected)).toThrow()
  const response = { ...goodsAnalysisResponse(), ...selected }
  expect(normalizeGoodsAnalysis(response, selected).Available).toBe(true)
  response.Rows[0].Products[0].Product = 'F'.repeat(32)
  expect(() => normalizeGoodsAnalysis(response, selected)).toThrow()
})
it('capability excludes Buyer filtering and the request detaches validated selectors', () => {
  expect(isGoodsAnalysisCapability(goodsAnalysisCapability)).toBe(true)
  expect(isGoodsAnalysisCapability({ ...goodsAnalysisCapability, Filters: ['Склад', 'Номенклатура', 'Покупатель'] })).toBe(false)
  const keys = [goodsProduct], selected = goodsAnalysisRequest(goodsAnalysisCapability, '2026-09-10', '2026-09-12', [], keys)
  keys[0] = 'F'.repeat(32); expect(selected.Products).toEqual([goodsProduct]); expect(selected).not.toHaveProperty('Buyers')
  expect(() => goodsAnalysisRequest(goodsAnalysisCapability, '2026-09-10', '2026-09-12', [], [goodsProduct, goodsProduct])).toThrow()
})
it('protects formula-like human captions without altering signed numeric resources', () => {
  const result = goodsAnalysisResponse(); result.Rows[0].Caption = '=SUM(A1)'; result.Rows[0].Products[0].Caption = '@product'
  const csv = goodsAnalysisCsv(normalizeGoodsAnalysis(result, request()))
  expect(csv).toContain('"\'=SUM(A1)","\'@product","-5.000"')
})
it.each(['-0.000', '5', '1e3', '01.000'])('rejects noncanonical quantity %s', value => {
  const result = goodsAnalysisResponse(); result.Rows[0].Products[0].Values.КоличествоНачальныйОстаток = value
  expect(() => normalizeGoodsAnalysis(result, request())).toThrow()
})

it('preserves quantities beyond Number precision through validation and every export matrix', async () => {
  const response = goodsAnalysisResponse(), exact = '9007199254740993.123'
  response.Rows[0].Products[0].Values.КоличествоНачальныйОстаток = exact
  response.Rows[0].Values.КоличествоНачальныйОстаток = exact
  response.Totals!.КоличествоНачальныйОстаток = exact
  const result = normalizeGoodsAnalysis(response, request()), matrix = goodsAnalysisMatrix(result)
  expect(matrix[2][2]).toBe(exact)
  expect(goodsAnalysisCsv(result)).toContain(`"${exact}"`)
  const XLSX = await import('xlsx'), blob = await goodsAnalysisXlsx(result)
  const book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Залишки'], { header: 1 })).toEqual(matrix)
})
it('refuses a stale or missing complete snapshot witness before display or export', () => {
  for (const changed of [{ OurSnapshotVerified: false }, { NormalInputsComplete: false }, { InputWitnessSha256: null }, { ResultSha256: '0'.repeat(64) }])
    expect(() => normalizeGoodsAnalysis({ ...goodsAnalysisResponse(), ...changed }, request())).toThrow()
})
