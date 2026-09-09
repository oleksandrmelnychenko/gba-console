import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { rateRows } from '../data/rateComparison.test-fixtures'
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
it.each([0, 1, 2, 3].flatMap(measure => ['Стовпчики', 'Смуги', 'Лінія'].map(kind => ({ measure, kind }))))('plots one exact series measure$measure as $kind with declared precision', ({ measure, kind }) => {
  const sheet = buildSpreadsheetSheet('Курс', rateRows('negative', [measure]))
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>); fireEvent.click(screen.getByLabelText(kind))
  const points = JSON.parse(screen.getByTestId('points').textContent!)
  expect(points.map((point: SpreadsheetChartPoint) => point.value)).toEqual([[40, 42.5, -2.5, -5.88][measure]])
  expect(points[0].label).toContain('[RateDefinitionID=9007199254740993]')
  const value = measure === 3 ? '50,00' : '50,0000'
  expect(JSON.parse(screen.getByTestId('axis').textContent!)).toEqual({ allowDecimals: true, value }); expect(screen.getByTestId('tooltip').textContent).toContain(value)
  if (kind === 'Лінія') expect(screen.getByTestId('gaps').textContent).toBe('false')
})
it('keeps unknown history as one exact series and a disconnected line gap', () => {
  const sheet = buildSpreadsheetSheet('Курс', rateRows('both-unknown', [0]))
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>); fireEvent.click(screen.getByLabelText('Лінія'))
  expect(JSON.parse(screen.getByTestId('points').textContent!).map((point: SpreadsheetChartPoint) => point.value)).toEqual([null]); expect(screen.getByTestId('gaps').textContent).toBe('false')
})
