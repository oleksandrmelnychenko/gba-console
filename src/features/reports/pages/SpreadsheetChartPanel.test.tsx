import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import type { SpreadsheetSheet } from '../types'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'

vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children: ReactNode; data: SpreadsheetChartPoint[] }) => <div>
    <output data-testid="chart-points">{JSON.stringify(data)}</output>{children}
  </div>
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
    BarChart: Chart, LineChart: Chart,
    CartesianGrid: () => null, ReferenceLine: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
    Bar: () => null,
    Line: ({ connectNulls }: { connectNulls: boolean }) => <output data-testid="line-connects-gaps">{String(connectNulls)}</output>,
  }
})

const sheet: SpreadsheetSheet = { name: 'Звіт', columns: ['Клієнт', 'Сума'],
  header: { rowGroupings: ['Клієнт'], columnGroupings: [], lines: [], warnings: [] }, rows: [
    { kind: 'data', cells: ['А', 10] }, { kind: 'data', cells: ['Б', null] },
    { kind: 'subtotal', cells: ['Підсумок: Б', 10] }, { kind: 'data', cells: ['В', 0] },
    { kind: 'total', cells: ['Загальний підсумок', 10] },
  ] }

describe('spreadsheet chart presentation', () => {
  it('passes leaf rows with unknown gaps to a line and exposes the limitation', () => {
    render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
    fireEvent.click(screen.getByLabelText('Лінія'))
    expect(JSON.parse(screen.getByTestId('chart-points').textContent!)).toEqual([
      { rowKey: 'row-1', label: 'А', value: 10 }, { rowKey: 'row-2', label: 'Б', value: null }, { rowKey: 'row-3', label: 'В', value: 0 },
    ])
    expect(screen.getByTestId('line-connects-gaps').textContent).toBe('false')
    expect(screen.getByText(/Для 1 показаних рядків немає числового значення/)).toBeTruthy()
  })

  it('reports the 50-row limit explicitly while the table retains all rows', () => {
    const rows = Array.from({ length: 55 }, (_, index) => ({ kind: 'data' as const, cells: [`Рядок ${index}`, index] }))
    render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={{ ...sheet, rows }} rows={rows} /></MantineProvider>)
    expect(screen.getByText(/Показано 50 із 55 рядків/)).toBeTruthy()
    expect(screen.getByText(/Діаграма обмежена першими 50 рядками/)).toBeTruthy()
    expect(rows).toHaveLength(55)
  })
})
