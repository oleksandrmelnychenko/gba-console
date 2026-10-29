import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview, type NativeReportPreview } from '../data/nativeReportPreview'
import type { ReportRequestBody } from '../types'
import { ReportPreviewPages } from './ReportPreviewPages'
import { useAppliedReportSettings } from '../hooks/useAppliedReportSettings'

const explanation = 'Кількість не підтверджена для вибраних рядків.'
const request = (profile?: string): ReportRequestBody => ({ dataSource: 2, from: '2026-10-19', to: '2026-10-27',
  ...(profile ? { reportProfile: profile } : {}), sorted: { Row: [], Col: [], Measurements: [] }, selections: [] })
const missing = { Kind: 'null', Value: null, Provenance: 'producerCell' }
function preview(source = 'NativeSalesNet', quantity: unknown = missing): NativeReportPreview {
  return normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true, PeriodFrom: '19.10.2026', PeriodTo: '27.10.2026',
      RowGroupings: ['Товар'], ColumnGroupings: [], Measures: ['Перейменований показник', 'Кількість'], Filters: [], IgnoredFilters: [], Notes: ['Службова примітка не для показу'] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Товар' }], ColumnSchema: [{ Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Товар А' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 5, Values: [{ Caption: 'Перейменований показник' }] },
      { Ordinal: 1, SourceIndex: 6, Values: [{ Caption: 'Кількість' }] }],
    Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 5, Value: quantity }, { RowSourceIndex: 1, ColumnSourceIndex: 6, Value: missing }],
    Totals: { State: 'materialized', Values: [{ RowSourceIndex: -1, ColumnSourceIndex: 5, Value: quantity }, { RowSourceIndex: -1, ColumnSourceIndex: 6, Value: missing }],
      Groups: [{ Level: 0, RowSourceIndex: 1, RowCount: 1, Values: [{ RowSourceIndex: 1, ColumnSourceIndex: 5, Value: quantity }, { RowSourceIndex: 1, ColumnSourceIndex: 6, Value: missing }] }] },
    valueSemantics: [{ columnSourceIndex: 5, measureType: 0, semantics: { kind: 'quantity', currencyPolicy: 'notApplicable', unitPolicy: 'confirmedCompatibleUnit', aggregation: 'sumWithinCompatibleUnit', scalable: false, defaultDecimalPlaces: 3 } },
      { columnSourceIndex: 6, measureType: 2, semantics: { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 } }],
  } })
}
function show(value: NativeReportPreview, body: ReportRequestBody) {
  return render(<MantineProvider env="test"><ReportPreviewPages initial={value} request={body} /></MantineProvider>)
}

it.each(['sales', 'grossProfit'])('explains unknown quantity in %s leaf and totals by measure ID, retaining money unknowns', profile => {
  const view = show(preview(), request(profile))
  const quantities = screen.getAllByRole('cell', { description: explanation })
  expect(quantities).toHaveLength(3)
  for (const cell of quantities) { expect(cell.textContent).toBe('∅'); expect(cell.title).toBe(explanation) }
  expect(view.container.querySelector('tbody tr:not(.report-inline-preview__group-total) td:last-child')?.getAttribute('title')).toBe('Значення не визначено.')
  expect(view.container.textContent).not.toContain('Службова примітка')
  expect(view.container.textContent).not.toContain(explanation)
})

it.each([
  { profile: undefined, source: 'NativeSalesNet', dataSource: 2 },
  { profile: 'sales', source: 'NativePurchases', dataSource: 3 },
  { profile: 'grossProfit', source: 'NativeSalesNet', dataSource: 3 },
  { profile: 'invalid', source: 'NativeSalesNet', dataSource: 2 },
])('does not reinterpret legacy or mismatched profile/source $profile/$source/$dataSource', ({ profile, source, dataSource }) => {
  show(preview(source), { ...request(profile), dataSource })
  expect(screen.queryByRole('cell', { description: explanation })).toBeNull()
})

it('does not infer quantity from captions when value semantics is absent', () => {
  const value = preview(); delete value.valueSemantics
  show(value, request('sales'))
  expect(screen.queryByRole('cell', { description: explanation })).toBeNull()
})

it('preserves confirmed zero quantity without an unavailable explanation', () => {
  show(preview('NativeSalesNet', { Kind: 'decimal', Value: '0', Provenance: 'producerCell' }), request('sales'))
  expect(screen.queryByRole('cell', { description: explanation })).toBeNull()
  expect(screen.getAllByRole('cell', { name: '0' })).toHaveLength(3)
})

it('keeps the applied result profile while a different draft profile is edited', () => {
  const value = preview()
  function AppliedResult() {
    const [draft, setDraft] = useState(request('sales'))
    const settings = useAppliedReportSettings('same-workspace', { name: '', data: draft, measurements: [], activeTemplate: null, previousPeriod: { from: draft.from, to: draft.to } }, draft)
    return <><button onClick={() => settings.apply()}>Застосувати</button><button onClick={() => setDraft(request())}>Змінити чернетку</button>
      <output>{draft.reportProfile === undefined ? 'Чернетка без профілю' : 'Чернетка продажів'}</output>
      <ReportPreviewPages initial={value} request={settings.appliedRequest ?? draft} /></>
  }
  render(<MantineProvider env="test"><AppliedResult /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
  fireEvent.click(screen.getByRole('button', { name: 'Змінити чернетку' }))
  expect(screen.getByText('Чернетка без профілю')).toBeTruthy()
  expect(screen.getAllByRole('cell', { description: explanation })).toHaveLength(3)
})
