import { ActionIcon, Box, Collapse, Group, Loader, Text, ThemeIcon } from '@mantine/core'
import { Check, ChevronRight, Minus } from 'lucide-react'
import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import './tree.css'

export type TreeSelectionState = 'checked' | 'indeterminate' | 'unchecked'

export type TreeViewNode = {
  /** Stable unique id (used for expand state + keys). */
  id: string
  /** Primary label. */
  label: ReactNode
  /** Optional small meta line under the label (counts, route, etc.). */
  meta?: ReactNode
  /** Optional leading icon. */
  icon?: ReactNode
  /** Optional right-aligned badges. */
  badges?: ReactNode
  /** Optional right-aligned action buttons. */
  actions?: ReactNode
  /** Child nodes (rendered recursively, indented). */
  children?: TreeViewNode[]
  /** Force the disclosure chevron even before children are loaded (lazy trees). */
  hasChildren?: boolean
  /** Children are being loaded — shows a spinner inside the expanded node. */
  loading?: boolean
  /** Called the first time the node is expanded — use to lazy-load children. */
  onExpand?: () => void
  /** When set, a tri-state selection mark is shown. */
  selection?: TreeSelectionState
  /** Toggle handler for the selection mark. */
  onToggleSelect?: () => void
  /** Row click (e.g. open in a detail pane). */
  onActivate?: () => void
  /** Highlights the row as active/selected. */
  active?: boolean
  /** Expand this node by default. */
  defaultExpanded?: boolean
}

export type TreeViewProps = {
  nodes: TreeViewNode[]
  /** Auto-expand nodes down to this depth (0 = only roots expanded). */
  defaultExpandedDepth?: number
  emptyText?: ReactNode
  /** Optional toolbar rendered above the tree (e.g. "select all" + stats). */
  toolbar?: ReactNode
  className?: string
}

/**
 * Generic recursive tree — the «Ролі» permission-tree pattern, generalized for
 * reuse: expand/collapse with indentation, an optional tri-state selection mark,
 * per-node icon / meta / badges / actions, and an optional toolbar.
 */
export function TreeView({ nodes, defaultExpandedDepth = 0, emptyText, toolbar, className }: TreeViewProps) {
  const { t } = useI18n()
  const initialExpanded = useMemo(() => collectDefaultExpanded(nodes, defaultExpandedDepth), [nodes, defaultExpandedDepth])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(initialExpanded)

  const toggleExpand = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (nodes.length === 0) {
    return <Box className={joinClass('app-tree', className)}>{emptyText ? <div className="app-tree-empty">{emptyText}</div> : null}</Box>
  }

  return (
    <Box className={joinClass('app-tree', className)}>
      {toolbar ? <div className="app-tree-toolbar">{toolbar}</div> : null}
      <div className="app-tree-nodes">
        {nodes.map((node) => (
          <TreeRow key={node.id} depth={0} expanded={expanded} node={node} onToggleExpand={toggleExpand} t={t} />
        ))}
      </div>
    </Box>
  )
}

type TreeRowProps = {
  node: TreeViewNode
  depth: number
  expanded: ReadonlySet<string>
  onToggleExpand: (id: string) => void
  t: (value: string) => string
}

function TreeRow({ node, depth, expanded, onToggleExpand, t }: TreeRowProps) {
  const children = node.children || []
  const hasChildren = children.length > 0 || Boolean(node.hasChildren)
  const isOpen = expanded.has(node.id)
  const style = { '--app-tree-indent': `${depth * 18}px` } as CSSProperties

  function handleToggle() {
    const willOpen = !isOpen
    onToggleExpand(node.id)
    if (willOpen) {
      node.onExpand?.()
    }
  }

  return (
    <Box className={`app-tree-node${node.active ? ' is-active' : ''}`} style={style}>
      <div className="app-tree-node-row">
        {hasChildren ? (
          <ActionIcon
            aria-expanded={isOpen}
            aria-label={isOpen ? t('Згорнути') : t('Розгорнути')}
            className="app-tree-disclosure"
            color="gray"
            size="sm"
            variant="subtle"
            onClick={handleToggle}
          >
            <ChevronRight size={16} strokeWidth={2} style={{ transform: isOpen ? 'rotate(90deg)' : undefined }} />
          </ActionIcon>
        ) : (
          <span className="app-tree-disclosure-spacer" aria-hidden="true" />
        )}

        {node.selection ? (
          <SelectionMark
            label={t('Вибрати')}
            state={node.selection}
            onToggle={node.onToggleSelect}
          />
        ) : null}

        {node.icon ? (
          <ThemeIcon className="app-tree-node-icon" color="gray" size={26} variant="light">
            {node.icon}
          </ThemeIcon>
        ) : null}

        <button
          className="app-tree-node-title"
          disabled={!node.onActivate && !hasChildren}
          type="button"
          onClick={node.onActivate ?? (hasChildren ? handleToggle : undefined)}
        >
          <span className="app-tree-node-name">{node.label}</span>
          {node.meta ? <span className="app-tree-node-meta">{node.meta}</span> : null}
        </button>

        {node.badges ? <div className="app-tree-node-badges">{node.badges}</div> : null}
        {node.actions ? <div className="app-tree-node-actions">{node.actions}</div> : null}
      </div>

      {hasChildren ? (
        <Collapse expanded={isOpen}>
          <div className="app-tree-children">
            {node.loading ? (
              <Group className="app-tree-loading" gap="xs">
                <Loader size="xs" />
                <Text c="dimmed" size="xs">
                  {t('Завантаження')}
                </Text>
              </Group>
            ) : children.length > 0 ? (
              children.map((child) => (
                <TreeRow key={child.id} depth={depth + 1} expanded={expanded} node={child} onToggleExpand={onToggleExpand} t={t} />
              ))
            ) : null}
          </div>
        </Collapse>
      ) : null}
    </Box>
  )
}

type SelectionMarkProps = {
  state: TreeSelectionState
  label: string
  disabled?: boolean
  onToggle?: () => void
}

/** Tri-state checkbox (checked / indeterminate / unchecked), styled as .app-tree-check. */
export function SelectionMark({ state, label, disabled = false, onToggle }: SelectionMarkProps) {
  const checked = state === 'checked'
  const indeterminate = state === 'indeterminate'

  return (
    <button
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      className={`app-tree-check${checked ? ' is-selected' : ''}${indeterminate ? ' is-indeterminate' : ''}`}
      disabled={disabled || !onToggle}
      role="checkbox"
      type="button"
      onClick={onToggle}
    >
      {indeterminate ? <Minus size={11} strokeWidth={2.2} /> : checked ? <Check size={11} strokeWidth={2.2} /> : null}
    </button>
  )
}

function collectDefaultExpanded(nodes: TreeViewNode[], maxDepth: number, depth = 0, acc: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.defaultExpanded || depth <= maxDepth) {
      acc.add(node.id)
    }
    if (node.children?.length) {
      collectDefaultExpanded(node.children, maxDepth, depth + 1, acc)
    }
  }
  return acc
}

function joinClass(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base
}
