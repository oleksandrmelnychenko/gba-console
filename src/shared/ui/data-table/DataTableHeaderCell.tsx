import { memo, useEffect, useState, type CSSProperties } from 'react'
import {
  ActionIcon,
  Group,
  Menu,
  Table,
  UnstyledButton,
} from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconEyeOff,
  IconPinned,
  IconPinnedFilled,
  IconPinnedOff,
  IconSortAscending,
} from '@tabler/icons-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flexRender, type Column, type Header } from '@tanstack/react-table'
import type { DataTableColumnMeta, DataTableLabels } from './types'

type PinnedSide = false | 'left' | 'right'

type DataTableHeaderCellProps<TData> = {
  columnWidth: number
  header: Header<TData, unknown>
  isColumnDragActive: boolean
  isFillColumn: boolean
  isResizing: boolean
  labels: Required<DataTableLabels>
  pinned: PinnedSide
  pinnedLeftPx?: number
  pinnedRightPx?: number
  showLayoutControls: boolean
  sorted: false | 'asc' | 'desc'
}

type DataTableHeaderMenuProps<TData> = {
  column: Column<TData, unknown>
  isColumnDragActive: boolean
  labels: Required<DataTableLabels>
}

/* The kebab menu is extracted and memoized: during a column drag every
   pointermove re-renders every header cell (dnd-kit context), and re-running a
   Mantine Menu/Popover hook tree per column per move is the main header cost.
   The menu is also CONTROLLED so an active drag closes it — otherwise an open
   dropdown hangs detached while its column moves. */
function DataTableHeaderMenuInner<TData>({
  column,
  isColumnDragActive,
  labels,
}: DataTableHeaderMenuProps<TData>) {
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (isColumnDragActive && opened) {
      setOpened(false)
    }
  }, [isColumnDragActive, opened])

  return (
    <Menu
      opened={opened}
      width={180}
      position="bottom-end"
      withArrow
      withinPortal
      /* duration 0 is load-bearing: Mantine's 150ms exit Transition is killed
         when the owning <th> is DOM-moved later among siblings during the exit
         window (drop after a drag, unpin, pin-right) — the portal dropdown then
         NEVER unmounts and haunts the page as a detached phantom. */
      transitionProps={{ duration: 0 }}
      /* hideDetached would display:none the OPEN dropdown whenever the hover-only
         kebab target collapses (pointer travelling to a menu item). */
      hideDetached={false}
      onChange={setOpened}
    >
      <Menu.Target>
        <ActionIcon
          aria-label={labels.columns}
          className="data-table-column-menu"
          size="xs"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            setOpened((current) => !current)
          }}
        >
          <IconDotsVertical size={14} stroke={1.8} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {column.getCanPin() ? (
          <>
            <Menu.Item
              leftSection={<IconPinned size={15} stroke={1.8} />}
              onClick={() => column.pin('left')}
            >
              {labels.pinLeft}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconPinned size={15} stroke={1.8} />}
              onClick={() => column.pin('right')}
            >
              {labels.pinRight}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconPinnedOff size={15} stroke={1.8} />}
              onClick={() => column.pin(false)}
            >
              {labels.unpin}
            </Menu.Item>
          </>
        ) : null}
        {column.getCanHide() ? (
          <Menu.Item
            color="red"
            leftSection={<IconEyeOff size={15} stroke={1.8} />}
            onClick={() => column.toggleVisibility(false)}
          >
            {labels.hideColumn}
          </Menu.Item>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  )
}

const DataTableHeaderMenu = memo(DataTableHeaderMenuInner) as typeof DataTableHeaderMenuInner

function createPinnedStyle(
  pinned: PinnedSide,
  pinnedLeftPx: number | undefined,
  pinnedRightPx: number | undefined,
): CSSProperties | undefined {
  if (!pinned) {
    return undefined
  }

  return {
    background: 'var(--data-table-cell-bg, var(--mantine-color-white))',
    boxShadow:
      pinned === 'left'
        ? '1px 0 0 var(--mantine-color-gray-2)'
        : '-1px 0 0 var(--mantine-color-gray-2)',
    left: pinned === 'left' ? `${pinnedLeftPx ?? 0}px` : undefined,
    position: 'sticky',
    right: pinned === 'right' ? `${pinnedRightPx ?? 0}px` : undefined,
    zIndex: 3,
  }
}

function DataTableHeaderCellInner<TData>({
  columnWidth,
  header,
  isColumnDragActive,
  isFillColumn,
  isResizing,
  labels,
  pinned,
  pinnedLeftPx,
  pinnedRightPx,
  showLayoutControls,
  sorted,
}: DataTableHeaderCellProps<TData>) {
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined
  const canReorder = showLayoutControls && meta?.enableReorder !== false
  const canSort = header.column.getCanSort()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
    disabled: !canReorder,
  })

  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const sortLabel =
    sorted === 'asc'
      ? labels.sortAscending
      : sorted === 'desc'
        ? labels.sortDescending
        : labels.sortAscending

  return (
    <Table.Th
      ref={setNodeRef}
      ta="left"
      className={`data-table-th ${isDragging ? 'is-dragging' : ''}`}
      style={{
        ...createPinnedStyle(pinned, pinnedLeftPx, pinnedRightPx),
        ...dragStyle,
        width: columnWidth,
        minWidth: header.column.columnDef.minSize,
        maxWidth: isFillColumn ? undefined : header.column.columnDef.maxSize,
        textAlign: 'left',
      }}
    >
      <Group className="data-table-header-inner" gap={6} wrap="nowrap" justify="flex-start">
        <UnstyledButton
          {...(canReorder ? attributes : {})}
          {...(canReorder ? listeners : {})}
          className="data-table-header-button"
          data-reorderable={canReorder ? 'true' : undefined}
          data-sortable={canSort ? 'true' : undefined}
          title={canSort ? sortLabel : canReorder ? labels.dragColumn : undefined}
          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        >
          <span className="data-table-header-label">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {showLayoutControls && pinned ? (
            <span
              aria-label={labels.pinnedColumn}
              className="data-table-pinned-icon"
              title={labels.pinnedColumn}
            >
              <IconPinnedFilled size={12} stroke={1.8} />
            </span>
          ) : null}
          {canSort ? (
            <span className="data-table-sort-icon" data-sorted={sorted ? 'true' : 'false'} aria-label={sortLabel}>
              {sorted === 'asc' ? (
                <IconChevronUp size={14} stroke={2} />
              ) : sorted === 'desc' ? (
                <IconChevronDown size={14} stroke={2} />
              ) : (
                <IconSortAscending size={14} stroke={1.8} />
              )}
            </span>
          ) : null}
        </UnstyledButton>

        {showLayoutControls ? (
          <DataTableHeaderMenu
            column={header.column}
            isColumnDragActive={isColumnDragActive}
            labels={labels}
          />
        ) : null}
      </Group>

      {header.column.getCanResize() ? (
        <button
          aria-label={labels.resizeColumn}
          className={`data-table-resizer ${isResizing ? 'is-resizing' : ''}`}
          type="button"
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
        />
      ) : null}
    </Table.Th>
  )
}

/* Memoized: header identity is stable across unrelated renders (TanStack caches
   header groups per state), and every dynamic bit the cell renders arrives as a
   primitive prop (sorted / isResizing / pinned offsets / width). */
export const DataTableHeaderCell = memo(DataTableHeaderCellInner) as typeof DataTableHeaderCellInner
