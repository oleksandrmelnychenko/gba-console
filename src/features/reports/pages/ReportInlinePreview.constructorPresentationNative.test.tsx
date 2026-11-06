import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ownPresentationPreview, ownPresentationSources, presentationCombinations } from '../data/constructorPresentation.native.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(() => { cleanup() })
const cases = ownPresentationSources.flatMap(source => presentationCombinations.map(flags => ({ source, flags })))
it.each(cases)('applies source$source style $flags while all raw cells and totals stay exact', ({ source, flags }) => {
  const wire = ownPresentationPreview(source, flags), before = structuredClone(wire)
  const preview = normalizeNativeReportPreview({ Preview: wire })
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(view.container.querySelector('tfoot') !== null).toBe(flags.grandTotals)
  expect(view.container.querySelectorAll('.is-negative')).toHaveLength(flags.negativeRed ? flags.grandTotals ? 3 : 2 : 0)
  expect(view.container.querySelector('.report-inline-preview__group-total')).toBeTruthy()
  for (const row of view.container.querySelectorAll('tbody tr, tfoot tr'))
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['8,125','-5,125','0,000','∅'])
  expect(preview.Cells).toEqual(before.Cells)
  expect(preview.Totals).toEqual(before.Totals)
  expect(preview.Rows).toEqual(before.Rows)
  expect(preview.Columns).toEqual(before.Columns)
  expect(wire).toEqual(before)
})
it.each(ownPresentationSources)('retains absent source%i inline defaults and leaves absent options omitted', source => {
  const wire = ownPresentationPreview(source)
  const preview = normalizeNativeReportPreview({ Preview: wire })
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(Object.hasOwn(preview, 'constructorPresentation')).toBe(false)
  expect(view.container.querySelector('.is-negative')).toBeNull()
  expect(view.container.querySelector('tfoot')).toBeTruthy()
  expect(preview.Totals).toEqual(wire.Totals)
})
it.each(ownPresentationSources)('preserves legacy absent handling of a nullable source%i preview option', source => {
  const wire = ownPresentationPreview(source, null)
  const preview = normalizeNativeReportPreview({ Preview: wire })
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(preview.constructorPresentation).toBeNull()
  expect(view.container.querySelector('.is-negative')).toBeNull()
  expect(view.container.querySelector('tfoot')).toBeTruthy()
  expect(preview.Totals).toEqual(wire.Totals)
})
it('keeps malformed options and unrelated preview sources rejected', () => {
  for (const source of ownPresentationSources)
    for (const value of [{ version: 2, negativeRed: true, grandTotals: false }, { version: 1, negativeRed: 'true', grandTotals: true },
      { version: 1, negativeRed: true }, { version: 1, negativeRed: false, grandTotals: true, details: true }])
      expect(() => normalizeNativeReportPreview({ Preview: ownPresentationPreview(source, value) })).toThrow()
  for (const source of ['NativeCashPeriod','NativeSettlementPeriod','NativeCurrentVparivanie','NativeSupplierGrossProfit','Operational','nativePurchases','3']) {
    const wire = ownPresentationPreview(3, presentationCombinations[0]);wire.Request.DataSource = source
    expect(() => normalizeNativeReportPreview({ Preview: wire })).toThrow()
  }
})
