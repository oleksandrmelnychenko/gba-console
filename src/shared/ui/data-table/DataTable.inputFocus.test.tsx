import { MantineProvider, TextInput } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DataTable } from './DataTable'
import type { DataTableColumn } from './types'

type Row = { id: string; value: string }

/* Columns memoized on the row data, as many feature grids do: the column list is
   rebuilt on every keystroke. */
function EditableGrid() {
  const [rows, setRows] = useState<Row[]>([{ id: 'row-1', value: '' }])
  const columns = useMemo<DataTableColumn<Row>[]>(() => [{
    id: 'value',
    header: 'Значення',
    accessor: (row) => row.value,
    cell: (row) => (
      <TextInput
        aria-label={`Значення ${rows.findIndex((candidate) => candidate.id === row.id) + 1}`}
        value={row.value}
        onChange={(event) => {
          const next = event.currentTarget.value
          setRows((current) => current.map((candidate) => (candidate.id === row.id ? { ...candidate, value: next } : candidate)))
        }}
      />
    ),
  }], [rows])

  return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} layoutVersion="focus-1" tableId="focus-test" />
}

describe('DataTable inputs inside rows', () => {
  it('keeps focus and every typed character when the columns are rebuilt per keystroke', async () => {
    render(<MantineProvider><I18nProvider><EditableGrid /></I18nProvider></MantineProvider>)

    await userEvent.type(screen.getByLabelText('Значення 1'), '12,5')

    const input = screen.getByLabelText('Значення 1') as HTMLInputElement
    expect(input.value).toBe('12,5')
    expect(document.activeElement).toBe(input)
  })
})
