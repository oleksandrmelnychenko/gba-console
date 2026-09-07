import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import type { SpreadsheetSheet } from '../types'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'
import { valuationWorkbookRows } from '../data/valuationSpreadsheet.test-fixtures'
import { buildSpreadsheetSheet } from '../spreadsheet'

vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children: ReactNode; data: SpreadsheetChartPoint[] }) => <div>
    <output data-testid="chart-points">{JSON.stringify(data)}</output>{children}
  </div>
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
    BarChart: Chart, LineChart: Chart,
    CartesianGrid: () => null, ReferenceLine: () => null, Tooltip: () => null, XAxis: () => null,
    YAxis: ({ tickFormatter }: { tickFormatter: (value: number) => string }) => <output data-testid="axis-format">{tickFormatter(0.00000001)}</output>,
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
  beforeEach(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }))
  it('passes leaf rows with unknown gaps to a line and exposes the limitation', () => {
    render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
    fireEvent.click(screen.getByLabelText('Лінія'))
    expect(JSON.parse(screen.getByTestId('chart-points').textContent!)).toEqual([
      { rowKey: 'row-1', label: 'А', value: 10 }, { rowKey: 'row-2', label: 'Б', value: null }, { rowKey: 'row-3', label: 'В', value: 0 },
    ])
    expect(screen.getByTestId('line-connects-gaps').textContent).toBe('false')
    expect(screen.getByText(/Для 1 показаних рядків немає числового значення/)).toBeTruthy()
  })

  it('uses quantity8 and money2 chart formatting without replacing monetary gaps', async () => {
    const valuation = buildSpreadsheetSheet('Report', valuationWorkbookRows)
    render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={valuation} rows={valuation.rows} /></MantineProvider>)
    expect(screen.getByTestId('axis-format').textContent).toBe('0,00000001')
    fireEvent.click(screen.getByRole('combobox', { name: 'Показник діаграми' }))
    fireEvent.click(await screen.findByRole('option', { name: /Оцінка за договором, EUR/ }))
    expect(screen.getByTestId('axis-format').textContent).toBe('0,00')
    fireEvent.click(screen.getByLabelText('Лінія'))
    expect(JSON.parse(screen.getByTestId('chart-points').textContent!).map((point: SpreadsheetChartPoint) => point.value)).toEqual([0, null, 12.35])
    expect(screen.getByTestId('line-connects-gaps').textContent).toBe('false')
  })

  it('reports the 50-row limit explicitly while the table retains all rows', () => {
    const rows = Array.from({ length: 55 }, (_, index) => ({ kind: 'data' as const, cells: [`Рядок ${index}`, index] }))
    render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={{ ...sheet, rows }} rows={rows} /></MantineProvider>)
    expect(screen.getByText(/Показано 50 із 55 рядків/)).toBeTruthy()
    expect(screen.getByText(/Діаграма обмежена першими 50 рядками/)).toBeTruthy()
    expect(rows).toHaveLength(55)
  })
})
