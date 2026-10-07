import { expect, it } from 'vitest'
import { createCashMovementRequest, isCashMovementCapabilities, normalizeCashMovementReport } from './cashMovement'
import { createCashMovementArticleChoicesRequest, normalizeCashMovementArticleChoices } from './cashMovementArticleChoices'
import { CASH_MOVEMENT_TEST_ARTICLE, cashMovementArticleChoices, cashMovementCapability, cashMovementEmptyReport, cashMovementFilteredReport, cashMovementReport } from './cashMovement.test-fixtures'

it.each(['receipts', 'payouts'] as const)('binds %s choices to the exact form and its own period without a native reference', kind => {
  const capability = cashMovementCapability(kind), page = cashMovementArticleChoices(kind)
  expect(isCashMovementCapabilities(capability)).toBe(true)
  expect(capability.Filters).toEqual([kind === 'receipts' ? 'Quarter' : 'Month', 'CashFlowArticle'])
  const request = createCashMovementArticleChoicesRequest(capability, page.Period)
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Period', 'ContinuationKey'])
  expect(normalizeCashMovementArticleChoices(page, request)).toBe(page)
  expect(createCashMovementRequest(capability, page.Period, CASH_MOVEMENT_TEST_ARTICLE)).toEqual({
    Version: 1, SourceIdentity: capability.SourceIdentity, Period: page.Period, ArticleChoiceKey: CASH_MOVEMENT_TEST_ARTICLE,
  })
})
it('keeps unfiltered request bytes unchanged and forbids a filtered result on an unfiltered submission', () => {
  const request = createCashMovementRequest(cashMovementCapability(), '2026-Q3', null)
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Period'])
  expect(normalizeCashMovementReport(cashMovementReport(), request).ArticleFilter).toBeUndefined()
  expect(() => normalizeCashMovementReport(cashMovementFilteredReport(), request)).toThrow('некоректний результат')
})
it('requires a bound caption/hash for a selected report while preserving server decimal strings', () => {
  const request = createCashMovementRequest(cashMovementCapability(), '2026-Q3', CASH_MOVEMENT_TEST_ARTICLE)
  const report = cashMovementFilteredReport()
  expect(normalizeCashMovementReport(report, request)).toBe(report)
  expect(report.ArticleFilter?.Caption).toBe(' Надходження від покупців ')
  expect(report.Totals[2].FormattedValue).toBe('33.33')
  expect(() => normalizeCashMovementReport(cashMovementReport(), request)).toThrow('некоректний результат')
  report.ArticleFilter!.BindingSha256 = 'bad'
  expect(() => normalizeCashMovementReport(report, request)).toThrow('некоректний результат')
})
it('accepts genuine filtered empty NULL cells without inventing zero values or treating them as missing sync', () => {
  const report = { ...cashMovementEmptyReport(), ArticleFilter: cashMovementFilteredReport().ArticleFilter }
  const request = createCashMovementRequest(cashMovementCapability(), report.Period, CASH_MOVEMENT_TEST_ARTICLE)
  expect(normalizeCashMovementReport(report, request)).toBe(report)
  expect(report.Complete).toBe(true); expect(report.HasRows).toBe(false)
  expect(report.Totals.map(cell => cell.Value)).toEqual([null, null, null, null])
})
it.each(['implementation', 'availability', 'missing-filter', 'still-unsupported'])('refuses an inconsistent %s capability', reason => {
  const capability = cashMovementCapability()
  const bad = reason === 'implementation' ? { ...capability, ArticleChoiceApiImplemented: false }
    : reason === 'availability' ? { ...capability, ArticleChoiceAvailability: 'Ready' }
      : reason === 'missing-filter' ? { ...capability, Filters: ['Quarter'] }
        : { ...capability, UnsupportedFilters: [...capability.UnsupportedFilters, 'CashFlowArticle'] }
  expect(isCashMovementCapabilities(bad)).toBe(false)
})
it.each(['', ' ', ' x', 'x ', 'x\n', 'x\u007f', 'x'.repeat(4097)])('rejects malformed opaque choice %j before preview or paging', key => {
  expect(() => createCashMovementRequest(cashMovementCapability(), '2026-Q3', key)).toThrow()
  expect(() => createCashMovementArticleChoicesRequest(cashMovementCapability(), '2026-Q3', key)).toThrow()
})
it.each(['', ' ', '\u0085', '\ud800', '\udfff', 'x'.repeat(101)])('rejects an unselectable caption %j without inventing a name', caption => {
  const page = cashMovementArticleChoices(); page.Choices[0].Caption = caption
  expect(() => normalizeCashMovementArticleChoices(page, createCashMovementArticleChoicesRequest(cashMovementCapability(), page.Period))).toThrow('непідтверджений список')
})
it('preserves lossless whitespace, surrogate pairs and duplicate captions with distinct genuine keys', () => {
  const page = cashMovementArticleChoices(); page.Choices[0].Caption = '  Стаття 😀  '
  page.Choices.push({ Key: 'another-protected-choice', Caption: page.Choices[0].Caption })
  expect(normalizeCashMovementArticleChoices(page, createCashMovementArticleChoicesRequest(cashMovementCapability(), page.Period)).Choices).toEqual(page.Choices)
})
it('accepts a bounded full page and an empty page with a genuine continuation', () => {
  const page = cashMovementArticleChoices(), command = createCashMovementArticleChoicesRequest(cashMovementCapability(), page.Period)
  page.Choices = Array.from({ length: 256 }, (_, index) => ({ Key: `protected-${index}`, Caption: 'Стаття' }))
  expect(normalizeCashMovementArticleChoices(page, command).Choices).toHaveLength(256)
  page.Choices.push({ Key: 'overflow', Caption: 'Стаття' }); expect(() => normalizeCashMovementArticleChoices(page, command)).toThrow()
  page.Choices = []; page.ContinuationKey = 'protected-next'
  expect(normalizeCashMovementArticleChoices(page, command).ContinuationKey).toBe('protected-next')
})
it('keeps missing normal identity distinct from a genuine empty catalogue', () => {
  const page = cashMovementArticleChoices(), command = createCashMovementArticleChoicesRequest(cashMovementCapability(), page.Period)
  page.Available = false; page.Code = 'cash_article_normal_identity_unavailable'; page.Choices = []
  expect(normalizeCashMovementArticleChoices(page, command).Available).toBe(false)
  page.Available = true; page.Code = 'available'
  expect(normalizeCashMovementArticleChoices(page, command).Choices).toEqual([])
})
it.each(['form', 'period', 'extra', 'duplicate', 'pending-rows', 'pending-next', 'native', 'parity'])('refuses %s choice evidence', reason => {
  const page = cashMovementArticleChoices(), command = createCashMovementArticleChoicesRequest(cashMovementCapability(), page.Period)
  let bad: unknown = page
  if (reason === 'form') bad = cashMovementArticleChoices('payouts')
  if (reason === 'period') page.Period = '2026-Q2'
  if (reason === 'extra') bad = { ...page, NativeReference: 'forbidden' }
  if (reason === 'duplicate') page.Choices.push(page.Choices[0])
  if (reason === 'pending-rows') page.Available = false
  if (reason === 'pending-next') { page.Available = false; page.Choices = []; page.ContinuationKey = 'next' }
  if (reason === 'native') bad = { ...page, NativeChoiceVisibilityVerified: true }
  if (reason === 'parity') bad = { ...page, SourceParityVerified: true }
  expect(() => normalizeCashMovementArticleChoices(bad, command)).toThrow('непідтверджений список')
})
