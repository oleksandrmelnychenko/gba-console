import type { CSSProperties } from 'react'
import type { Column } from '@tanstack/react-table'

export function getPinnedStyle<TData>(
  column: Column<TData, unknown>,
  zIndex: number,
): CSSProperties {
  const pinned = column.getIsPinned()

  if (!pinned) {
    return {}
  }

  return {
    background: 'var(--data-table-cell-bg, var(--mantine-color-white))',
    boxShadow:
      pinned === 'left'
        ? '1px 0 0 var(--mantine-color-gray-2)'
        : '-1px 0 0 var(--mantine-color-gray-2)',
    left: pinned === 'left' ? `${Math.round(column.getStart('left'))}px` : undefined,
    position: 'sticky',
    right: pinned === 'right' ? `${Math.round(column.getAfter('right'))}px` : undefined,
    zIndex,
  }
}
