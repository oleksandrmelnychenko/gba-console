import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DataTable } from './DataTable'

const data = [{ code: 'C' }, { code: 'A' }, { code: 'D' }, { code: 'B' }]
const columns = [{ id: 'code', header: 'Код', accessor: (row: { code: string }) => row.code }]

function table(pagination?: PaginationState, sorting: SortingState = []) {
  return (
    <MantineProvider>
      <I18nProvider>
        <DataTable
          columns={columns}
          data={data}
          tableId="controlled-pagination-test"
          showToolbar={false}
          pagination={pagination}
          sorting={sorting}
        />
      </I18nProvider>
    </MantineProvider>
  )
}

function visibleCodes() {
  // JSDOM has no measured viewport width, so the table awaits sizing while its rows exist.
  return within(screen.getByRole('table', { hidden: true }))
    .getAllByRole('cell', { hidden: true })
    .map((cell) => cell.textContent)
}

describe('DataTable client pagination', () => {
  it('sorts the full data before selecting the controlled page', () => {
    render(table({ pageIndex: 1, pageSize: 2 }, [{ id: 'code', desc: false }]))

    expect(visibleCodes()).toEqual(['C', 'D'])
  })

  it('keeps the controlled page when sorting changes and follows page size changes', () => {
    const { rerender } = render(table({ pageIndex: 1, pageSize: 2 }))
    expect(visibleCodes()).toEqual(['D', 'B'])

    rerender(table({ pageIndex: 1, pageSize: 2 }, [{ id: 'code', desc: true }]))
    expect(visibleCodes()).toEqual(['B', 'A'])

    rerender(table({ pageIndex: 0, pageSize: 3 }))
    expect(visibleCodes()).toEqual(['C', 'A', 'D'])
  })

  it('shows all rows without pagination, including when pagination is removed', () => {
    const { rerender } = render(table())
    expect(visibleCodes()).toEqual(['C', 'A', 'D', 'B'])

    rerender(table({ pageIndex: 0, pageSize: 2 }))
    expect(visibleCodes()).toEqual(['C', 'A'])

    rerender(table())
    expect(visibleCodes()).toEqual(['C', 'A', 'D', 'B'])
  })
})
