import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { paymentRows } from '../data/paymentComparison.test-fixtures'
import { PAYMENT_COMPARISON_EMPTY_STATE } from '../data/paymentComparisonSpreadsheet'
import { PAYMENT_COMPARISON_TITLE } from '../data/paymentComparison'
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
async function upload(rows: SpreadsheetCellValue[][], name = 'payments.xlsx') {
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
  return buildSpreadsheetSheet('payments.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
}
it('renders authoritative4dp money/2dp relative values from binary XLSX and removes stale totals from filtered CSV', async () => {
  const { container } = viewer(); await upload(paymentRows('mixed')); await screen.findByText(PAYMENT_COMPARISON_TITLE)
  expect(screen.queryByLabelText('Від')).toBeNull(); expect(screen.queryByLabelText('До')).toBeNull();
  expect(screen.getByText('Рядків: 2')).toBeTruthy(); expect(container.querySelector('.reports-sale-table')!.textContent).toContain('120,0000')
  expect(container.querySelectorAll('.reports-client-activity-header')).toHaveLength(1)
  fireEvent.click(screen.getByLabelText('Експорт CSV')); expect(lastCsvSheet().rows.at(-1)?.cells).toEqual(['Загальний підсумок', '', '', '', '', '', ''])
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: '[201]' } }); await screen.findByText('Рядків: 1')
  expect(screen.queryByText('Загальний підсумок')).toBeNull(); fireEvent.click(screen.getByLabelText('Експорт CSV')); const filtered = lastCsvSheet()
  expect(filtered.rows).toEqual([{ kind: 'data', cells: ['EUR [2]', 'Клієнт [101]', 'Договір [201]', 120, 80, 40, 50] }])
  expect(getAdditiveColumns(filtered).every(value => !value)).toBe(true); expect(buildSpreadsheetChartData(filtered, filtered.rows, 6).points.map(p => p.value)).toEqual([50])
})
it('keeps empty selected headers without any monetary grand through search/export and clears stale file after a rejected header', async () => {
  const { container } = viewer(); await upload(paymentRows('empty', [0, 3])); await screen.findByText(PAYMENT_COMPARISON_TITLE)
  expect(screen.getByText(PAYMENT_COMPARISON_EMPTY_STATE)).toBeTruthy(); expect(screen.getByText('Рядків: 0')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: 'відсутнє' } }); await waitFor(() => expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(0))
  fireEvent.click(screen.getByLabelText('Експорт CSV')); expect(lastCsvSheet().rows).toEqual([])
  const bad = paymentRows(); bad.splice(2, 1); await upload(bad, 'bad.xlsx'); await screen.findByText(/Некоректний файл порівняння платежів/)
  expect(screen.queryByText(PAYMENT_COMPARISON_TITLE)).toBeNull(); expect((screen.getByLabelText('Експорт CSV') as HTMLButtonElement).disabled).toBe(true)
})
