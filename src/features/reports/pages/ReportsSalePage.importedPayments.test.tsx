import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { importedPaymentsRows } from '../data/importedPayments.test-fixtures'
import { IMPORTED_PAYMENTS_EMPTY_STATE } from '../data/importedPaymentsSpreadsheet'
import { IMPORTED_PAYMENTS_TITLE } from '../data/importedPayments'
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
it('reads binary source14 XLSX and exports 4dp filtered CSV without manufacturing monetary coverage', async () => {
  const { container } = viewer(); await upload(importedPaymentsRows('mixed')); await screen.findByText(IMPORTED_PAYMENTS_TITLE)
  expect(screen.getByText('Рядків: 3')).toBeTruthy()
  expect(container.textContent).toContain('12,3401')
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows.at(-1)?.cells).toEqual(['Загальний підсумок', '', '', ''])
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: 'надходження' } })
  await screen.findByText('Рядків: 1')
  expect(screen.queryByText('Разом')).toBeNull()
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  const filtered = lastCsvSheet()
  expect(filtered.rows).toEqual([{ kind: 'data', cells: ['EUR [1] надходження', 12.3401, 0, 12.3401] }])
  expect(getAdditiveColumns(filtered).every(value => !value)).toBe(true)
  expect(buildSpreadsheetChartData(filtered, filtered.rows, 3).points.map(point => point.value)).toEqual([12.3401])
})
it('keeps selected complete-empty metadata without a fake monetary total and clears prior success after invalid metadata', async () => {
  const { container } = viewer(); await upload(importedPaymentsRows('empty', [0, 2])); await screen.findByText(IMPORTED_PAYMENTS_TITLE)
  expect(screen.getByText(IMPORTED_PAYMENTS_EMPTY_STATE)).toBeTruthy()
  expect(screen.getByText('Рядків: 0')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Пошук'), { target: { value: 'відсутнє' } })
  await waitFor(() => expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(0))
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(lastCsvSheet().rows).toEqual([])
  const bad = importedPaymentsRows(); bad.splice(2, 1)
  await upload(bad, 'bad.xlsx'); await screen.findByText(/Некоректний файл записаних імпортованих платежів/)
  expect(screen.queryByText(IMPORTED_PAYMENTS_TITLE)).toBeNull()
  expect((screen.getByLabelText('Експорт CSV') as HTMLButtonElement).disabled).toBe(true)
})
