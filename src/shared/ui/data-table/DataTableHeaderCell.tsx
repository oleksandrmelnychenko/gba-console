import type { CSSProperties } from 'react'
import {
  ActionIcon,
  Group,
  Menu,
  Table,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconEyeOff,
  IconGripVertical,
  IconPinned,
  IconPinnedFilled,
  IconPinnedOff,
  IconSortAscending,
} from '@tabler/icons-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flexRender, type Header } from '@tanstack/react-table'
import type { DataTableColumnMeta, DataTableLabels } from './types'

type DataTableHeaderCellProps<TData> = {
  columnWidth: number
  header: Header<TData, unknown>
  isFillColumn: boolean
  labels: Required<DataTableLabels>
  pinnedStyle: CSSProperties
}

export function DataTableHeaderCell<TData>({
  columnWidth,
  header,
  isFillColumn,
  labels,
  pinnedStyle,
}: DataTableHeaderCellProps<TData>) {
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined
  const canReorder = meta?.enableReorder !== false
  const canSort = header.column.getCanSort()
  const sorted = header.column.getIsSorted()
  const pinned = header.column.getIsPinned()

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
      className={`data-table-th ${isDragging ? 'is-dragging' : ''}`}
      style={{
        ...pinnedStyle,
        ...dragStyle,
        width: columnWidth,
        minWidth: header.column.columnDef.minSize,
        maxWidth: isFillColumn ? undefined : header.column.columnDef.maxSize,
        textAlign: 'left',
      }}
    >
      <Group className="data-table-header-inner" gap={6} wrap="nowrap" justify="flex-start">
        {canReorder ? (
          <Tooltip label={labels.dragColumn} withArrow>
            <ActionIcon
              {...attributes}
              {...listeners}
              aria-label={labels.dragColumn}
              className="data-table-drag-handle"
              size="xs"
              variant="subtle"
            >
              <IconGripVertical size={14} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
        ) : null}

        <UnstyledButton
          className="data-table-header-button"
          disabled={!canSort}
          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        >
          <span className="data-table-header-label">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {pinned ? (
            <span
              aria-label={labels.pinnedColumn}
              className="data-table-pinned-icon"
              title={labels.pinnedColumn}
            >
              <IconPinnedFilled size={12} stroke={1.8} />
            </span>
          ) : null}
          {canSort ? (
            <span className="data-table-sort-icon" aria-label={sortLabel}>
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

        <Menu width={180} position="bottom-end" withArrow withinPortal>
          <Menu.Target>
            <ActionIcon
              aria-label={labels.columns}
              className="data-table-column-menu"
              size="xs"
              variant="subtle"
              onClick={(event) => event.stopPropagation()}
            >
              <IconDotsVertical size={14} stroke={1.8} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {header.column.getCanPin() ? (
              <>
                <Menu.Item
                  leftSection={<IconPinned size={15} stroke={1.8} />}
                  onClick={() => header.column.pin('left')}
                >
                  {labels.pinLeft}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconPinned size={15} stroke={1.8} />}
                  onClick={() => header.column.pin('right')}
                >
                  {labels.pinRight}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconPinnedOff size={15} stroke={1.8} />}
                  onClick={() => header.column.pin(false)}
                >
                  {labels.unpin}
                </Menu.Item>
              </>
            ) : null}
            {header.column.getCanHide() ? (
              <Menu.Item
                color="red"
                leftSection={<IconEyeOff size={15} stroke={1.8} />}
                onClick={() => header.column.toggleVisibility(false)}
              >
                {labels.hideColumn}
              </Menu.Item>
            ) : null}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {header.column.getCanResize() ? (
        <button
          aria-label={labels.resizeColumn}
          className={`data-table-resizer ${
            header.column.getIsResizing() ? 'is-resizing' : ''
          }`}
          type="button"
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
        />
      ) : null}
    </Table.Th>
  )
}
