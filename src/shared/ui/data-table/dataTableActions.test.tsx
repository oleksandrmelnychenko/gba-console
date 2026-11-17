import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  getDataTableActionColumnIds,
  measureActionColumnFitWidth,
  pinDataTableActionsRight,
  prepareDataTableColumns,
} from './dataTableActions'
import type { DataTableColumn } from './types'

type Row = { id: number }

function rect(left: number, width: number): DOMRect {
  return { left, right: left + width, width, top: 0, bottom: 24, height: 24, x: left, y: 0, toJSON: () => ({}) } as DOMRect
}

describe('measureActionColumnFitWidth', () => {
  function renderCells(spans: number[][]) {
    const root = document.createElement('table')
    for (const icons of spans) {
      const row = root.insertRow()
      const cell = row.insertCell()
      cell.dataset.columnId = 'actions'
      icons.forEach((left) => {
        const button = document.createElement('button')
        button.getBoundingClientRect = () => rect(left, 24)
        cell.appendChild(button)
      })
    }
    return root
  }

  it('fits the widest row of icons plus the cell padding', () => {
    // Row 1: one icon; row 2: two icons 4px apart (span 52px).
    expect(measureActionColumnFitWidth(renderCells([[100], [100, 128]]), 'actions')).toBe(68)
  })

  it('never goes below one 40px action slot', () => {
    const root = renderCells([[100]])
    root.querySelector('button')!.getBoundingClientRect = () => rect(100, 16)
    expect(measureActionColumnFitWidth(root, 'actions')).toBe(40)
  })

  it('returns null when nothing is rendered or measurable', () => {
    expect(measureActionColumnFitWidth(renderCells([]), 'actions')).toBeNull()
    const root = renderCells([[0]])
    root.querySelector('button')!.getBoundingClientRect = () => rect(0, 0)
    expect(measureActionColumnFitWidth(root, 'actions')).toBeNull()
  })
})

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
      // 8px cell padding each side + three 24px icons + two 4px gaps.
      width: 96,
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
