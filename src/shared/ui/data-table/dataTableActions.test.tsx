import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  getDataTableActionColumnIds,
  pinDataTableActionsRight,
  prepareDataTableColumns,
} from './dataTableActions'
import type { DataTableColumn } from './types'

type Row = { id: number }

describe('DataTable row-action columns', () => {
  it('merges separate row controls into one actions column', () => {
    const columns: DataTableColumn<Row>[] = [
      { id: 'name', header: 'Name' },
      { id: 'reassign', header: '', cell: () => <button>Reassign</button> },
      { id: 'cancel', header: '', cell: () => <button>Cancel</button> },
      { id: 'actions', header: '', cell: () => <button>Details</button> },
    ]

    const prepared = prepareDataTableColumns(columns)
    const actionColumn = prepared.find((column) => column.id === 'actions')

    expect(prepared.map((column) => column.id)).toEqual(['name', 'actions'])
    expect(actionColumn).toMatchObject({
      enableHiding: false,
      enablePinning: false,
      enableReorder: false,
      enableResizing: false,
      enableSorting: false,
      rowActions: true,
      width: 108,
    })

    render(<>{actionColumn?.cell?.({ id: 1 })}</>)

    expect(screen.getByRole('button', { name: 'Reassign' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Details' })).toBeTruthy()
  })

  it('supports explicitly marked action columns with domain-specific ids', () => {
    const prepared = prepareDataTableColumns<Row>([
      { id: 'name', header: 'Name' },
      { id: 'incomeCashOrder', header: '', rowActions: true },
      { id: 'view', header: '' },
    ])

    expect(prepared.map((column) => column.id)).toEqual(['name', 'actions'])
  })

  it('merges action-suffixed columns', () => {
    const prepared = prepareDataTableColumns<Row>([
      { id: 'name', header: 'Name' },
      { id: 'printAction', header: '' },
      { id: 'downloadAction', header: '' },
      { id: 'viewAction', header: '' },
    ])

    expect(prepared.map((column) => column.id)).toEqual(['name', 'actions'])
  })

  it('does not treat a decorative status column as row controls', () => {
    const columns: DataTableColumn<Row>[] = [
      { id: 'name', header: 'Name' },
      { id: 'cheaperAlt', header: '' },
      { id: 'action', header: 'Recommendation' },
    ]

    expect(prepareDataTableColumns(columns)).toBe(columns)
  })

  it('pins the single prepared action column after existing right pins', () => {
    const columns = prepareDataTableColumns<Row>([
      { id: 'name', header: 'Name' },
      { id: 'actions', header: '' },
    ])
    const actionColumnIds = getDataTableActionColumnIds(columns)

    expect(
      pinDataTableActionsRight(
        { left: ['actions', 'name'], right: ['total'] },
        actionColumnIds,
      ),
    ).toEqual({
      left: ['name'],
      right: ['total', 'actions'],
    })
  })
})
