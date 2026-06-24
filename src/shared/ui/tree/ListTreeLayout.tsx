import { Card } from '@mantine/core'
import { type ReactNode } from 'react'
import './list-tree-layout.css'

export type ListTreeLayoutProps = {
  /** Left pane — a selectable entity list (filter + <ListTreeItem>s). */
  list: ReactNode
  /** Right pane — the detail / <TreeView>. */
  detail: ReactNode
  className?: string
}

/**
 * Two-pane «list + tree» layout (the «Ролі» screen pattern, generalized):
 * a left list card and a right detail/tree card. Collapses to one column on narrow screens.
 */
export function ListTreeLayout({ list, detail, className }: ListTreeLayoutProps) {
  return (
    <div className={className ? `list-tree-layout ${className}` : 'list-tree-layout'}>
      <Card className="app-section-card" withBorder radius="md" padding="md">
        {list}
      </Card>
      <Card className="app-section-card" withBorder radius="md" padding="md">
        {detail}
      </Card>
    </div>
  )
}

export type ListTreeItemMetric = {
  value: ReactNode
  label: ReactNode
}

export type ListTreeItemProps = {
  /** Primary label. */
  name: ReactNode
  /** Selected/active highlight. */
  selected?: boolean
  onSelect?: () => void
  /** Optional leading 1-based index badge. */
  index?: number
  /** Optional compact metrics pill (e.g. counts). */
  metrics?: ListTreeItemMetric[]
  /** Optional trailing action (e.g. edit). */
  action?: ReactNode
  /** Accessible label for the select button (defaults to name when string). */
  selectLabel?: string
}

/** A selectable row for the left list pane — generalized from the role list item. */
export function ListTreeItem({ name, selected = false, onSelect, index, metrics, action, selectLabel }: ListTreeItemProps) {
  const hasIndex = typeof index === 'number'

  return (
    <div className={`list-tree-item${selected ? ' is-selected' : ''}`}>
      <button
        aria-pressed={selected}
        aria-label={selectLabel ?? (typeof name === 'string' ? name : undefined)}
        className="list-tree-item-select"
        type="button"
        onClick={onSelect}
      >
        <span className={`list-tree-item-content${hasIndex ? '' : ' no-index'}`}>
          {hasIndex ? <span className="list-tree-item-index">{String(index + 1).padStart(2, '0')}</span> : null}
          <span className="list-tree-item-name">{name}</span>
          {metrics && metrics.length > 0 ? (
            <span className="list-tree-item-details">
              {metrics.map((metric, metricIndex) => (
                <span key={metricIndex} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {metricIndex > 0 ? <span aria-hidden="true" className="list-tree-item-metric-divider" /> : null}
                  <span className="list-tree-item-metric">
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </span>
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
      {action ? <div className="list-tree-item-action">{action}</div> : null}
    </div>
  )
}
