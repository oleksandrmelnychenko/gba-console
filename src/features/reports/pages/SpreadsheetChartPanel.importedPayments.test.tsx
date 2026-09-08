import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { importedPaymentsRows } from '../data/importedPayments.test-fixtures'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet } from '../spreadsheet'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'

vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children: ReactNode; data: SpreadsheetChartPoint[] }) => <div>
    <output data-testid="chart-points">{JSON.stringify(data)}</output>{children}
  </div>
  const Axis = ({ allowDecimals, tickFormatter, type }: { allowDecimals?: boolean; tickFormatter: (value: number) => string; type?: string }) =>
    type === 'category' ? null : <output data-testid="count-axis">{JSON.stringify({ allowDecimals, formatted: tickFormatter(1000) })}</output>
  return { ResponsiveContainer: ({ children }: { children: ReactNode }) => children, BarChart: Chart, LineChart: Chart,
    CartesianGrid: () => null, ReferenceLine: () => null, Tooltip: () => null,
    XAxis: (props: { type?: string; tickFormatter: (value: number) => string }) => props.type === 'number' ? <Axis {...props} /> : null,
    YAxis: Axis, Bar: () => null,
    Line: ({ connectNulls }: { connectNulls: boolean }) => <output data-testid="line-gap">{String(connectNulls)}</output> }
})
it.each([0, 1, 2].flatMap(measure => ['Стовпчики', 'Смуги', 'Лінія'].map(kind => ({ measure, kind }))))('plots source14 signed money measure $measure in $kind with four decimals and unknown gaps', ({ measure, kind }) => {
  const rows = importedPaymentsRows('known', [measure])
  rows[rows.length - 4][1] = -3.2501
  rows[rows.length - 3][1] = null
  const sheet = buildSpreadsheetSheet('Report', rows)
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
  fireEvent.click(screen.getByLabelText(kind))
  expect(JSON.parse(screen.getByTestId('chart-points').textContent!)).toEqual([
    { rowKey: 'row-1', label: 'EUR [1] надходження', value: -3.2501 },
    { rowKey: 'row-2', label: 'EUR [1] виплата', value: null }])
  const axis = JSON.parse(screen.getByTestId('count-axis').textContent!)
  expect(axis.allowDecimals).toBe(true)
  expect(axis.formatted).toBe('1 000,0000')
  if (kind === 'Лінія') expect(screen.getByTestId('line-gap').textContent).toBe('false')
})
