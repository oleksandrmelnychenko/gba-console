import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ReportInlinePreview } from './ReportInlinePreview'
import type { NativeReportPreview } from '../data/nativeReportPreview'
const scalar = (Value: string) => ({ Kind: 'decimal', Value, Provenance: 'producerCell' })
it('formats rows and server totals using stable metadata, scaling money only and never adding percentage cells', () => {
  const preview: NativeReportPreview = { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, ReturnedRows: 2, TotalVisibleRows: 2, HasMore: false },
    RowSchema: [{ Caption: 'Постачальник' }], ColumnSchema: [{ Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'А' }] }, { Ordinal: 1, SourceIndex: 1, Values: [{ Caption: 'Б' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Сума' }] }, { Ordinal: 1, SourceIndex: 1, Values: [{ Caption: 'Маржа' }] }],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: scalar('1234.567') }, { RowSourceIndex: 0, ColumnSourceIndex: 1, Value: scalar('12.3456') }, { RowSourceIndex: 1, ColumnSourceIndex: 0, Value: scalar('1000') }, { RowSourceIndex: 1, ColumnSourceIndex: 1, Value: scalar('40') }],
    Totals: { State: 'materialized', Groups: [], Values: [{ RowSourceIndex: -1, ColumnSourceIndex: 0, Value: scalar('2234.567') }, { RowSourceIndex: -1, ColumnSourceIndex: 1, Value: scalar('24.1234') }] },
    numberPresentation: { version: 1, moneyScale: 1000, decimalPlacesByKind: { percent: 3 } },
    valueSemantics: [{ columnSourceIndex: 0, measureType: 2, semantics: { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2, defaultMinimumDecimalPlaces: 2 } }, { columnSourceIndex: 1, measureType: 14, semantics: { kind: 'percent', currencyPolicy: 'notApplicable', unitPolicy: 'percentAlreadyMultipliedBy100', aggregation: 'recomputeFromBase', scalable: false, defaultDecimalPlaces: 2, defaultMinimumDecimalPlaces: 2 } }],
  }
  render(<MantineProvider><ReportInlinePreview preview={preview} /></MantineProvider>)
  expect(screen.getByRole('columnheader', { name: 'Сума, тис.' })).toBeTruthy()
  expect(screen.getByText('1,23')).toBeTruthy()
  expect(screen.getByText('12,346')).toBeTruthy()
  const totals = screen.getByText('Загальний підсумок').closest('tr')!
  expect(within(totals).getByText('2,23')).toBeTruthy()
  expect(within(totals).getByText('24,123')).toBeTruthy()
  expect(within(totals).queryByText('52,346')).toBeNull()
})
