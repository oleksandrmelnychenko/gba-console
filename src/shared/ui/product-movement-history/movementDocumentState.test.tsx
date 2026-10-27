import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import type { DataTableColumn } from '../data-table/types'
import { formatInformationalQty, getShortMovementDocumentState, isInformationalMovement, withInlineMovementDocumentState, withMovementDocumentStateColumns, type MovementDocumentStateRow } from './movementDocumentState'

type Row = MovementDocumentStateRow & { OutcomeQty?: number }

const t = (key: string) => key
const base: DataTableColumn<Row>[] = [
  { id: 'number', header: 'Номер', accessor: () => 'КОк00001761' },
  { id: 'outcomeQty', header: 'Розхід', accessor: (row) => row.OutcomeQty },
  { id: 'comment', header: 'Коментар', accessor: () => '' },
]

describe('movement document state columns', () => {
  it('appends the state and the non-physical quantity after every existing column so saved layouts keep their order', () => {
    const columns = withMovementDocumentStateColumns(base, t)
    expect(columns.map((column) => column.id)).toEqual(['number', 'outcomeQty', 'comment', 'documentState', 'informationalQty'])
  })

  it('shows reserved quantity only on informational rows and never in the physical column', () => {
    const reserved: Row = { DocumentState: 'Резерв — ще не списано зі складу', InformationalQty: 18, OutcomeQty: 0 }
    const physical: Row = { DocumentState: null, InformationalQty: 0, OutcomeQty: 4 }
    expect(isInformationalMovement(reserved)).toBe(true)
    expect(isInformationalMovement(physical)).toBe(false)
    expect(formatInformationalQty(reserved)).toBe('18')
    expect(formatInformationalQty(physical)).toBe('—')
    const columns = withMovementDocumentStateColumns(base, t)
    const quantity = columns.find((column) => column.id === 'informationalQty')!
    expect(quantity.accessor?.(reserved)).toBe(18)
    expect(quantity.accessor?.(physical)).toBeUndefined()
    const state = columns.find((column) => column.id === 'documentState')!
    render(<MantineProvider>{state.cell?.(reserved)}</MantineProvider>)
    expect(screen.getByText('Резерв — ще не списано зі складу')).toBeTruthy()
    expect(state.cell?.(physical)).toBe('—')
  })

  it('marks informational rows inside the compact quantity column without changing its physical value', () => {
    const columns = withInlineMovementDocumentState(base, 'outcomeQty', t)
    expect(columns.map((column) => column.id)).toEqual(['number', 'outcomeQty', 'comment'])
    const quantity = columns[1]
    const reserved: Row = { DocumentState: 'Резерв — ще не списано зі складу', InformationalQty: 7, OutcomeQty: 0 }
    expect(quantity.accessor?.(reserved)).toBe(0)
    expect(getShortMovementDocumentState(reserved.DocumentState!)).toBe('Резерв')
    render(<MantineProvider>{quantity.cell?.(reserved)}</MantineProvider>)
    expect(screen.getByText('7 · Резерв')).toBeTruthy()
  })
})
