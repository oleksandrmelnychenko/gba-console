import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import type { SpreadsheetSheet } from '../types'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'

const axisInput = vi.hoisted(() => ({ bounds: [-100, -40] as [number, number] }))
vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children: ReactNode; data: SpreadsheetChartPoint[] }) => <div>
    <output data-testid="points">{JSON.stringify(data)}</output>{children}
  </div>
  type AxisProps = { type?: string; domain?: (bounds: [number, number]) => [number, number] }
  const Axis = ({ axis, type, domain }: AxisProps & { axis: 'x' | 'y' }) => {
    const numeric = type === 'number' || (axis === 'y' && type === undefined)
    return <output data-testid={numeric ? 'numeric-axis' : 'category-axis'}>{JSON.stringify({
      axis, hasDomain: domain !== undefined, bounds: numeric && typeof domain === 'function' ? domain(axisInput.bounds) : null,
    })}</output>
  }
  return { ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
    BarChart: Chart, LineChart: Chart, CartesianGrid: () => null, Tooltip: () => null,
    XAxis: (props: AxisProps) => <Axis {...props} axis="x" />, YAxis: (props: AxisProps) => <Axis {...props} axis="y" />,
    ReferenceLine: ({ x, y }: { x?: number; y?: number }) => <output data-testid="zero-reference">{JSON.stringify({ x, y })}</output>,
    Bar: () => null, Line: ({ connectNulls }: { connectNulls: boolean }) => <output data-testid="connects-gaps">{String(connectNulls)}</output> }
})

const cases: Array<{ name: string; values: Array<number | null>; bounds: [number, number]; expected: [number, number] }> = [
  { name: 'negative returns and one unknown', values: [null, -40, -100], bounds: [-100, -40], expected: [-100, 0] },
  { name: 'positive values and one unknown', values: [null, 40, 100], bounds: [40, 100], expected: [0, 100] },
  { name: 'both signs and one unknown', values: [-40, null, 100], bounds: [-40, 100], expected: [-40, 100] },
  { name: 'one negative extent', values: [-40, null], bounds: [-40, -40], expected: [-40, 0] },
  { name: 'known zero and one unknown', values: [0, null], bounds: [0, 0], expected: [0, 0] },
  { name: 'only unknown values', values: [null, null], bounds: [Infinity, -Infinity], expected: [0, 0] },
]
it.each(cases.flatMap(control => ['Стовпчики', 'Смуги', 'Лінія'].map(kind => ({ ...control, kind }))))(
  'includes zero only on the numeric axis for $name / $kind without filling unknown points', ({ values, bounds, expected, kind }) => {
    axisInput.bounds = bounds
    const rows: SpreadsheetSheet['rows'] = values.map((value, index) => ({ kind: 'data', cells: ['Договір [' + (201 + index) + ']', value] }))
    rows.push({ kind: 'total', cells: ['Загальний підсумок', 999] })
    const sheet: SpreadsheetSheet = { name: 'Signed report', columns: ['Договір', 'Записані повернення, EUR'],
      header: { rowGroupings: ['Договір'], columnGroupings: [], lines: [], warnings: [] }, rows }
    render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={rows} /></MantineProvider>)
    fireEvent.click(screen.getByLabelText(kind))
    const horizontal = kind === 'Смуги'
    expect(JSON.parse(screen.getByTestId('numeric-axis').textContent!)).toEqual({ axis: horizontal ? 'x' : 'y', hasDomain: true, bounds: expected })
    expect(JSON.parse(screen.getByTestId('category-axis').textContent!)).toEqual({ axis: horizontal ? 'y' : 'x', hasDomain: false, bounds: null })
    expect(JSON.parse(screen.getByTestId('zero-reference').textContent!)).toEqual(horizontal ? { x: 0 } : { y: 0 })
    expect(JSON.parse(screen.getByTestId('points').textContent!).map((point: SpreadsheetChartPoint) => point.value)).toEqual(values)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(values.length + ' рядків, ' + values.filter(value => value === null).length + ' без значення')
    if (kind === 'Лінія') expect(screen.getByTestId('connects-gaps').textContent).toBe('false')
  },
)
