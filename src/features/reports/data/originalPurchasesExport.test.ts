import { expect, it } from 'vitest'
import { normalizePurchases, purchasesMeasures } from './originalPurchases'
import { purchasesCsv, purchasesExportError, purchasesLines, purchasesMatrix, purchasesPdfDefinition, purchasesXlsx } from './originalPurchasesExport'
import { emptyPurchases, missingPurchases, purchasesParty, purchasesProduct, purchasesResponse, purchasesStatus } from '../testing/originalPurchasesFixtures'
import { namedPurchasesResponse, purchasesNamedScope } from '../testing/originalPurchasesNamedFixtures'
it('screen CSV and PDF preserve all four default resources with human ordinals and no technical captions', () => {
  const result = purchasesResponse(), matrix = purchasesMatrix(result), csv = purchasesCsv(result), pdf = purchasesPdfDefinition(result)
  expect(matrix[0]).toEqual(['Статус партії', 'Контрагент', 'Номенклатура', 'Кількість у базових одиницях', 'Вартість', 'ПДВ', 'Вага'])
  expect(purchasesLines(result).map(row => row.cells)).toEqual(matrix.slice(1, -1)); expect(matrix.at(-1)).toEqual(['Разом', '', '', '2.000', '123.46', '24.70', '3.126'])
  expect(csv).toContain('"1.000"'); expect(JSON.stringify(pdf)).toContain('2.000')
  for (const key of [purchasesParty, purchasesProduct, purchasesStatus]) {
    expect(csv).not.toContain(key); expect(JSON.stringify(matrix)).not.toContain(key); expect(JSON.stringify(pdf)).not.toContain(key)
  }
})
it('optional resources keep true server rational subtotal rounding in every format', () => {
  const result = purchasesResponse(purchasesMeasures), matrix = purchasesMatrix(result)
  expect(matrix[0]).toHaveLength(9); expect(matrix[3].slice(3)).toEqual(['1.000', '0.333', '1.000', '61.73', '12.35', '1.563'])
  expect(matrix.at(-1)?.slice(3)).toEqual(['2.000', '0.667', '2.000', '123.46', '24.70', '3.126'])
  expect(purchasesCsv(result)).toContain('"0.667"'); expect(JSON.stringify(purchasesPdfDefinition(result))).toContain('0.667')
})
it('stored-only exports keep negative cost VAT and weight as exact strings in CSV XLSX and PDF', async () => {
  const result = purchasesResponse(['СтоимостьОборот', 'НДСОборот', 'ВесОборот'])
  const values = { СтоимостьОборот: '-9007199254740993.01', НДСОборот: '-12.35', ВесОборот: '-1.563' }
  result.Rows[0].Children[0].Children[0].Values = values
  const matrix = purchasesMatrix(result), csv = purchasesCsv(result), pdf = purchasesPdfDefinition(result)
  expect(matrix[3].slice(3)).toEqual(Object.values(values))
  for (const value of Object.values(values)) { expect(csv).toContain(`"${value}"`); expect(JSON.stringify(pdf)).toContain(value) }
  const blob = await purchasesXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Закупки'], { header: 1 })).toEqual(matrix)
  expect(book.Sheets['Закупки'].D4).toMatchObject({ t: 's', v: values.СтоимостьОборот })
})
it('missing input refuses all exports while genuine complete empty and full cell limits remain explicit', () => {
  expect(purchasesMatrix(emptyPurchases())).toHaveLength(2)
  expect(purchasesExportError(missingPurchases())).not.toBeNull(); expect(() => purchasesCsv(missingPurchases())).toThrow()
  const corrupt = purchasesResponse(); corrupt.Rows[0].Values.КоличествоБазовыхЕд = '2.00'
  expect(() => purchasesMatrix(corrupt)).toThrow()
  const large = purchasesResponse(); large.Rows = Array.from({ length: 100_000 }, () => large.Rows[0])
  expect(purchasesExportError(large)).toContain('1 000 000')
})
it('XLSX uses the same completed matrix and retains wide signed quantities as strings', async () => {
  const result = purchasesResponse(), value = '-9007199254740993.001'
  result.Rows[0].Children[0].Children[0].Values.КоличествоБазовыхЕд = value
  const matrix = purchasesMatrix(result), blob = await purchasesXlsx(result), XLSX = await import('xlsx')
  const book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Закупки'], { header: 1 })).toEqual(matrix)
  expect(book.Sheets['Закупки'].D4.v).toBe(value); expect(book.Sheets['Закупки'].D4.t).toBe('s')
})
it('completed captions survive later wire edits identically on screen CSV XLSX and PDF', async () => {
  const request = purchasesNamedScope(), wire = namedPurchasesResponse(), wide = '-9007199254740993.001'
  wire.Rows[0].Children[0].Children[0].Values.КоличествоБазовыхЕд = wide
  const result = normalizePurchases(wire, request); wire.Rows[0].Children[0].Caption = 'Later caption'; wire.Rows[0].Children[0].Children[0].Caption = 'Later product'
  const matrix = purchasesMatrix(result), csv = purchasesCsv(result), pdf = purchasesPdfDefinition(result)
  expect(matrix[2][1]).toBe('Постачальник'); expect(matrix[3][2]).toBe('Перший товар'); expect(matrix[3][3]).toBe(wide)
  expect(purchasesLines(result).map(row => row.cells)).toEqual(matrix.slice(1, -1))
  expect(csv).toContain('Постачальник'); expect(csv).toContain(wide); expect(JSON.stringify(pdf)).toContain('Перший товар')
  for (const value of ['Later caption', 'Later product', purchasesParty, purchasesProduct]) { expect(csv).not.toContain(value); expect(JSON.stringify(pdf)).not.toContain(value) }
  const blob = await purchasesXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Закупки'], { header: 1 })).toEqual(matrix)
})
it('formula-like human captions are escaped only as CSV text and never change signed quantities', () => {
  const result = namedPurchasesResponse(); result.Rows[0].Children[0].Caption = '=SUM(A1)'; result.Rows[0].Values.КоличествоБазовыхЕд = '-2.000'
  expect(purchasesCsv(result)).toContain('"\'=SUM(A1)"'); expect(purchasesCsv(result)).toContain('"-2.000"')
  expect(purchasesMatrix(result)[2][1]).toBe('=SUM(A1)')
})
