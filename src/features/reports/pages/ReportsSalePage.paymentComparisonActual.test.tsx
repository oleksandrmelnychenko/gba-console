import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import readXlsxFile from 'read-excel-file/browser'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import artifacts from '../data/paymentComparison.actual-workbooks.json'
import { PAYMENT_COMPARISON_TITLE } from '../data/paymentComparison'
import { getPaymentChartCurrencyScope } from '../data/importedPaymentsChartCurrency'
import { buildSpreadsheetChartData } from '../data/spreadsheetChartData'
import { buildSpreadsheetSheet, detectDelimiter, getAdditiveColumns, getSpreadsheetNumberFormatter, normalizeImportedCellValue, parseDelimitedText } from '../spreadsheet'
import type { SpreadsheetSheet } from '../types'
import { downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'

vi.mock('../../auth/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../utils', async original => ({ ...await original<typeof import('../utils')>(), downloadTextFile: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

function displayedValues(sheet: SpreadsheetSheet) {
  return sheet.rows.map(row => row.cells.slice(3).map((cell, offset) => cell == null || cell === '' ? null
    : getSpreadsheetNumberFormatter(sheet, offset + 3, true)?.format(Number(cell))))
}

it.each(artifacts)('imports actual SQL/C# workbook $name, preserving currency subtotals, unknowns and CSV/chart values', async artifact => {
  const bytes = Uint8Array.from(atob(artifact.base64), character => character.charCodeAt(0))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  expect(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')).toBe(artifact.sha256)
  const file = new File([bytes], artifact.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const [actual] = await readXlsxFile(file)
  const parsed = buildSpreadsheetSheet(actual.sheet, actual.data.map(row => row.map(normalizeImportedCellValue)))
  expect(parsed.rows.map(row => row.kind)).toEqual(artifact.kinds)
  expect(displayedValues(parsed)).toEqual(artifact.expected)
  expect(getAdditiveColumns(parsed).some(Boolean)).toBe(false)
  const leaves = parsed.rows.filter(row => row.kind === 'data')
  expect(leaves.map(row => String(row.cells[2]).match(/\[(\d+)\]$/)?.[1] ?? null)).toEqual(artifact.contractIds)
  for (let offset = 0; offset < 4; offset += 1) {
    const scope = getPaymentChartCurrencyScope(parsed, parsed.rows, offset + 3)
    for (const rows of scope.rowsByCurrency.values()) expect(buildSpreadsheetChartData(parsed, rows, offset + 3).points.map(point => point.value))
      .toEqual(rows.map(row => row.cells[offset + 3] == null || row.cells[offset + 3] === '' ? null : Number(row.cells[offset + 3])))
  }
  const { container } = render(<MemoryRouter><MantineProvider env="test"><I18nProvider><ReportsSalePage /></I18nProvider></MantineProvider></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Завантажити файл'), { target: { files: [file] } })
  await screen.findByText(PAYMENT_COMPARISON_TITLE)
  expect(screen.getByText(`Рядків: ${leaves.length}`)).toBeTruthy()
  expect(container.querySelector('span[title="Порівняння платежів · Сума за поточний період"]')?.textContent).toBe('Поточна сума')
  expect(container.querySelector('span[title="Порівняння платежів · Сума за період порівняння"]')?.textContent).toBe('Попередня сума')
  expect(screen.queryByLabelText('Від')).toBeNull(); expect(screen.queryByLabelText('До')).toBeNull()
  expect(container.querySelectorAll('.reports-sale-row-computed')).toHaveLength(0)
  const tableRows = container.querySelectorAll('.reports-sale-table tr.data-table-row')
  expect(Array.from(tableRows).map(row => Array.from(row.querySelectorAll('td.data-table-cell')).slice(3)
    .map(cell => cell.textContent))).toEqual(artifact.expected.map(values => values.map(value => value?.replace('.', ',') ?? '')))
  fireEvent.click(screen.getByLabelText('Експорт CSV')); expect(downloadTextFile).toHaveBeenCalledOnce()
  const csv = vi.mocked(downloadTextFile).mock.calls[0][1]
  const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(restored.rows.map(row => row.kind)).toEqual(artifact.kinds)
  expect(displayedValues(restored)).toEqual(artifact.expected)
  expect(getAdditiveColumns(restored).some(Boolean)).toBe(false)
  expect(restored.header?.lines).toEqual(parsed.header?.lines)
})
