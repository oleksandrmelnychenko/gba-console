import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DataTable } from './DataTable'
import type { DataTableColumn } from './types'

type Row = { id: string; qty: number }

describe('DataTable header cells', () => {
  it('never nest a button from the header content inside the sortable header (WH2-24)', () => {
    const columns: DataTableColumn<Row>[] = [{
      id: 'qty',
      header: <span>Колонка <button type="button">Видалити колонку</button></span>,
      accessor: (row) => row.qty,
    }]
    const { container } = render(
      <MantineProvider><I18nProvider>
        <DataTable columns={columns} data={[{ id: 'a', qty: 1 }]} getRowId={(row) => row.id} layoutVersion="nest-1" tableId="nest-test" />
      </I18nProvider></MantineProvider>,
    )

    expect(container.querySelectorAll('button button')).toHaveLength(0)
    expect(container.querySelector('.data-table-header-button')?.getAttribute('role')).toBe('button')
  })
})
