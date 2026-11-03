import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { partialPhysicalCoverage as coverage } from '../../../shared/ui/product-movement-history/physicalCoverage.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(cleanup)
function show(empty: boolean, complete = false) {
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    PhysicalCoverage: [{ ...coverage, ImportedPeriodComplete: complete }],
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: empty ? 0 : 1, ReturnedRows: empty ? 0 : 1, HasMore: false },
    RowSchema: [{ Caption: 'Документ' }], ColumnSchema: [{ Caption: 'Кількість' }],
    Rows: empty ? [] : [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Пізніший документ GBA' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Кількість' }] }],
    Cells: empty ? [] : [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value: { Kind: 'decimal', Value: '5', Provenance: 'producerCell' } }],
  } })
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
}
it.each([true, false])('explains partial imported coverage with empty result=%s without losing native rows', empty => {
  const view = show(empty)
  expect(screen.getByText('Імпортована історія не покриває весь вибраний період').closest('[role="alert"]')?.textContent).toContain('01.01.2025 — 02.11.2026')
  expect(view.container.textContent).not.toMatch(/private-publication|private-receipt|2996/)
  if (!empty) expect(screen.getByText('Пізніший документ GBA')).toBeTruthy()
})
it('does not warn when the imported period is complete', () => {
  show(false, true)
  expect(screen.queryByText('Імпортована історія не покриває весь вибраний період')).toBeNull()
})
