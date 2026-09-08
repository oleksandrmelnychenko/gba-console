import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { clientActivityWorkbookRows } from '../data/clientActivity.test-fixtures'
import { CLIENT_ACTIVITY_EMPTY_STATE, CLIENT_ACTIVITY_REPORT_TITLE } from '../data/clientActivityReport'
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
it.each(['known', 'disjoint', 'unknown'] as const)('imports binary count XLSX, preserves server grand and CSV without money formatting or filtered sums: %s', async kind => {
  const { container } = viewer(); await upload(clientActivityWorkbookRows(kind)); await screen.findByText(CLIENT_ACTIVITY_REPORT_TITLE)
  expect(screen.getByLabelText('Від')).toBeTruthy(); expect(screen.getByText('Рядків: 2')).toBeTruthy()
  const cells = container.querySelectorAll('.reports-sale-table tr.data-table-row td.data-table-cell')
  expect(cells[1].textContent).toBe('2')
  expect(cells[cells.length - 1].textContent).toBe(kind === 'known' ? '3' : kind === 'disjoint' ? '4' : '')
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  const imported = lastCsvSheet()
  expect(imported.rows.find(row => row.kind === 'total')?.cells[1]).toBe(kind === 'known' ? 3 : kind === 'disjoint' ? 4 : '')
  expect(buildSpreadsheetChartData(imported, imported.rows, 1).points.map(point => point.value)).toEqual([2, kind === 'unknown' ? null : 2])
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: '2026-06' } })
  await screen.findByText('Рядків: 1')
  expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(1)
  expect(screen.queryByText('Разом')).toBeNull()
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows).toEqual([{ kind: 'data', cells: ['2026-06', 2] }])
  expect(getAdditiveColumns(lastCsvSheet())).toEqual([false, false])
})
it('keeps complete-empty zero grand distinct from unknown and refuses a later malformed import without stale success', async () => {
  const { container } = viewer(); await upload(clientActivityWorkbookRows('empty')); await screen.findByText(CLIENT_ACTIVITY_REPORT_TITLE)
  expect(screen.getByText(CLIENT_ACTIVITY_EMPTY_STATE)).toBeTruthy(); expect(screen.getByText('Рядків: 0')).toBeTruthy()
  expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(1)
  expect(container.querySelectorAll('.reports-sale-table tr.data-table-row td.data-table-cell')[1].textContent).toBe('0')
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: 'відсутній клієнт' } })
  await waitFor(() => expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: 'Діаграма' })); await screen.findByText('За поточними відборами немає рядків даних.')
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows).toEqual([{ kind: 'total', cells: ['Загальний підсумок', 0] }])
  const malformed = clientActivityWorkbookRows('empty'); malformed.at(-1)![1] = 1.5
  await upload(malformed, 'invalid.xlsx'); await screen.findByText(/Некоректний файл активності клієнтів/)
  expect(screen.queryByText(CLIENT_ACTIVITY_REPORT_TITLE)).toBeNull()
  await waitFor(() => expect((screen.getByLabelText('Експорт CSV') as HTMLButtonElement).disabled).toBe(true))
})
