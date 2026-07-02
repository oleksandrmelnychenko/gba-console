import type { CSSProperties } from 'react'
import type { Column } from '@tanstack/react-table'

// Shared identity for the unpinned case so memoized consumers don't see a fresh
// object on every render.
const UNPINNED_STYLE: CSSProperties = Object.freeze({})

export function getPinnedStyle<TData>(
  column: Column<TData, unknown>,
  zIndex: number,
  leftOffset = 0,
): CSSProperties {
  const pinned = column.getIsPinned()

  if (!pinned) {
    return UNPINNED_STYLE
  }

  return {
    background: 'var(--data-table-cell-bg, var(--mantine-color-white))',
    boxShadow:
      pinned === 'left'
        ? '1px 0 0 var(--mantine-color-gray-2)'
        : '-1px 0 0 var(--mantine-color-gray-2)',
    left:
      pinned === 'left'
        ? `${Math.round(column.getStart('left')) + leftOffset}px`
        : undefined,
    position: 'sticky',
    right: pinned === 'right' ? `${Math.round(column.getAfter('right'))}px` : undefined,
    zIndex,
  }
}
