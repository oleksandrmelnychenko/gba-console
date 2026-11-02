import { useState, type ReactNode } from 'react'
import { ActionIcon, Text, TextInput, Tooltip } from '@mantine/core'
import { ChartColumnBig, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Search, Trash2 } from 'lucide-react'
import { canTransferReportGrouping, type ReportGroupingAxis, type ReportGroupingLayout } from '../../data/reportGroupingLayout'
import type { ConstructorField } from '../../data/constructorDesk'
import type { ReportGroupingItem } from '../../types'
import { ConstructorFieldDialog } from './ConstructorFieldDialog'

type Selected = { axis: ReportGroupingAxis; type: number } | null

export type ConstructorGroupingProps = {
  layout: ReportGroupingLayout
  allowed: ReadonlySet<number>
  locked: ReadonlySet<number>
  rowsOnly: boolean
  disabled?: boolean
  caption: (item: ReportGroupingItem) => string
  available: (axis: ReportGroupingAxis) => ConstructorField[]
  onAdd: (axis: ReportGroupingAxis, types: number[]) => void
  onRemove: (axis: ReportGroupingAxis, index: number) => void
  onReorder: (axis: ReportGroupingAxis, type: number, direction: -1 | 1) => void
  onTransfer: (axis: ReportGroupingAxis, type: number) => void
}

const TITLES: Record<ReportGroupingAxis, string> = { Row: 'Групування рядків', Col: 'Групування колонок' }
const DIALOG_TITLES: Record<ReportGroupingAxis, string> = { Row: 'Додати поле для групування рядків', Col: 'Додати поле для групування колонок' }

export function ConstructorGroupingPanels(props: ConstructorGroupingProps & { measures: ReactNode }) {
  const { layout, allowed, locked, rowsOnly, disabled = false, onTransfer } = props
  const [selected, setSelected] = useState<Selected>(null)
  const [dialog, setDialog] = useState<ReportGroupingAxis | null>(null)
  const current = selected && layout[selected.axis].some(item => item.type === selected.type) ? selected : null
  const transferable = (axis: ReportGroupingAxis) => !!current && current.axis === axis && !locked.has(current.type)
    && !rowsOnly && canTransferReportGrouping(layout, axis, current.type, allowed)
  const currentCaption = current ? props.caption(layout[current.axis].find(item => item.type === current.type)!) : ''
  function transfer(axis: ReportGroupingAxis) {
    if (!current || !transferable(axis)) return
    onTransfer(axis, current.type)
    setSelected({ axis: axis === 'Row' ? 'Col' : 'Row', type: current.type })
  }
  return <>
    <section className="constructor-panel constructor-panel--measures" aria-label="Показники">
      <h3 className="constructor-panel__title">Показники</h3>
      {props.measures}
    </section>
    <GroupingPanel {...props} axis="Row" selected={current} onSelect={setSelected} onOpen={() => setDialog('Row')} />
    <div className="constructor-transfer" role="group" aria-label="Перенесення групувань">
      <Tooltip label={current ? `Перенести ${currentCaption} до колонок` : 'Перенести вибране поле до колонок'}>
        <ActionIcon type="button" variant="default" size={30} disabled={disabled || !transferable('Row')}
          aria-label={current ? `Перенести ${currentCaption} до колонок` : 'Перенести вибране поле до колонок'} onClick={() => transfer('Row')}><ChevronRight size={16} /></ActionIcon>
      </Tooltip>
      <Tooltip label={current ? `Перенести ${currentCaption} до рядків` : 'Перенести вибране поле до рядків'}>
        <ActionIcon type="button" variant="default" size={30} disabled={disabled || !transferable('Col')}
          aria-label={current ? `Перенести ${currentCaption} до рядків` : 'Перенести вибране поле до рядків'} onClick={() => transfer('Col')}><ChevronLeft size={16} /></ActionIcon>
      </Tooltip>
    </div>
    {rowsOnly ? <section className="constructor-panel" aria-label={TITLES.Col}>
      <h3 className="constructor-panel__title">{TITLES.Col}</h3>
      <Text size="sm" c="dimmed" className="constructor-panel__empty">Вибрані показники відображаються у колонках.</Text>
    </section> : <GroupingPanel {...props} axis="Col" selected={current} onSelect={setSelected} onOpen={() => setDialog('Col')} />}
    <ConstructorFieldDialog key={dialog ?? 'closed'} opened={dialog !== null} title={dialog ? DIALOG_TITLES[dialog] : ''}
      fields={dialog ? props.available(dialog) : []} onClose={() => setDialog(null)}
      onAdd={types => { if (dialog) props.onAdd(dialog, types); setDialog(null) }} />
  </>
}

function GroupingPanel({ axis, layout, allowed, locked, disabled = false, caption, selected, onSelect, onOpen, onRemove, onReorder }: ConstructorGroupingProps & {
  axis: ReportGroupingAxis; selected: Selected; onSelect: (value: Selected) => void; onOpen: () => void
}) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  const groups = layout[axis]
  const title = TITLES[axis]
  const index = selected?.axis === axis ? groups.findIndex(item => item.type === selected.type) : -1
  const item = index >= 0 ? groups[index] : undefined
  const label = item ? caption(item) : ''
  const movable = (direction: -1 | 1) => !!item && !locked.has(item.type) && allowed.has(item.type)
    && groups.filter(group => group.type === item.type).length === 1
    && index + direction >= 0 && index + direction < groups.length && !locked.has(groups[index + direction].type)
  const buttons = [
    { label: `Додати поле: ${title}`, icon: <Plus size={16} />, disabled: false, onClick: onOpen },
    { label: item ? `Видалити ${label}` : 'Видалити вибране поле', icon: <Trash2 size={16} />, disabled: !item || locked.has(item.type),
      onClick: () => { if (item && !locked.has(item.type)) { onRemove(axis, index); onSelect(null) } } },
    { label: item ? `Перемістити ${label} вище` : 'Перемістити вибране поле вище', icon: <ChevronUp size={16} />, disabled: !movable(-1), onClick: () => { if (item && movable(-1)) onReorder(axis, item.type, -1) } },
    { label: item ? `Перемістити ${label} нижче` : 'Перемістити вибране поле нижче', icon: <ChevronDown size={16} />, disabled: !movable(1), onClick: () => { if (item && movable(1)) onReorder(axis, item.type, 1) } },
  ]
  const visible = groups.map((group, position) => ({ group, position })).filter(({ group }) => !normalized || caption(group).toLocaleLowerCase('uk-UA').includes(normalized))
  return <section className="constructor-panel" aria-label={title}>
    <h3 className="constructor-panel__title">{title}</h3>
    <div className="constructor-panel__toolbar">
      <TextInput className="constructor-panel__search" size="xs" aria-label={`Пошук: ${title}`} placeholder="Пошук..."
        leftSection={<Search size={14} aria-hidden="true" />} value={query} onChange={event => setQuery(event.currentTarget.value)} />
      <div className="constructor-panel__buttons" role="group" aria-label={`Дії: ${title}`}>
        {buttons.map((button, position) => <Tooltip key={position} label={button.label}>
          <ActionIcon type="button" variant={position === 0 ? 'filled' : 'default'} color={position === 0 ? 'orange' : undefined} size={28}
            className={position === 1 ? 'constructor-panel__delete' : undefined}
            aria-label={button.label} disabled={disabled || button.disabled} onClick={button.onClick}>{button.icon}</ActionIcon>
        </Tooltip>)}
      </div>
    </div>
    <ul className="constructor-grouping-list" aria-label={title}>
      {visible.map(({ group, position }) => {
        const text = caption(group)
        const active = index === position
        return <li key={`${group.type}-${groups.slice(0, position).filter(other => other.type === group.type).length}`}>
          <button type="button" className="constructor-grouping-item" data-selected={active} aria-pressed={active}
            aria-label={`${text}${locked.has(group.type) ? ' (закріплено)' : ''}`} onClick={() => onSelect(active ? null : { axis, type: group.type })}>
            <ChartColumnBig size={16} aria-hidden="true" className="constructor-grouping-item__icon" />
            <span className="constructor-grouping-item__label">{text}</span>
            <span className="constructor-grouping-item__kind" aria-hidden="true">Елементи</span>
          </button>
        </li>
      })}
    </ul>
    {!groups.length ? <Text size="sm" className="constructor-panel__empty">{axis === 'Row' ? 'Додайте поле для групування рядків' : 'Без поділу на колонки'}</Text>
      : !visible.length ? <Text size="sm" role="status" className="constructor-panel__empty">Нічого не знайдено</Text> : null}
  </section>
}
