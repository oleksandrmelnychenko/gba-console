import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableProps } from '../../../shared/ui/data-table/types'
import { getSupplyReturnByNetId, getSupplyReturns } from '../api/supplyReturnsApi'
import type { SupplyReturn } from '../types'
import { SupplyReturnsPage } from './SupplyReturnsPage'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))

vi.mock('../api/supplyReturnsApi', () => ({
  exportSupplyReturnDocument: vi.fn(),
  getSupplyReturnByNetId: vi.fn(),
  getSupplyReturns: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section aria-label="Деталі повернення">{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: <T,>({ columns, data, tableId, onRowClick }: DataTableProps<T>) => (
    <table aria-label={tableId}>
      <tbody>
        {data.map((row, index) => (
          <tr key={index} onClick={() => onRowClick?.(row)}>
            {columns.map((column) => (
              <td key={column.id} data-testid={`${tableId}-${index}-${column.id}`} data-value={JSON.stringify(column.accessor?.(row))}>
                {column.cell ? column.cell(row) : String(column.accessor?.(row) ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

function createReturn(total: number | null): SupplyReturn {
  return {
    Id: 30031,
    NetUid: '2e0d887a-c34a-4d44-9a8f-8c0e3caffb53',
    Number: 'К0000000002',
    FromDate: '2026-07-07T00:00:00',
    OrganizationId: 10561,
    Organization: { Name: 'ТОВ «АМГ «КОНКОРД»' },
    TotalRowsQty: 1,
    TotalNetPrice: total,
    TotalNetWeight: total === null ? null : 0.23,
    SupplyReturnItems: [{
      Id: 30032,
      NetUid: '54a8566b-4b14-4323-8fbf-11f1d4f556e1',
      ProductId: 38168008,
      Product: { NetUid: 'e893c016-da17-4f9b-b248-dc2730b366eb', VendorCode: 'ADN12350', Name: 'Фильтр топливный' },
      Qty: 1,
      TotalNetPrice: total,
      TotalNetWeight: total === null ? null : 0.23,
    }],
  }
}

describe('Supplier return register valuation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    { total: null, display: '—' },
    { total: 9.47, display: '9,47' },
    { total: 0, display: '0,00' },
  ])('keeps $display in the register and loaded detail without losing the product', async ({ total, display }) => {
    vi.mocked(getSupplyReturns).mockResolvedValue({ items: [createReturn(total)], totalQty: 1 })
    render(<MantineProvider><I18nProvider><SupplyReturnsPage /></I18nProvider></MantineProvider>)

    const number = await screen.findByText('К0000000002')
    const row = number.closest('tr')!
    const amount = within(row).getByTestId('supply-returns-0-totalAmount')
    expect(amount.textContent).toBe(display)
    expect(amount.getAttribute('data-value')).toBe(JSON.stringify(total))
    expect(within(row).getAllByText('1').length).toBeGreaterThan(0)
    await waitFor(() => expect(getSupplyReturns).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 })))

    fireEvent.click(row)

    const details = await screen.findByRole('region', { name: 'Деталі повернення' })
    expect(within(details).getByText('ADN12350')).toBeTruthy()
    expect(within(details).getByText('Фильтр топливный')).toBeTruthy()
    expect(within(details).getByText('Вся сума').parentElement?.textContent).toContain(display)
    const itemRow = within(details).getByText('ADN12350').closest('tr')!
    expect(within(itemRow).getByText(display).getAttribute('data-value')).toBe(JSON.stringify(total))
    expect(getSupplyReturnByNetId).not.toHaveBeenCalled()
  })
})
