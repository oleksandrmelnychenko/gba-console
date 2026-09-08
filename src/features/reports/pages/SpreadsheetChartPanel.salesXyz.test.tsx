import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { salesXyzRows } from '../data/salesXyz.test-fixtures'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet } from '../spreadsheet'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'
vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children: ReactNode; data: SpreadsheetChartPoint[] }) => <div><output data-testid="points">{JSON.stringify(data)}</output>{children}</div>
  const Axis = ({ type, allowDecimals, tickFormatter }: { type?: string; allowDecimals?: boolean; tickFormatter: (value: number) => string }) => type === 'category' ? null : <output data-testid="axis">{JSON.stringify({ allowDecimals, value: tickFormatter(40.82) })}</output>
  return { ResponsiveContainer: ({ children }: { children: ReactNode }) => children, BarChart: Chart, LineChart: Chart,
    CartesianGrid: () => null, ReferenceLine: () => null,
    Tooltip: ({ content }: { content: ReactElement }) => <div data-testid="tooltip">{cloneElement(content as ReactElement<{ active: boolean; payload: unknown[] }>, { active: true, payload: [{ payload: { label: 'Y · Товар [6]', value: 40.82 } }] })}</div>,
    XAxis: (props: { type?: string; tickFormatter: (value: number) => string }) => props.type === 'number' ? <Axis {...props} /> : null,
    YAxis: Axis, Bar: () => null, Line: ({ connectNulls }: { connectNulls: boolean }) => <output data-testid="gaps">{String(connectNulls)}</output> }
})
it.each([0, 1, 2].flatMap(measure => ['Стовпчики', 'Смуги', 'Лінія'].map(kind => ({ measure, kind }))))('shows leaf measure$measure in $kind with correct percent units and no class aggregation', ({ measure, kind }) => {
  const raw = salesXyzRows('known', [measure])
  raw.splice(raw.length - 1, 0, ['Невідомо', 'Невідомий товар', measure === 0 ? 5 : null])
  const sheet = buildSpreadsheetSheet('XYZ', raw)
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
  fireEvent.click(screen.getByLabelText(kind))
  const points = JSON.parse(screen.getByTestId('points').textContent!)
  expect(points.map((p: SpreadsheetChartPoint) => p.value)).toEqual(measure === 0 ? [300, -10, 0, 5] : measure === 1 ? [100, -3.33, 0, null] : [40.82, 141.42, 0, null])
  expect(points.map((p: SpreadsheetChartPoint) => p.label)).toEqual(['Y · Товар [6]', 'Z · Товар [9]', 'Без класу · Товар [8]', 'Невідомо · Невідомий товар'])
  expect(JSON.parse(screen.getByTestId('axis').textContent!)).toEqual({ allowDecimals: true, value: measure === 2 ? '40,820' : '40,82' })
  expect(screen.getByTestId('tooltip').textContent).toContain(measure === 2 ? '40,820' : '40,82')
  expect(screen.getByTestId('tooltip').textContent).not.toContain('0,4082')
  if (kind === 'Лінія') expect(screen.getByTestId('gaps').textContent).toBe('false')
})
