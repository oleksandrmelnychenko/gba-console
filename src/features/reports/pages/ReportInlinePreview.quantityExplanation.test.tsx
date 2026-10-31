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

const comparisonExplanation = 'Без підтвердженої одиниці документа кількість та її відхилення не визначено.'
const comparisonRequest = (): ReportRequestBody => ({ ...request(), dataSource: 44,
  customerGroups: { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [1] }, { Name: 'Другий', ClientIds: [2] }] } })
function customerPreview(measure = 109, value: unknown = missing) {
  const result = preview('NativeCustomerGroupComparison', value)
  result.valueSemantics![0].measureType = measure
  return result
}

it.each([109, 110])('explains source44 measure%i null in leaf and totals without exposing server notes', measure => {
  const view = show(customerPreview(measure), comparisonRequest())
  const cells = screen.getAllByRole('cell', { description: comparisonExplanation })
  expect(cells).toHaveLength(3)
  for (const cell of cells) { expect(cell.textContent).toBe('∅'); expect(cell.title).toBe(comparisonExplanation) }
  expect(view.container.textContent).not.toContain('Службова примітка')
  expect(view.container.textContent).not.toContain(comparisonExplanation)
})

it.each([111, 112, 113, 114])('does not attribute source44 measure%i null to a missing document unit', measure => {
  show(customerPreview(measure), comparisonRequest())
  expect(screen.queryByRole('cell', { description: comparisonExplanation })).toBeNull()
  expect(screen.getAllByRole('cell', { name: '∅' })).toHaveLength(6)
})

it('keeps source44 known empty-set zero as zero and does not infer a reason from a translated caption', () => {
  const value = customerPreview(109, { Kind: 'decimal', Value: '0', Provenance: 'producerCell' })
  const view = show(value, comparisonRequest())
  expect(screen.queryByRole('cell', { description: comparisonExplanation })).toBeNull()
  expect(screen.getAllByRole('cell', { name: '0' })).toHaveLength(3)
  view.unmount()
  const unknown = customerPreview(); delete unknown.valueSemantics
  show(unknown, comparisonRequest())
  expect(screen.queryByRole('cell', { description: comparisonExplanation })).toBeNull()
})

it('keeps the rendered source44 explanation when a different report is edited but not generated', () => {
  const value = customerPreview()
  function AppliedComparison() {
    const [draft, setDraft] = useState(comparisonRequest())
    const settings = useAppliedReportSettings('comparison-workspace', { name: '', data: draft, measurements: [], activeTemplate: null,
      previousPeriod: { from: draft.from, to: draft.to } }, draft)
    return <><button onClick={() => settings.apply()}>Застосувати</button><button onClick={() => setDraft(request('sales'))}>Чернетка продажів</button>
      <output>{draft.dataSource}</output><ReportPreviewPages initial={value} request={settings.appliedRequest ?? draft} /></>
  }
  render(<MantineProvider env="test"><AppliedComparison /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
  fireEvent.click(screen.getByRole('button', { name: 'Чернетка продажів' }))
  expect(screen.getByRole('status').textContent).toBe('2')
  expect(screen.getAllByRole('cell', { description: comparisonExplanation })).toHaveLength(3)
})


const historicalUnitReason = 'Кількість не визначено без підтвердженої історичної одиниці виміру документа.'
const priceRequest = (): ReportRequestBody => ({ ...request(), dataSource: 46 })
it('explains source46 unknown quantity in leaf, subtotal and grand without attributing money or showing raw notes', () => {
  const view = show(preview('NativePriceComparison'), priceRequest())
  const quantities = screen.getAllByRole('cell', { description: historicalUnitReason })
  expect(quantities).toHaveLength(3)
  for (const cell of quantities) { expect(cell.textContent).toBe('∅'); expect(cell.title).toBe(historicalUnitReason) }
  expect(view.container.querySelector('tbody tr:not(.report-inline-preview__group-total) td:last-child')?.getAttribute('title')).toBe('Значення не визначено.')
  expect(view.container.querySelectorAll('td[aria-description]')).toHaveLength(3)
  expect(view.container.textContent).not.toContain(historicalUnitReason)
  expect(view.container.textContent).not.toContain('Службова примітка')
})
it('preserves a supplied source46 quantity zero without a missing-unit tooltip or changing monetary unknowns', () => {
  show(preview('NativePriceComparison', { Kind: 'decimal', Value: '0', Provenance: 'producerCell' }), priceRequest())
  expect(screen.queryByRole('cell', { description: historicalUnitReason })).toBeNull()
  expect(screen.getAllByRole('cell', { name: '0' })).toHaveLength(3)
  expect(screen.getAllByRole('cell', { name: '∅' })).toHaveLength(3)
})
it('keeps legacy source46 quantity without typed semantics as generic unknown', () => {
  const value = preview('NativePriceComparison'); delete value.valueSemantics
  show(value, priceRequest())
  expect(screen.queryByRole('cell', { description: historicalUnitReason })).toBeNull()
  expect(screen.getAllByRole('cell', { name: '∅' })).toHaveLength(6)
})
it('uses rendered source attribution rather than a source46 draft to explain quantity', () => {
  show(preview('NativePurchases'), priceRequest())
  expect(screen.queryByRole('cell', { description: historicalUnitReason })).toBeNull()
  expect(screen.getAllByRole('cell', { name: '∅' })).toHaveLength(6)
})
