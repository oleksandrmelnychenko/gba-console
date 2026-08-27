import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DataTable } from './DataTable'

type ProductRow = {
  code: string
}

function renderTable(onRowClick?: (row: ProductRow) => void) {
  render(
    <MantineProvider>
      <I18nProvider>
        <DataTable
          columns={[
            {
              id: 'code',
              header: 'Код товару',
              accessor: (row) => row.code,
            },
          ]}
          data={[{ code: '0103002797-MG' }]}
          minWidth={320}
          showLayoutControls={false}
          tableId="product-storage-copy-test"
          onRowClick={onRowClick}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('DataTable row text selection', () => {
  it('does not advertise a row click when the consumer has no permitted action', () => {
    renderTable()

    const row = screen.getByText('0103002797-MG').closest('tr')

    expect(row?.classList.contains('data-table-row-clickable')).toBe(false)
    fireEvent.click(screen.getByText('0103002797-MG'))
  })

  it('advertises a row click only when the consumer provides an action', () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)

    const row = screen.getByText('0103002797-MG').closest('tr')

    expect(row?.classList.contains('data-table-row-clickable')).toBe(true)
  })

  it('keeps drag-selected product text from triggering the row action', () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)

    const code = screen.getByText('0103002797-MG')
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(code)
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.click(code)

    expect(onRowClick).not.toHaveBeenCalled()
    expect(selection?.toString()).toBe('0103002797-MG')
  })

  it('continues to trigger the row action for a regular click', () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)

    window.getSelection()?.removeAllRanges()
    fireEvent.click(screen.getByText('0103002797-MG'))

    expect(onRowClick).toHaveBeenCalledOnce()
    expect(onRowClick).toHaveBeenCalledWith({ code: '0103002797-MG' })
  })
})
