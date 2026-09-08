import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { clientComparisonRows } from '../data/clientPeriodComparison.test-fixtures'
import { CLIENT_COMPARISON_EMPTY_STATE } from '../data/clientPeriodComparisonSpreadsheet'
import { CLIENT_COMPARISON_TITLE } from '../data/clientPeriodComparison'
import { buildSpreadsheetChartData } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet, detectDelimiter, getAdditiveColumns, parseDelimitedText } from '../spreadsheet'
import type { SpreadsheetCellValue } from '../types'
import { downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'

vi.mock('../../auth/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../utils', async original => ({ ...await original<typeof import('../utils')>(), downloadTextFile: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
function viewer() { return render(<MemoryRouter><MantineProvider env="test"><I18nProvider><ReportsSalePage /></I18nProvider></MantineProvider></MemoryRouter>) }
async function upload(rows: SpreadsheetCellValue[][], name = 'clients.xlsx') {
  const XLSX = await import('xlsx'), workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet(rows)
  const separator = rows.findIndex(row => row.length === 0)
  sheet['!merges'] = rows.slice(0, separator).map((_, r) => ({ s: { r, c: 0 }, e: { r, c: 1 } }))
  XLSX.utils.book_append_sheet(workbook, sheet, 'Report')
  fireEvent.change(screen.getByLabelText('Завантажити файл'), { target: { files: [new File([
    XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], name,
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] } })
}
function lastCsvSheet() {
  const csv = vi.mocked(downloadTextFile).mock.calls.at(-1)![1]
  return buildSpreadsheetSheet('clients.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
}
it('reads binary source13 XLSX and exports filtered CSV without inventing union totals or averaging percentages', async () => {
  const { container } = viewer(); await upload(clientComparisonRows()); await screen.findByText(CLIENT_COMPARISON_TITLE)
  expect(screen.getByText('Рядків: 2')).toBeTruthy()
  const cells = container.querySelectorAll('.reports-sale-table tr.data-table-row td.data-table-cell')
  expect(cells[cells.length - 1].textContent).toBe('50,00')
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows.at(-1)?.cells).toEqual(['Загальний підсумок', 3, 2, 1, 50])
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: '[101]' } })
  await screen.findByText('Рядків: 1')
  expect(screen.queryByText('Разом')).toBeNull()
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  const filtered = lastCsvSheet()
  expect(filtered.rows).toEqual([{ kind: 'data', cells: ['Клієнт A [101]', 2, 1, 1, 100] }])
  expect(getAdditiveColumns(filtered).every(value => !value)).toBe(true)
  expect(buildSpreadsheetChartData(filtered, filtered.rows, 4).points.map(point => point.value)).toEqual([100])
})
it('keeps selected empty percentages at 100.00 and clears prior file success after invalid metadata', async () => {
  const { container } = viewer(); await upload(clientComparisonRows('empty', [1, 3])); await screen.findByText(CLIENT_COMPARISON_TITLE)
  expect(screen.getByText(CLIENT_COMPARISON_EMPTY_STATE)).toBeTruthy()
  expect(screen.getByText('Рядків: 0')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: 'відсутнє' } })
  await waitFor(() => expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(1))
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows).toEqual([{ kind: 'total', cells: ['Загальний підсумок', 0, 100] }])
  const bad = clientComparisonRows(); bad.splice(2, 1)
  await upload(bad, 'bad.xlsx'); await screen.findByText(/Некоректний файл порівняння клієнтів/)
  expect(screen.queryByText(CLIENT_COMPARISON_TITLE)).toBeNull()
  expect((screen.getByLabelText('Експорт CSV') as HTMLButtonElement).disabled).toBe(true)
})
