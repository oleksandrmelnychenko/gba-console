import { unconfirmedBatch } from '../../../shared/ui/product-movement-history/physicalQuantityExceptions.test-fixtures'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { partialPhysicalCoverage as coverage } from '../../../shared/ui/product-movement-history/physicalCoverage.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(cleanup)
function show(empty: boolean, complete = false, unconfirmed = false) {
  const preview = normalizeNativeReportPreview({ Preview: {
    PhysicalQuantityExceptions: unconfirmed ? [unconfirmedBatch] : [],
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    PhysicalCoverage: [{ ...coverage, ImportedPeriodComplete: complete }],
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: empty ? 0 : 1, ReturnedRows: empty ? 0 : 1, HasMore: false },
    RowSchema: [{ Caption: 'Документ' }], ColumnSchema: [{ Caption: 'Кількість' }],
    Rows: empty ? [] : [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Пізніший документ GBA' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Кількість' }] }],
    Totals: unconfirmed ? { State: 'materialized', Values: [{ RowSourceIndex: -1, ColumnSourceIndex: 3, Value: { Kind: 'null', Value: null, Provenance: 'presentationTotal' } }], Groups: [] } : undefined,
    Cells: empty ? [] : [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value: unconfirmed ? { Kind: 'null', Value: null, Provenance: 'producerCell' } : { Kind: 'decimal', Value: '5', Provenance: 'producerCell' } }],
  } })
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
}
it.each([true, false])('shows one short partial-coverage line with empty result=%s and keeps native rows', empty => {
  const view = show(empty)
  expect(screen.queryByText('Імпортована історія не покриває весь вибраний період')).toBeNull()
  expect(screen.getByText('Рух товару за частину періоду недоступний')).toBeTruthy()
  expect(view.container.textContent).not.toMatch(/private-publication|private-receipt|2996/)
  if (!empty) expect(screen.getByText('Пізніший документ GBA')).toBeTruthy()
})
it('does not warn when the imported period is complete', () => {
  show(false, true)
  expect(screen.queryByText('Імпортована історія не покриває весь вибраний період')).toBeNull()
  expect(screen.queryByText('Рух товару за частину періоду недоступний')).toBeNull()
})

it.each([true, false])('retains the exact batch exception in Preview even with empty rows=%s and complete period', empty => {
  show(empty, true, true)
  expect(screen.getByText('Партію не підтверджено').closest('[role="alert"]')?.textContent).toContain('ВО-00041')
  expect(screen.getByText('Партію не підтверджено').closest('[role="alert"]')?.textContent).toContain('Розхід: 1')
  expect(document.body.textContent).not.toMatch(/unconfirmed_batch|38423019/)
  expect(document.querySelector('tfoot')?.textContent).toContain('—')
  if (!empty) expect(document.querySelector('tbody')?.textContent).toContain('—')
})
