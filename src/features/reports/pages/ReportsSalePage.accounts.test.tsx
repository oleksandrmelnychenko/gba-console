import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { accountBalanceHeaderLines, accountBalanceWorkbookRows } from '../data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet, detectDelimiter, getAdditiveColumns, parseDelimitedText } from '../spreadsheet'
import { downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'

vi.mock('../../auth/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../utils', async original => ({ ...await original<typeof import('../utils')>(), downloadTextFile: vi.fn() }))

it('imports binary four-axis account XLSX and exports current metadata, all notes, fixed cents, zero and unknown without mixed-currency totals', async () => {
  const XLSX = await import('xlsx'), workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet(accountBalanceWorkbookRows)
  sheet['!merges'] = accountBalanceHeaderLines.map((_, r) => ({ s: { r, c: 0 }, e: { r, c: 4 } }))
  XLSX.utils.book_append_sheet(workbook, sheet, 'Report')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const { container } = render(<MemoryRouter><MantineProvider env="test"><I18nProvider><ReportsSalePage /></I18nProvider></MantineProvider></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Завантажити файл'), { target: { files: [new File([bytes], 'accounts.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] } })
  await screen.findByText(accountBalanceHeaderLines[0]); expect(screen.queryByLabelText('Від')).toBeNull()
  const cells = container.querySelectorAll('.reports-sale-table tr.data-table-row td.data-table-cell')
  expect(cells[4].textContent).toBe('0,00'); expect(cells[9].textContent).toBe('1 234,56')
  fireEvent.click(screen.getByLabelText('Експорт CSV'))
  const csv = vi.mocked(downloadTextFile).mock.calls[0][1]
  const imported = buildSpreadsheetSheet('accounts.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(imported.header?.lines).toEqual(accountBalanceHeaderLines)
  expect(imported.header?.rowGroupings).toHaveLength(4)
  expect(imported.rows.filter(row => row.kind === 'data').map(row => row.cells[4])).toEqual([0, 1234.56, -7.89, ''])
  expect(imported.rows.find(row => row.kind === 'total')?.cells[4]).toBe('')
  expect(getAdditiveColumns(imported)).toEqual([false, false, false, false, false])
  expect(buildSpreadsheetChartData(imported, imported.rows, 4).points.map(point => point.value)).toEqual([0, 1234.56, -7.89, null])
})
