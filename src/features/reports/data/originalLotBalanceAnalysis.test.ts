import { expect, it } from 'vitest'
import { emptyLotAnalysis, lotAnalysisCapability, lotAnalysisResponse, lotProduct, lotWarehouse, missingLotAnalysis } from '../testing/originalLotBalanceAnalysisFixtures'
import { isLotAnalysisCapability, lotAnalysisRequest, normalizeLotAnalysis } from './originalLotBalanceAnalysis'
import { lotAnalysisCsv, lotAnalysisMatrix, lotAnalysisPdfDefinition, lotAnalysisXlsx } from './originalLotBalanceAnalysisExport'
const request = () => lotAnalysisRequest(lotAnalysisCapability, '2026-09-10', '2026-09-12')
it('keeps all four signed quantities and gross cost strings identical across screen, CSV, XLSX and PDF', async () => {
  const result = normalizeLotAnalysis(lotAnalysisResponse(), request()), matrix = lotAnalysisMatrix(result)
  expect(matrix[2]).toEqual(['Наш склад', 'Наш товар', '-5.000', '-12.00', '-4.000', '-10.00'])
  expect(lotAnalysisCsv(result)).toContain('"-5.000","-12.00","-4.000","-10.00"')
  const definition = lotAnalysisPdfDefinition(result)
  expect(definition.content.find(item => 'table' in item)?.table.body).toEqual(matrix)
  const blob = await lotAnalysisXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Залишки'], { header: 1 })).toEqual(matrix)
})
it('complete empty and missing parents remain distinct; missing parents cannot be exported as zero balances', () => {
  expect(normalizeLotAnalysis(emptyLotAnalysis(), request()).Available).toBe(true)
  const missing = normalizeLotAnalysis(missingLotAnalysis(), request())
  expect(missing.Totals).toBeNull(); expect(() => lotAnalysisMatrix(missing)).toThrow()
  expect(() => normalizeLotAnalysis({ ...missing, Totals: emptyLotAnalysis().Totals }, request())).toThrow()
})
it('rejects an inconsistent warehouse subtotal or grand total instead of showing partial amounts', () => {
  const subtotal = lotAnalysisResponse(); subtotal.Rows[0].Values.СтоимостьНачальныйОстаток = '99.00'
  expect(() => normalizeLotAnalysis(subtotal, request())).toThrow()
  const total = lotAnalysisResponse(); total.Totals!.КоличествоКонечныйОстаток = '-5.000'
  expect(() => normalizeLotAnalysis(total, request())).toThrow()
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'From', 'Through', 'OpeningRowPolicy', 'AntiSalesPolicy', 'SourceParityVerified'])(
  'rejects a changed original scope or unsupported policy %s', field => {
    expect(() => normalizeLotAnalysis({ ...lotAnalysisResponse(), [field]: 'foreign' }, request())).toThrow()
  })
it('exact filter echo cannot include a foreign warehouse or product', () => {
  const selected = lotAnalysisRequest(lotAnalysisCapability, '2026-09-10', '2026-09-12', [lotWarehouse], [lotProduct])
  expect(() => normalizeLotAnalysis(lotAnalysisResponse(), selected)).toThrow()
  const response = { ...lotAnalysisResponse(), ...selected }
  expect(normalizeLotAnalysis(response, selected).Available).toBe(true)
  response.Rows[0].Products[0].Product = 'F'.repeat(32)
  expect(() => normalizeLotAnalysis(response, selected)).toThrow()
})
it('capability excludes Buyer filtering and the request detaches validated selectors', () => {
  expect(isLotAnalysisCapability(lotAnalysisCapability)).toBe(true)
  expect(isLotAnalysisCapability({ ...lotAnalysisCapability, Filters: ['Склад', 'Номенклатура', 'Покупатель'] })).toBe(false)
  const keys = [lotProduct], selected = lotAnalysisRequest(lotAnalysisCapability, '2026-09-10', '2026-09-12', [], keys)
  keys[0] = 'F'.repeat(32); expect(selected.Products).toEqual([lotProduct]); expect(selected.Buyers).toEqual([])
  expect(() => lotAnalysisRequest(lotAnalysisCapability, '2026-09-10', '2026-09-12', [], [lotProduct, lotProduct])).toThrow()
})
it('protects formula-like human captions without altering signed numeric resources', () => {
  const result = lotAnalysisResponse(); result.Rows[0].Caption = '=SUM(A1)'; result.Rows[0].Products[0].Caption = '@product'
  const csv = lotAnalysisCsv(normalizeLotAnalysis(result, request()))
  expect(csv).toContain('"\'=SUM(A1)","\'@product","-5.000"')
})
it.each(['-0.000', '5', '1e3', '01.000'])('rejects noncanonical quantity %s', value => {
  const result = lotAnalysisResponse(); result.Rows[0].Products[0].Values.КоличествоНачальныйОстаток = value
  expect(() => normalizeLotAnalysis(result, request())).toThrow()
})
