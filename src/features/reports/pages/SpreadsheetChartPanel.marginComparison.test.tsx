import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { marginRows } from '../data/marginComparison.test-fixtures'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet } from '../spreadsheet'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'
vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children: ReactNode; data: SpreadsheetChartPoint[] }) => <div><output data-testid="points">{JSON.stringify(data)}</output>{children}</div>
  const Axis = ({ type, allowDecimals, tickFormatter }: { type?: string; allowDecimals?: boolean; tickFormatter: (value: number) => string }) => type === 'category' ? null : <output data-testid="axis">{JSON.stringify({ allowDecimals, value: tickFormatter(50) })}</output>
  return { ResponsiveContainer: ({ children }: { children: ReactNode }) => children, BarChart: Chart, LineChart: Chart,
    CartesianGrid: () => null, ReferenceLine: () => null,
    Tooltip: ({ content }: { content: ReactElement }) => <div data-testid="tooltip">{cloneElement(content as ReactElement<{ active: boolean; payload: unknown[] }>, { active: true, payload: [{ payload: { label: 'Клієнт [1] · Договір [201]', value: 50 } }] })}</div>,
    XAxis: (props: { type?: string; tickFormatter: (value: number) => string }) => props.type === 'number' ? <Axis {...props} /> : null,
    YAxis: Axis, Bar: () => null, Line: ({ connectNulls }: { connectNulls: boolean }) => <output data-testid="gaps">{String(connectNulls)}</output> }
})
it.each([0, 1, 2, 3].flatMap(measure => ['Стовпчики', 'Смуги', 'Лінія'].map(kind => ({ measure, kind }))))('plots selected leaf$measure as $kind, with 2dp and percent value units', ({ measure, kind }) => {
  const raw = marginRows('known', [measure]); const row = raw.find(r => r[1] === 'Договір [201]')!; row[2] = -50
  const sheet = buildSpreadsheetSheet('Revenue', raw)
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>); fireEvent.click(screen.getByLabelText(kind))
  const points = JSON.parse(screen.getByTestId('points').textContent!)
  expect(points.map((p: SpreadsheetChartPoint) => p.value)).toEqual([-50, [10, 0, 10, 100][measure]])
  expect(points.map((p: SpreadsheetChartPoint) => p.label)).toEqual(['Клієнт [1] · Договір [201]', 'Клієнт [1] · Договір [202]'])
  expect(JSON.parse(screen.getByTestId('axis').textContent!)).toEqual({ allowDecimals: true, value: '50,00' })
  expect(screen.getByTestId('tooltip').textContent).toContain('50,00'); expect(screen.getByTestId('tooltip').textContent).not.toContain('0,50')
  if (kind === 'Лінія') expect(screen.getByTestId('gaps').textContent).toBe('false')
})
it('keeps unknown amount as a line gap and excludes sticky totals', () => {
  const sheet = buildSpreadsheetSheet('Revenue', marginRows('current-unknown', [0]))
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>); fireEvent.click(screen.getByLabelText('Лінія'))
  expect(JSON.parse(screen.getByTestId('points').textContent!).map((p: SpreadsheetChartPoint) => p.value)).toEqual([null])
  expect(screen.getByTestId('gaps').textContent).toBe('false')
})
