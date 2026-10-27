import type { DataTableColumn } from '../data-table/types'
import { TableChip } from '../TableChip'

export type MovementDocumentStateRow = {
  DocumentState?: string | null
  InformationalQty?: number | null
}

const quantityFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function isInformationalMovement(row: MovementDocumentStateRow): boolean {
  return Boolean(row.DocumentState)
}

export function formatInformationalQty(row: MovementDocumentStateRow): string {
  if (!isInformationalMovement(row) || row.InformationalQty == null || !Number.isFinite(row.InformationalQty)) return '—'
  return quantityFormat.format(row.InformationalQty)
}

export function withMovementDocumentStateColumns<T extends MovementDocumentStateRow>(
  columns: DataTableColumn<T>[],
  t: (key: string) => string,
): DataTableColumn<T>[] {
  const state: DataTableColumn<T> = {
    id: 'documentState', header: t('Стан документа'), minWidth: 170,
    accessor: (row) => row.DocumentState ?? '',
    cell: (row) => isInformationalMovement(row) ? <TableChip tone="warning" value={t(row.DocumentState!)} /> : '—',
  }
  const quantity: DataTableColumn<T> = {
    id: 'informationalQty', header: t('Без руху залишку'), minWidth: 110, align: 'right',
    accessor: (row) => isInformationalMovement(row) ? row.InformationalQty ?? undefined : undefined,
    cell: (row) => <span className="app-money">{formatInformationalQty(row)}</span>,
  }
  return [...columns, state, quantity]
}

export function getShortMovementDocumentState(state: string): string {
  const separator = state.indexOf(' — ')
  return separator > 0 ? state.slice(0, separator) : state
}

export function withInlineMovementDocumentState<T extends MovementDocumentStateRow>(
  columns: DataTableColumn<T>[],
  quantityColumnId: string,
  t: (key: string) => string,
): DataTableColumn<T>[] {
  return columns.map((column) => column.id !== quantityColumnId ? column : {
    ...column,
    cell: (row) => isInformationalMovement(row)
      ? <TableChip tone="warning" title={t(row.DocumentState!)}
        value={`${formatInformationalQty(row)} · ${t(getShortMovementDocumentState(row.DocumentState!))}`} />
      : column.cell?.(row),
  })
}
