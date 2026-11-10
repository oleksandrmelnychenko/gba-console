import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportPreviewPages } from './ReportPreviewPages'
import type { ReportRequestBody } from '../types'

const request: ReportRequestBody = { dataSource: 2, reportProfile: 'sales', from: '2026-11-01', to: '2026-11-08',
  sorted: { Row: [], Col: [], Measurements: [] }, selections: [] }
const scalar = (value: string | null) => ({ Kind: value === null ? 'null' : 'decimal', Value: value, Provenance: 'producerCell' })
const names = ['Кількість з урахуванням повернень', 'Продажі без ПДВ з урахуванням повернень', 'Собівартість без ПДВ', 'Націнка без ПДВ', 'Рентабельність без ПДВ, %']

function show(quantity: string | null) {
  const values = [quantity, '14990.61', '11954.96', '3035.65', '25.39']
  const cells = (row: number) => values.map((value, column) => ({ RowSourceIndex: row, ColumnSourceIndex: column, Value: scalar(value) }))
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeSalesNet', IsCurrentSnapshot: false, HasPeriod: true, PeriodFrom: '01.11.2026', PeriodTo: '08.11.2026',
      RowGroupings: ['Організація', 'Провів документ'], ColumnGroupings: ['Ввів документ'], Measures: names, Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 2, ReturnedRows: 2, HasMore: false },
    RowSchema: [{ Caption: 'Організація' }, { Caption: 'Провів документ' }], ColumnSchema: [{ Caption: 'Ввів документ' }, { Caption: 'Показник' }],
    Rows: ['Баранов Віталій', 'Грель Христина'].map((name, index) => ({ Ordinal: index, SourceIndex: index,
      Values: [{ Caption: 'ТОВ «АМГ «КОНКОРД»' }, { Caption: name }] })),
    Columns: names.map((name, index) => ({ Ordinal: index, SourceIndex: index, Values: [{ Caption: 'Баранов Віталій' }, { Caption: name }] })),
    Cells: cells(0),
    Totals: { State: 'materialized', Values: cells(-1), Groups: [{ Level: 0, RowSourceIndex: 0, RowCount: 2, Values: cells(0) }] },
    valueSemantics: names.map((_, index) => ({ columnSourceIndex: index, measureType: [0, 2, 6, 10, 14][index],
      semantics: { kind: index === 0 ? 'quantity' : index === 4 ? 'percent' : 'money', currencyPolicy: index > 0 && index < 4 ? 'EUR' : 'notApplicable',
        unitPolicy: index === 0 ? 'confirmedCompatibleUnit' : index === 4 ? 'percentAlreadyMultipliedBy100' : 'currency',
        aggregation: index === 0 ? 'sumWithinCompatibleUnit' : index === 4 ? 'recomputeFromBase' : 'sum', scalable: index > 0 && index < 4,
        defaultDecimalPlaces: index === 0 ? 3 : 2, defaultMinimumDecimalPlaces: index === 0 ? 0 : 2 } })),
  } })
  const before = structuredClone(preview)
  const view = render(<MantineProvider env="test"><I18nProvider><ReportPreviewPages initial={preview} request={request} /></I18nProvider></MantineProvider>)
  expect(preview).toEqual(before)
  return view
}

it('shows dashes for unknown sales quantities in the screenshot layout, retaining money and missing intersections', () => {
  const view = show(null)
  expect(view.container.querySelector('table')?.textContent).not.toContain('∅')
  const quantities = screen.getAllByRole('cell', { description: 'Кількість не підтверджена для вибраних рядків.' })
  expect(quantities).toHaveLength(3)
  quantities.forEach(cell => expect(cell.textContent).toBe('—'))
  const detail = screen.getByRole('rowheader', { name: 'Баранов Віталій' }).closest('tr')!
  expect(within(detail).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '14\u00a0990,61', '11\u00a0954,96', '3\u00a0035,65', '25,39'])
  const absent = screen.getByRole('rowheader', { name: 'Грель Христина' }).closest('tr')!
  expect(within(absent).getAllByRole('cell').map(cell => cell.textContent)).toEqual(Array(5).fill('—'))
  expect(screen.getAllByRole('cell', { name: '14\u00a0990,61' })).toHaveLength(3)
})

it.each([['0', '0'], ['12.5', '12,5'], ['-2.125', '-2,125']])('retains confirmed quantity %s in detail and totals', (value, text) => {
  show(value)
  expect(screen.getAllByRole('cell', { name: text })).toHaveLength(3)
  expect(screen.queryByRole('cell', { description: 'Кількість не підтверджена для вибраних рядків.' })).toBeNull()
})
