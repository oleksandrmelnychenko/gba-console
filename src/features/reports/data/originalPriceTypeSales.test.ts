import { expect, it } from 'vitest'
import { emptySales, missingSales, salesCapability, salesDivision, salesParty, salesProduct, salesProject, salesResponse, salesType } from '../testing/priceTypeSalesFixtures'
import { isPriceSalesCapability, normalizePriceSales, priceSalesDefaults, priceSalesMeasures, priceSalesPeriodError, priceSalesRequest } from './originalPriceTypeSales'
import { priceSalesCsv, priceSalesHeaders, priceSalesMatrix, priceSalesPdfDefinition } from './originalPriceTypeSalesExport'
const selection = () => ({ Counterparties: [], Products: [], Projects: [], Divisions: [] })
const request = () => priceSalesRequest(salesCapability, '2026-09-10', '2026-09-12', salesType, selection())
it('exact own original exposes four defaults seven optional resources and the deliberate no-day price join', () => {
  expect(isPriceSalesCapability(salesCapability)).toBe(true); expect(salesCapability.DefaultMeasures).toEqual(priceSalesDefaults); expect(salesCapability.Measures).toHaveLength(11)
  for (const patch of [{ World: 'amg' }, { DefaultMeasures: priceSalesDefaults.slice(1) }, { PriceSelection: 'latest-as-of-each-recorder' }, { SourceParityVerified: true }]) expect(isPriceSalesCapability({ ...salesCapability, ...patch })).toBe(false)
})
it('all four canonical typed selectors and inclusive whole-day dates are preserved without FX or inferred source refs', () => {
  const r = priceSalesRequest(salesCapability, '2026-09-10', '2026-09-12', salesType, { Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  expect(r).toMatchObject({ Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  expect(() => priceSalesRequest(salesCapability, r.From, r.Through, '0'.repeat(32), selection())).toThrow()
  expect(priceSalesPeriodError('2026-02-30', '2026-03-01')).not.toBeNull(); expect(priceSalesPeriodError('2026-09-10T00:00:00', '2026-09-12')).not.toBeNull()
})
it('complete empty and missing responses must echo each selected filter and selected price type exactly', () => {
  const q = priceSalesRequest(salesCapability, '2026-09-10', '2026-09-12', salesType, { Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  for (const base of [salesResponse(), emptySales(), missingSales()]) {
    const r = { ...base, ...q }; expect(normalizePriceSales(r, q)).toEqual(r)
    for (const key of ['Counterparties', 'Products', 'Projects', 'Divisions']) expect(() => normalizePriceSales({ ...r, [key]: [] }, q)).toThrow()
    expect(() => normalizePriceSales({ ...r, PriceType: 'F'.repeat(32) }, q)).toThrow()
  }
})
it('signed default values and nullable missing prices remain exact and are never silently converted to zero', () => {
  const r = salesResponse(); r.Rows[0].Products[0].Values['СтоимостьПоТипуЦен'] = null
  expect(normalizePriceSales(r, request()).Rows[0].Products[0].Values['СтоимостьПоТипуЦен']).toBeNull()
  for (const wrong of ['-0.00', '-12', '1e2', '12.000']) expect(() => normalizePriceSales({ ...r, Totals: { ...r.Totals, 'СтоимостьСНДСОборот': wrong } }, request())).toThrow()
})
it('selected optional measures retain all eleven original cells and independent native final rounding', () => {
  const q = priceSalesRequest(salesCapability, '2026-09-10', '2026-09-12', salesType, selection(), priceSalesMeasures), r = salesResponse([...priceSalesMeasures])
  expect(normalizePriceSales(r, q).Totals?.['КоличествоЕдиницОтчетов']).toBe('-4.000'); expect(Object.keys(r.Totals!)).toEqual(priceSalesMeasures)
  expect(() => normalizePriceSales({ ...r, Measures: priceSalesDefaults }, q)).toThrow()
})
it('exact missing-key dependency uses real server names and rejects partial amounts or unbounded pretend coverage', () => {
  const r = missingSales(); expect(normalizePriceSales(r, request()).Dependency).toMatchObject({ ProductKeys: [salesProduct], MissingKeyCount: 1, HasMoreKeys: false })
  expect(() => normalizePriceSales({ ...r, Totals: emptySales().Totals }, request())).toThrow()
  expect(() => normalizePriceSales({ ...r, Dependency: { ...r.Dependency, MissingKeyCount: 100, HasMoreKeys: false } }, request())).toThrow()
})
it('unknown current human captions preserve their typed row key and signed default amounts in the common output matrix', () => {
  const r = salesResponse(); r.Rows[0].Products[0].Caption = 'Назва недоступна'; r.Rows[0].Products[0].CaptionAvailable = false; r.Choices['Номенклатура'] = []; r.MissingCaptionMappings = ['Номенклатура']
  expect(normalizePriceSales(r, request()).Rows[0].Products[0].Product).toBe(salesProduct); expect(priceSalesMatrix(r)[2]).toEqual(['Наш контрагент', 'Назва недоступна', '-12.00', '-8.00', '-4.00', '-5.000'])
})
it('one complete matrix feeds screen CSV XLSX source and PDF with default four and all seven optional cells', () => {
  for (const r of [salesResponse(), salesResponse([...priceSalesMeasures])]) {
    const matrix = priceSalesMatrix(r); expect(matrix[0]).toEqual(priceSalesHeaders(r)); expect(matrix[0]).toHaveLength(2 + r.Measures.length)
    expect(priceSalesPdfDefinition(r).content).toContainEqual(expect.objectContaining({ table: expect.objectContaining({ body: matrix, widths: Array(matrix[0].length).fill('*') }) }))
    expect(priceSalesCsv(r)).toContain('"-12.00"'); expect(priceSalesCsv(r)).toContain(r.ResultSha256)
  }
})
it('CSV protects formula-like human captions while every signed resource remains native text', () => {
  const r = salesResponse(); r.Rows[0].Products[0].Caption = '=unsafe'; expect(priceSalesCsv(r)).toContain(`"'=unsafe"`); expect(priceSalesCsv(r)).toContain('"-5.000"')
  expect(() => priceSalesMatrix(missingSales())).toThrow()
})
