import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { clientActivityWorkbookRows } from '../data/clientActivity.test-fixtures'
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
it.each(['Стовпчики', 'Смуги', 'Лінія'])('keeps server leaf counts and unknown gaps in %s without plotting totals or fractional count ticks', kind => {
  const sheet = buildSpreadsheetSheet('Report', clientActivityWorkbookRows('unknown'))
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
  fireEvent.click(screen.getByLabelText(kind))
  expect(JSON.parse(screen.getByTestId('chart-points').textContent!)).toEqual([
    { rowKey: 'row-1', label: '2026-06', value: 2 }, { rowKey: 'row-2', label: '2026-07', value: null }])
  expect(JSON.parse(screen.getByTestId('count-axis').textContent!).allowDecimals).toBe(false)
  if (kind !== 'Смуги') expect(JSON.parse(screen.getByTestId('count-axis').textContent!).formatted).toBe('1 000')
  if (kind === 'Лінія') expect(screen.getByTestId('line-gap').textContent).toBe('false')
  expect(screen.getByText(/Для 1 показаних рядків немає числового значення/)).toBeTruthy()
})
