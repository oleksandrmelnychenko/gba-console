import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { downloadTextFile } from '../utils'
import { ReportsSalePage } from './ReportsSalePage'
import { stockWorkbookRows, placementWorkbookRows, reservationWorkbookRows, lotWorkbookRows } from '../data/stockSpreadsheet.test-fixtures'
import { buildSpreadsheetSheet, detectDelimiter, parseDelimitedText } from '../spreadsheet'

const allowedPermissions = new Set<string>()
const printMock = vi.fn()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null, permissionKey }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils')>(),
  downloadTextFile: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reports/sale']}>
      <MantineProvider>
        <I18nProvider>
          <ReportsSalePage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Sale-file report canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: printMock,
    })
  })

  it('does not mount the file viewer without page.view', () => {
    renderPage()

    expect(screen.getByText('Немає права переглядати файл звіту продажів')).toBeTruthy()
    expect(screen.queryByLabelText('Завантажити файл')).toBeNull()
  })

  it('keeps export and print independent from page access', () => {
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    renderPage()

    expect(screen.getByLabelText('Завантажити файл')).toBeTruthy()
    expect(screen.queryByLabelText('Експорт CSV')).toBeNull()
    expect(screen.queryByLabelText('Друк')).toBeNull()
  })

  it('rechecks export and print after a rendered control becomes stale', async () => {
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Document.Export)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Document.Print)
    renderPage()

    fireEvent.change(screen.getByLabelText('Завантажити файл'), {
      target: {
        files: [new File(['Name,Value\nSale,100'], 'sales.csv', {
          type: 'text/csv',
        })],
      },
    })

    const exportButton = await screen.findByLabelText('Експорт CSV')
    const printButton = screen.getByLabelText('Друк')
    await waitFor(() =>
      expect((exportButton as HTMLButtonElement).disabled).toBe(false),
    )

    fireEvent.click(exportButton)
    fireEvent.click(printButton)
    expect(downloadTextFile).toHaveBeenCalledOnce()
    expect(printMock).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    allowedPermissions.delete(PermissionKeys.ReportsSaleFile.Document.Export)
    allowedPermissions.delete(PermissionKeys.ReportsSaleFile.Document.Print)
    fireEvent.click(exportButton)
    fireEvent.click(printButton)

    expect(downloadTextFile).not.toHaveBeenCalled()
    expect(printMock).not.toHaveBeenCalled()
  })

  it('imports a stock XLSX, hides historical dates, displays eight decimals and exports the current snapshot intact', async () => {
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Document.Export)
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet(stockWorkbookRows)
    sheet['!merges'] = Array.from({ length: 8 }, (_, row) => ({ s: { r: row, c: 0 }, e: { r: row, c: 4 } }))
    XLSX.utils.book_append_sheet(workbook, sheet, 'Report')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const { container } = renderPage()
    fireEvent.change(screen.getByLabelText('Завантажити файл'), {
      target: { files: [new File([bytes], 'stock.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] },
    })
    await screen.findByText('Звіт поточних складських залишків')
    expect(screen.queryByLabelText('Від')).toBeNull()
    expect(screen.queryByLabelText('До')).toBeNull()
    expect(container.querySelector('.reports-sale-table')?.textContent).toContain('0,00000001')
    expect(container.querySelector('.reports-sale-table')?.textContent).toContain('2,12345678')
    const rows = container.querySelectorAll('.reports-sale-table tr.data-table-row')
    expect(rows[0].querySelectorAll('td.data-table-cell')[2].textContent).toBe('')
    expect(rows[0].querySelectorAll('td.data-table-cell')[3].textContent).toBe('0')
    fireEvent.click(screen.getByLabelText('Експорт CSV'))
    expect(downloadTextFile).toHaveBeenCalledOnce()
    const csv = vi.mocked(downloadTextFile).mock.calls[0][1]
    expect(csv).toContain('0.00000001')
    const imported = buildSpreadsheetSheet('stock.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.header?.lines[2]).toBe('Час читання (UTC): 07.09.2026 18:00:00.000 – 07.09.2026 18:00:00.120')
    expect(imported.rows.find(row => row.kind === 'total')?.cells.slice(2)).toEqual(['', '', ''])
    expect(imported.rows.filter(row => row.kind === 'data')[0].cells.slice(2)).toEqual(['', 0, 0.00000001])
  })
})


describe.each([
  { source: 5, rows: placementWorkbookRows, title: 'Звіт поточних розміщень товарів', dimensions: 5, values: [0, '', 0.00000001] },
  { source: 6, rows: reservationWorkbookRows, title: 'Звіт поточних резервів за договорами', dimensions: 4, values: [1, 0.00000001, 0] },
  { source: 7, rows: lotWorkbookRows, title: 'Звіт поточних залишків партій', dimensions: 4, values: [0, '', 0.00000001] },
])('native current slice $source actual XLSX viewer', ({ rows, title, dimensions, values }) => {
  it('imports the merged XLSX binary and exports only the original snapshot identities and quantity precision', async () => {
    vi.clearAllMocks()
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Page.View)
    allowedPermissions.add(PermissionKeys.ReportsSaleFile.Document.Export)
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!merges'] = Array.from({ length: 8 }, (_, row) => ({ s: { r: row, c: 0 }, e: { r: row, c: dimensions } }))
    XLSX.utils.book_append_sheet(workbook, sheet, 'Report')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const { container } = renderPage()
    fireEvent.change(screen.getByLabelText('Завантажити файл'), {
      target: { files: [new File([bytes], 'current-slice.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] },
    })
    await screen.findByText(title)
    expect(screen.queryByLabelText('Від')).toBeNull()
    expect(screen.queryByLabelText('До')).toBeNull()
    expect(container.querySelector('.reports-sale-table')?.textContent).toContain('0,00000001')
    fireEvent.click(screen.getByLabelText('Експорт CSV'))
    expect(downloadTextFile).toHaveBeenCalledOnce()
    const csv = vi.mocked(downloadTextFile).mock.calls[0][1]
    const imported = buildSpreadsheetSheet('current-slice.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.header?.lines[0]).toBe(title)
    expect(imported.header?.lines[2]).toBe('Час читання (UTC): 07.09.2026 18:00:00.000 – 07.09.2026 18:00:00.120')
    expect(imported.rows.find(row => row.kind === 'total')?.cells.slice(dimensions)).toEqual([''])
    expect(imported.rows.filter(row => row.kind === 'data').map(row => row.cells[dimensions])).toEqual(values)
  })
})
