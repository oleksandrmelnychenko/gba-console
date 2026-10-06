import { expect, it } from 'vitest'
import { orderAnalysisSheet, orderAnalysisGroupCaption } from './originalOrderAnalysesExport'
import { orderNumberFixture, orderResultFixture } from './originalOrderAnalyses.fixtures'
import { defaultSheetCsv } from './originalDefaultReportExport'
it('server root and each subtotal remain separate with no front-end resumming', () => {
  const result = orderResultFixture(), base = result.Groups[0], key = [{ Field: 1 as const, Value: '::' + 'C'.repeat(32) }]
  result.Groups.push({ ...base, Key: key, Measures: Object.fromEntries(result.Request.Measures.map(name => [name, orderNumberFixture('3')])) })
  const sheet = orderAnalysisSheet(result)
  expect(sheet.lines).toHaveLength(2); expect(sheet.total).toBeNull(); expect(sheet.lines[0].cells).toContain('10'); expect(sheet.lines[1].cells).toContain('3')
  expect(sheet.lines[0].cells).not.toContain('13'); expect(sheet.lines[1].subtotal).toBe(true)
})
it('typed named caption is used while an unmapped native key is never displayed as a raw identifier', () => {
  const result = orderResultFixture(), ref = result.Choices[0].Value.Reference
  expect(orderAnalysisGroupCaption(4, ref, result.Choices)).toBe('Наш товар')
  expect(orderAnalysisGroupCaption(4, 'B'.repeat(32), result.Choices)).toBe('Назва недоступна')
  expect(orderAnalysisGroupCaption(2, null, result.Choices)).toBe('Немає значення')
})
it('CSV retains exact large fraction unavailable null and numeric status zero without coercion', () => {
  const result = orderResultFixture(), names = result.Request.Measures, group = result.Groups[0]
  group.Measures[names[0]] = { Observed: true, Value: { Numerator: '900719925474099298', Denominator: '100' } }; group.Measures[names[1]] = { Observed: false, Value: null }; group.Measures[names[2]] = { Observed: true, Value: null }
  const csv = defaultSheetCsv(orderAnalysisSheet(result))
  expect(csv).toContain('9007199254740992.98'); expect(csv).toContain('Недоступно'); expect(csv).toContain('Немає значення'); expect(csv).toContain('"0"')
})
