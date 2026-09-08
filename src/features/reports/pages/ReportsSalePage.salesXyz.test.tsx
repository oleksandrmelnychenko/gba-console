import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { salesXyzRows } from '../data/salesXyz.test-fixtures'
import { XYZ_EMPTY_STATE } from '../data/salesXyzSpreadsheet'
import { XYZ_TITLE } from '../data/salesXyz'
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
async function upload(rows: SpreadsheetCellValue[][], name = 'xyz.xlsx') {
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
  return buildSpreadsheetSheet('xyz.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
}
it('renders two-place money and three-place percent values; filtered binary-XLSX export removes stale raw totals', async () => {
  const { container } = viewer(); await upload(salesXyzRows()); await screen.findByText(XYZ_TITLE)
  expect(screen.getByText('Рядків: 3')).toBeTruthy()
  const text = container.querySelector('.reports-sale-table')!.textContent
  expect(text).toContain('40,820'); expect(text).toContain('-3,33'); expect(text).toContain('141,420')
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows.at(-1)?.cells).toEqual(['Загальний підсумок', '', 290, '', ''])
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: '[6]' } })
  await screen.findByText('Рядків: 1')
  expect(screen.queryByText('Загальний підсумок')).toBeNull()
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  const filtered = lastCsvSheet()
  expect(filtered.rows).toEqual([{ kind: 'data', cells: ['Y', 'Товар [6]', 300, 100, 40.82] }])
  expect(getAdditiveColumns(filtered).every(value => !value)).toBe(true)
  expect(buildSpreadsheetChartData(filtered, filtered.rows, 4).points.map(point => point.value)).toEqual([40.82])
})
it('preserves selected complete-empty state without a grand and clears a prior file on rejected metadata', async () => {
  const { container } = viewer(); await upload(salesXyzRows('empty', [0, 2])); await screen.findByText(XYZ_TITLE)
  expect(screen.getByText(XYZ_EMPTY_STATE)).toBeTruthy(); expect(screen.getByText('Рядків: 0')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: 'відсутнє' } })
  await waitFor(() => expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(0))
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows).toEqual([]); expect(lastCsvSheet().columns).toHaveLength(4)
  const bad = salesXyzRows(); bad.splice(2, 1)
  await upload(bad, 'bad.xlsx'); await screen.findByText(/Некоректний файл XYZ/)
  expect(screen.queryByText(XYZ_TITLE)).toBeNull()
  expect((screen.getByLabelText('Експорт CSV') as HTMLButtonElement).disabled).toBe(true)
})
