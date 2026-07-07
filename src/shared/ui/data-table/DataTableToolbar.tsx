import { useEffect, useState, type ReactNode } from 'react'
import { ActionIcon, Checkbox, Group, Menu, Tooltip } from '@mantine/core'
import { Check, Columns3, RotateCcw, Rows3, Rows4 } from 'lucide-react'
import type { Column, Table as TableInstance } from '@tanstack/react-table'
import type { DataTableDensity, DataTableLabels } from './types'

type DataTableToolbarProps<TData> = {
  columnTitles: Map<string, string>
  density: DataTableDensity
  isColumnDragActive?: boolean
  labels: Required<DataTableLabels>
  showLayoutControls: boolean
  showDensityToggle: boolean
  table: TableInstance<TData>
  toolbarLeft?: ReactNode
  toolbarRight?: ReactNode
  onDensityChange: (density: DataTableDensity) => void
  onResetLayout: () => void
}

export function DataTableToolbar<TData>({
  columnTitles,
  density,
  isColumnDragActive = false,
  labels,
  showLayoutControls,
  showDensityToggle,
  table,
  toolbarLeft,
  toolbarRight,
  onDensityChange,
  onResetLayout,
}: DataTableToolbarProps<TData>) {
  const [columnsMenuOpened, setColumnsMenuOpened] = useState(false)

  // An active column drag closes the menu — the portal dropdown would hang
  // detached from the toolbar while the table columns move.
  useEffect(() => {
    if (isColumnDragActive && columnsMenuOpened) {
      const animationFrameId = window.requestAnimationFrame(() => {
        setColumnsMenuOpened(false)
      })

      return () => window.cancelAnimationFrame(animationFrameId)
    }

    return undefined
  }, [columnsMenuOpened, isColumnDragActive])
  const isColumnsMenuOpened = columnsMenuOpened && !isColumnDragActive

  const hideableColumns = table
    .getAllLeafColumns()
    .reduce<Column<TData, unknown>[]>((result, column) => {
      if (column.getCanHide()) {
        result.push(column)
      }

      return result
    }, [])

  return (
    <Group className="data-table-toolbar" gap={8} wrap="nowrap">
      <Group className="data-table-toolbar-left" gap={8} wrap="nowrap">
        {showLayoutControls ? (
          <Menu
            opened={isColumnsMenuOpened}
            width={220}
            position="bottom-start"
            withArrow
            withinPortal
            /* duration 0: see DataTableHeaderCell — a killed exit transition
               leaks the portal dropdown permanently. */
            transitionProps={{ duration: 0 }}
            onChange={(opened) => setColumnsMenuOpened(isColumnDragActive ? false : opened)}
          >
            <Menu.Target>
              <Tooltip label={labels.columns} withArrow>
                <ActionIcon aria-label={labels.columns} size="sm" variant="subtle" color="gray">
                  <Columns3 size={17} strokeWidth={1.8} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown className="data-table-columns-dropdown" style={{ maxHeight: 'min(62vh, 440px)', overflowY: 'auto' }}>
              <Menu.Label>{labels.columns}</Menu.Label>
              {hideableColumns.map((column) => (
                <Menu.Item
                  key={column.id}
                  closeMenuOnClick={false}
                  leftSection={
                    <Checkbox
                      checked={column.getIsVisible()}
                      color="orange"
                      onChange={() => undefined}
                      readOnly
                      size="xs"
                    />
                  }
                  onClick={() => column.toggleVisibility(!column.getIsVisible())}
                >
                  {columnTitles.get(column.id) ?? column.id}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Label>{labels.density}</Menu.Label>
              <Menu.Item
                leftSection={<DensityCheck checked={density === 'compact'} />}
                onClick={() => onDensityChange('compact')}
              >
                {labels.compactDensity}
              </Menu.Item>
              <Menu.Item
                leftSection={<DensityCheck checked={density === 'normal'} />}
                onClick={() => onDensityChange('normal')}
              >
                {labels.normalDensity}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<RotateCcw size={16} strokeWidth={1.8} />}
                onClick={onResetLayout}
              >
                {labels.resetLayout}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : null}
        {toolbarLeft}
      </Group>
      <Group className="data-table-toolbar-right" gap={6} wrap="nowrap">
        {toolbarRight}
        {showDensityToggle ? (
          <Tooltip label={density === 'compact' ? labels.normalDensity : labels.compactDensity} withArrow>
            <ActionIcon
              aria-label={labels.density}
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => onDensityChange(density === 'compact' ? 'normal' : 'compact')}
            >
              {density === 'compact' ? (
                <Rows4 size={17} strokeWidth={1.8} />
              ) : (
                <Rows3 size={17} strokeWidth={1.8} />
              )}
            </ActionIcon>
          </Tooltip>
        ) : null}
      </Group>
    </Group>
  )
}

function DensityCheck({ checked }: { checked: boolean }) {
  return <Check size={15} strokeWidth={1.8} style={{ opacity: checked ? 1 : 0 }} />
}
