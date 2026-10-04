import { expect, it } from 'vitest'
import { emptySales, missingSales, salesCapability, salesDivision, salesParty, salesProduct, salesProject, salesResponse } from '../testing/originalSalesFixtures'
import { isSalesCapability, normalizeSales, salesDefaults, salesMeasures, salesPeriodError, salesRequest } from './originalSales'
import { salesCsv, salesHeaders, salesMatrix, salesPdfDefinition } from './originalSalesExport'
const selection = () => ({ Counterparties: [], Products: [], Projects: [], Divisions: [] })
const request = () => salesRequest(salesCapability, '2026-09-10', '2026-09-12', selection())
it('own Sales original exposes default two and seven optional resources without price or EUR policy', () => {
  expect(isSalesCapability(salesCapability)).toBe(true); expect(salesCapability.DefaultMeasures).toEqual(salesDefaults); expect(salesMeasures).toHaveLength(9)
  for (const patch of [{ World: 'amg' }, { SourceId: '5543ce7d-61fa-45e2-8b85-5cd40abaccb6' }, { DefaultMeasures: salesDefaults.slice(1) }, { SourceParityVerified: true }, { MoneyPolicy: 'EUR' }]) expect(isSalesCapability({ ...salesCapability, ...patch })).toBe(false)
  expect(request()).not.toHaveProperty('PriceType')
})
it('each canonical selector and inclusive dates are exact with no inferred source reference', () => {
  const r = salesRequest(salesCapability, '2026-09-10', '2026-09-12', { Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  expect(r).toMatchObject({ Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  expect(salesPeriodError('2026-02-30', '2026-03-01')).not.toBeNull(); expect(salesPeriodError('2026-09-10T00:00:00', '2026-09-12')).not.toBeNull()
  expect(() => salesRequest(salesCapability, r.From, r.Through, { ...selection(), Products: ['guessed'] })).toThrow()
})
it('complete empty and missing responses cannot forge any selected filter', () => {
  const q = salesRequest(salesCapability, '2026-09-10', '2026-09-12', { Counterparties: [salesParty], Products: [salesProduct], Projects: [salesProject], Divisions: [salesDivision] })
  for (const base of [salesResponse(), emptySales(), missingSales()]) { const r = { ...base, ...q }; expect(normalizeSales(r, q)).toEqual(r)
    for (const key of ['Counterparties', 'Products', 'Projects', 'Divisions']) expect(() => normalizeSales({ ...r, [key]: [] }, q)).toThrow()
  }
})
it('all nine signed numeric cells use native fixed scale and never nullable prices', () => {
  const q = salesRequest(salesCapability, '2026-09-10', '2026-09-12', selection(), salesMeasures), r = salesResponse([...salesMeasures])
  expect(normalizeSales(r, q).Totals?.['КоличествоЕдиницОтчетов']).toBe('-4.000'); expect(Object.keys(r.Totals!)).toEqual(salesMeasures)
  for (const wrong of [null, '-0.00', '-12', '1e2', '12.000']) expect(() => normalizeSales({ ...r, Totals: { ...r.Totals, 'СтоимостьСНДСОборот': wrong } }, q)).toThrow()
})
it('missing exact unit keys reject partial totals and falsely complete bounded coverage', () => {
  const r = missingSales(); expect(normalizeSales(r, request()).Dependency?.ProductKeys).toEqual([salesProduct])
  expect(() => normalizeSales({ ...r, Totals: emptySales().Totals }, request())).toThrow()
  expect(() => normalizeSales({ ...r, Dependency: { ...r.Dependency, MissingKeyCount: 65, HasMoreKeys: false } }, request())).toThrow()
})
it('unknown human names retain keys signed cells and the shared screen export matrix', () => {
  const r = salesResponse(); r.Rows[0].Products[0].Caption = 'Назва недоступна'; r.Rows[0].Products[0].CaptionAvailable = false; r.Choices['Номенклатура'] = []; r.MissingCaptionMappings = ['Номенклатура']
  expect(normalizeSales(r, request()).Rows[0].Products[0].Product).toBe(salesProduct); expect(salesMatrix(r)[2]).toEqual(['Наш контрагент', 'Назва недоступна', '-12.00', '-5.000'])
})
it('one matrix supplies default and all optional CSV XLSX source and typed PDF payloads', () => {
  for (const r of [salesResponse(), salesResponse([...salesMeasures])]) { const matrix = salesMatrix(r); expect(matrix[0]).toEqual(salesHeaders(r)); expect(matrix[0]).toHaveLength(2 + r.Measures.length)
    expect(salesPdfDefinition(r).content).toContainEqual(expect.objectContaining({ table: expect.objectContaining({ body: matrix, widths: Array(matrix[0].length).fill('*') }) }))
    expect(salesCsv(r)).toContain('"-12.00"'); expect(salesCsv(r)).toContain(r.ResultSha256)
  }
})
it('CSV protects only text captions and retains signed quantities while incomplete export is refused', () => {
  const r = salesResponse(); r.Rows[0].Products[0].Caption = '=unsafe'; expect(salesCsv(r)).toContain(`"'=unsafe"`); expect(salesCsv(r)).toContain('"-5.000"'); expect(() => salesMatrix(missingSales())).toThrow()
})
