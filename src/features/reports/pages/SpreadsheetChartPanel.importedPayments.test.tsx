import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { importedPaymentsRows } from '../data/importedPayments.test-fixtures'
import type { SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet } from '../spreadsheet'
import SpreadsheetChartPanel from './SpreadsheetChartPanel'

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn() })
afterAll(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView })

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
  rows[rows.length - 4][0] = 'EUR [1]'
  rows[rows.length - 3][0] = 'EUR [1]'
  rows[rows.length - 4][1] = -3.2501
  rows[rows.length - 3][1] = null
  const sheet = buildSpreadsheetSheet('Report', rows)
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={sheet} rows={sheet.rows} /></MantineProvider>)
  fireEvent.click(screen.getByLabelText(kind))
  expect(JSON.parse(screen.getByTestId('chart-points').textContent!)).toEqual([
    { rowKey: 'row-1', label: 'EUR [1]', value: -3.2501 },
    { rowKey: 'row-2', label: 'EUR [1]', value: null }])
  const axis = JSON.parse(screen.getByTestId('count-axis').textContent!)
  expect(axis.allowDecimals).toBe(true)
  expect(axis.formatted).toBe('1 000,0000')
  if (kind === 'Лінія') expect(screen.getByTestId('line-gap').textContent).toBe('false')
})

function currencyFile(labels: string[], amounts: Array<number | null> = labels.map(() => 1)) {
  const file = buildSpreadsheetSheet('Report', importedPaymentsRows('known', [2]))
  file.rows = labels.map((label, i) => ({ kind: 'data', cells: [label, amounts[i]] }))
  return file
}
const points = () => JSON.parse(screen.getByTestId('chart-points').textContent!) as SpreadsheetChartPoint[]
it('requires an explicit currency choice and plots only that domain, preserving signed values and unknown money', async () => {
  const user = userEvent.setup(), file = currencyFile(['EUR [2]', 'UAH [10038]', 'EUR [2]', 'Не вказано'], [-3.2501, 1000000, null, 0])
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={file} rows={file.rows} /></MantineProvider>)
  expect(screen.queryByTestId('chart-points')).toBeNull()
  expect(screen.getByText(/непідтвердженою валютою не показано: 1/)).toBeTruthy()
  await user.click(screen.getByRole('combobox', { name: 'Валюта діаграми' }))
  await user.click(screen.getByRole('option', { name: 'EUR [2]' }))
  expect(points().map(point => point.value)).toEqual([-3.2501, null])
  expect(screen.getByText('Валюта діаграми: EUR [2]. Суми у власній валюті, без конвертації.')).toBeTruthy()
  await user.click(screen.getByRole('combobox', { name: 'Валюта діаграми' }))
  await user.click(screen.getByRole('option', { name: 'UAH [10038]' }))
  expect(points().map(point => point.value)).toEqual([1000000])
})
it('automatically plots one known currency, retaining unknown money as a gap', () => {
  const file = currencyFile(['EUR [2]', 'EUR [2]'], [0, null])
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={file} rows={file.rows} /></MantineProvider>)
  expect(screen.queryByLabelText('Валюта діаграми')).toBeNull()
  expect(points().map(point => point.value)).toEqual([0, null])
})
it('does not carry a previous explicit currency choice into another uploaded sheet', async () => {
  const user = userEvent.setup(), first = currencyFile(['EUR [2]', 'UAH [10038]'])
  const view = render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={first} rows={first.rows} /></MantineProvider>)
  await user.click(screen.getByRole('combobox', { name: 'Валюта діаграми' })); await user.click(screen.getByRole('option', { name: 'EUR [2]' }))
  expect(points()).toHaveLength(1)
  const next = currencyFile(['EUR [2]', 'UAH [10038]'])
  view.rerender(<MantineProvider env="test"><SpreadsheetChartPanel sheet={next} rows={next.rows} /></MantineProvider>)
  expect(screen.queryByTestId('chart-points')).toBeNull()
})
it('suppresses charts without a declared currency axis and gives a concrete builder instruction', () => {
  const file = currencyFile(['EUR account [2]'], [10.2501]); file.header!.rowGroupings = ['Рахунок']
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={file} rows={file.rows} /></MantineProvider>)
  expect(screen.queryByTestId('chart-points')).toBeNull(); expect(screen.getByText(/додайте «Валюта рахунку» до рядків або колонок/)).toBeTruthy()
})
it('suppresses numeric charts when every currency is unknown even if an amount is present', () => {
  const file = currencyFile(['Не вказано'], [10])
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={file} rows={file.rows} /></MantineProvider>)
  expect(screen.queryByTestId('chart-points')).toBeNull(); expect(screen.getByText(/немає підтвердженої валюти/)).toBeTruthy()
})
it('changes the proved currency when the selected pivot value column changes', async () => {
  const user = userEvent.setup(), file = currencyFile(['Договір [201]'], [2.2501])
  file.header!.rowGroupings = ['Договір']; file.header!.columnGroupings = ['Валюта рахунку']
  file.columns = ['Договір', 'EUR [2] · Записані платежі · Різниця записаних платежів', 'UAH [10038] · Записані платежі · Різниця записаних платежів']
  file.rows[0].cells.push(-100.2501)
  render(<MantineProvider env="test"><SpreadsheetChartPanel sheet={file} rows={file.rows} /></MantineProvider>)
  expect(points().map(point => point.value)).toEqual([2.2501]); expect(screen.getByText(/Валюта діаграми: EUR \[2\]/)).toBeTruthy()
  await user.click(screen.getByRole('combobox', { name: 'Показник діаграми' })); await user.click(screen.getByRole('option', { name: file.columns[2] }))
  expect(points().map(point => point.value)).toEqual([-100.2501]); expect(screen.getByText(/Валюта діаграми: UAH \[10038\]/)).toBeTruthy()
})
