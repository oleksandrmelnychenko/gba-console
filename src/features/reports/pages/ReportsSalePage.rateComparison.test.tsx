import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import readXlsxFile from 'read-excel-file/browser'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import artifacts from '../data/rateComparison.actual-workbooks.json'
import { buildSpreadsheetSheet, detectDelimiter, getAdditiveColumns, getSpreadsheetNumberFormatter, normalizeImportedCellValue, parseDelimitedText } from '../spreadsheet'
import { downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'
vi.mock('../../auth/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../utils', async original => ({ ...await original<typeof import('../utils')>(), downloadTextFile: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
it.each(artifacts)('imports actual server workbook $name and exports identical displayed values without totals', async artifact => {
  const bytes = Uint8Array.from(atob(artifact.base64), character => character.charCodeAt(0))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  expect(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')).toBe(artifact.sha256)
  const file = new File([bytes], artifact.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const [actual] = await readXlsxFile(file)
  const parsed = buildSpreadsheetSheet(actual.sheet, actual.data.map(row => row.map(normalizeImportedCellValue)))
  expect(parsed.rows).toHaveLength(1); expect(getAdditiveColumns(parsed).some(Boolean)).toBe(false)
  const values = parsed.rows[0].cells.slice(1).map((cell, offset) => cell == null || cell === '' ? null : getSpreadsheetNumberFormatter(parsed, offset + 1, true)?.format(Number(cell)))
  expect(values).toEqual(artifact.expected)
  const { container } = render(<MemoryRouter><MantineProvider env="test"><I18nProvider><ReportsSalePage /></I18nProvider></MantineProvider></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Завантажити файл'), { target: { files: [file] } })
  await screen.findByText('Рядків: 1')
  expect(screen.queryByLabelText('Від')).toBeNull(); expect(screen.queryByLabelText('До')).toBeNull()
  expect(container.querySelectorAll('.reports-sale-row-total, .reports-sale-row-subtotal, .reports-sale-row-computed')).toHaveLength(0)
  const cells = container.querySelectorAll('.reports-sale-table tr.data-table-row td.data-table-cell')
  expect(Array.from(cells).slice(1).map(cell => cell.textContent)).toEqual(artifact.expected.map(value => value == null ? '' : value.replace('.', ',')))
  fireEvent.click(screen.getByLabelText('Експорт CSV')); expect(downloadTextFile).toHaveBeenCalledOnce()
  const csv = vi.mocked(downloadTextFile).mock.calls[0][1], restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(restored.rows).toHaveLength(1); expect(getAdditiveColumns(restored).some(Boolean)).toBe(false); expect(csv).not.toContain('Загальний підсумок')
  await waitFor(() => expect(screen.getByText('Рядків: 1')).toBeTruthy())
})
