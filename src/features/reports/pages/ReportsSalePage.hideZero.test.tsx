import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { hideZeroAllHiddenLines, hideZeroAllHiddenRows } from '../data/reportHideZero.test-fixtures'
import { HIDE_ZERO_ALL_HIDDEN_STATE } from '../data/reportHideZero'
import { accountBalanceWorkbookRows } from '../data/accountBalances.test-fixtures'
import { buildSpreadsheetSheet, detectDelimiter, parseDelimitedText } from '../spreadsheet'
import type { SpreadsheetCellValue } from '../types'
import { buildSpreadsheetCsv, downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'

vi.mock('../../auth/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../utils', async original => ({ ...await original<typeof import('../utils')>(), downloadTextFile: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
function viewer() { return render(<MemoryRouter><MantineProvider env="test"><I18nProvider><ReportsSalePage /></I18nProvider></MantineProvider></MemoryRouter>) }
function upload(file: File) { fireEvent.change(screen.getByLabelText('Завантажити файл'), { target: { files: [file] } }) }
async function workbookFile(rows: SpreadsheetCellValue[][], name = 'hidden-zero.xlsx') {
  const XLSX = await import('xlsx'), workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = rows.flatMap((row, r) => typeof row[0] === 'string' && (hideZeroAllHiddenLines.includes(row[0]) || row[0] === HIDE_ZERO_ALL_HIDDEN_STATE)
    ? [{ s: { r, c: 0 }, e: { r, c: 1 } }] : [])
  XLSX.utils.book_append_sheet(workbook, sheet, 'Report')
  return new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], name,
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

it('imports a real binary metadata-only XLSX, shows the explicit presentation in table/chart and round-trips its CSV without inventing columns or totals', async () => {
  const { container } = viewer(); upload(await workbookFile(hideZeroAllHiddenRows))
  await screen.findByText('Усі підтверджені нульові записи приховано')
  expect(screen.getByText(/Це стан цього файлу, а не нова перевірка джерела/)).toBeTruthy()
  expect(screen.queryByLabelText('Від')).toBeNull()
  expect(screen.getByText('Рядків: 0')).toBeTruthy()
  expect(container.querySelectorAll('.reports-sale-table tr')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Діаграма' }))
  expect(screen.getByText('Усі підтверджені нульові записи приховано')).toBeTruthy()
  expect(screen.queryByRole('combobox', { name: 'Показник діаграми' })).toBeNull()
  expect(container.querySelectorAll('.recharts-surface')).toHaveLength(0)
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  expect(downloadTextFile).toHaveBeenCalledOnce()
  const csv = vi.mocked(downloadTextFile).mock.calls[0][1]
  const imported = buildSpreadsheetSheet('hidden.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(imported.presentationState).toBe('all_confirmed_zero_hidden')
  expect(imported.rows).toEqual([]); expect(imported.columns).toEqual([])
  expect(imported.header?.lines).toEqual([...hideZeroAllHiddenLines, HIDE_ZERO_ALL_HIDDEN_STATE])
  upload(new File([csv], 'hidden.csv', { type: 'text/csv' }))
  await screen.findByRole('button', { name: 'hidden.csv' }); expect(screen.getByText('Усі підтверджені нульові записи приховано')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Таблиця' }))
  expect(container.querySelectorAll('.reports-sale-table tr')).toHaveLength(0)
  upload(await workbookFile(accountBalanceWorkbookRows, 'ordinary.xlsx'))
  await screen.findByText('ordinary.xlsx')
  expect(screen.queryByText('Усі підтверджені нульові записи приховано')).toBeNull()
  expect(screen.getByText('Рядків: 4')).toBeTruthy()
  expect(container.querySelectorAll('.reports-sale-table tr.data-table-row')).toHaveLength(6)
  expect(container.querySelectorAll('.reports-sale-table tr.data-table-row td.data-table-cell')[4].textContent).toBe('0,00')
}, 10000)

it.each(['data', 'marker'])('refuses malformed native state (%s) after a prior successful import instead of keeping a stale empty success', async kind => {
  viewer(); upload(await workbookFile(hideZeroAllHiddenRows)); await screen.findByText('Усі підтверджені нульові записи приховано')
  const rows = [...hideZeroAllHiddenLines.map(line => [line]), [], [HIDE_ZERO_ALL_HIDDEN_STATE],
    kind === 'data' ? ['Не можна втратити запис [40964]', 0] : [HIDE_ZERO_ALL_HIDDEN_STATE]]
  upload(new File([buildSpreadsheetCsv(rows)], 'malformed.csv', { type: 'text/csv' }))
  await screen.findByText(/Некоректний стан звіту/)
  expect(screen.queryByText('Усі підтверджені нульові записи приховано')).toBeNull()
  await waitFor(() => expect((screen.getByLabelText('Експорт CSV') as HTMLButtonElement).disabled).toBe(true))
  expect(downloadTextFile).not.toHaveBeenCalled()
})
