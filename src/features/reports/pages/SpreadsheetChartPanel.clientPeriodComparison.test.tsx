import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { clientComparisonRows } from '../data/clientPeriodComparison.test-fixtures'
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
    XAxis: (props: { type?: string }) => props.type === 'number' ? <Axis {...props} tickFormatter={(value: number) => String(value)} /> : null,
    YAxis: Axis, Bar: () => null,
    Line: ({ connectNulls }: { connectNulls: boolean }) => <output data-testid="line-gap">{String(connectNulls)}</output> }
})
it.each([0, 2, 3].flatMap(measure => ['Стовпчики', 'Смуги', 'Лінія'].map(kind => ({ measure, kind }))))('plots source13 leaf values for $measure in $kind with correct axis precision', ({ measure, kind }) => {
  const rows = clientComparisonRows('known', [measure])
  rows[rows.length - 4][1] = measure === 3 ? 2.34 : measure === 2 ? -1 : 2
  rows[rows.length - 2][1] = null
  const sheet = buildSpreadsheetSheet('Report', rows)
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
  fireEvent.click(screen.getByLabelText(kind))
  expect(JSON.parse(screen.getByTestId('chart-points').textContent!)).toEqual([
    { rowKey: 'row-1', label: 'Клієнт A [101]', value: measure === 3 ? 2.34 : measure === 2 ? -1 : 2 },
    { rowKey: 'row-2', label: 'Клієнт B [102]', value: null }])
  expect(JSON.parse(screen.getByTestId('count-axis').textContent!).allowDecimals).toBe(measure === 3)
  if (kind === 'Лінія') expect(screen.getByTestId('line-gap').textContent).toBe('false')
})
