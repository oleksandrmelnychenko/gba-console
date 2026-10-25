import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DataTable } from './DataTable'

it('renders only rows whose selection class changes, even with a new class callback', () => {
  const data = Array.from({ length: 30 }, (_, index) => ({ code: `product-${index}` }))
  const cell = vi.fn((row: typeof data[number]) => row.code)
  const columns = [{ id: 'code', header: 'Код', cell }]
  function table(selected: number) {
    return (
      <MantineProvider>
        <I18nProvider>
          <DataTable
            columns={columns}
            data={data}
            showToolbar={false}
            tableId="cart-selection-render-test"
            rowClassName={(row) => row === data[selected] ? 'is-selected' : undefined}
          />
        </I18nProvider>
      </MantineProvider>
    )
  }

  const { rerender } = render(table(0))
  cell.mockClear()
  rerender(table(1))
  expect(cell.mock.calls.map(([row]) => row.code)).toEqual(['product-0', 'product-1'])
  expect(screen.getByText('product-0').closest('tr')?.classList.contains('is-selected')).toBe(false)
  expect(screen.getByText('product-1').closest('tr')?.classList.contains('is-selected')).toBe(true)

  cell.mockClear()
  rerender(table(1))
  expect(cell).not.toHaveBeenCalled()
  rerender(table(-1))
  expect(cell).toHaveBeenCalledExactlyOnceWith(data[1])
  expect(screen.getByText('product-1').closest('tr')?.classList.contains('is-selected')).toBe(false)
})
