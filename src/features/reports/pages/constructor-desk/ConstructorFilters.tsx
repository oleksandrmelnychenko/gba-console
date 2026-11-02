import { useState, type ReactNode } from 'react'
import { ActionIcon, Button, Text, Tooltip } from '@mantine/core'
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Trash2 } from 'lucide-react'

export type ConstructorFilterRowContext = { index: number; selected: boolean; onSelect: () => void }

type Props = {
  count: number
  rowKeys: readonly string[]
  disabled?: boolean
  renderRow: (context: ConstructorFilterRowContext) => ReactNode
  footer?: ReactNode
  onAdd: () => void
  onDelete: (index: number) => void
  onCopy: (index: number) => void
}

export function ConstructorFilters({ count, rowKeys, disabled = false, renderRow, footer, onAdd, onDelete, onCopy }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = selectedKey === null ? -1 : rowKeys.indexOf(selectedKey)
  function edit() {
    if (selected < 0) return
    document.querySelector<HTMLElement>(`[data-constructor-filter="${selected}"] .constructor-filter-row__field input`)?.focus()
  }
  const tools = [
    { label: 'Змінити вибраний відбір', icon: <Pencil size={15} />, disabled: selected < 0, onClick: edit },
    { label: 'Видалити вибраний відбір', icon: <Trash2 size={15} />, disabled: selected < 0, onClick: () => { if (selected >= 0) { onDelete(selected); setSelectedKey(null) } } },
    { label: 'Копіювати вибраний відбір', icon: <Copy size={15} />, disabled: selected < 0, onClick: () => { if (selected >= 0) onCopy(selected) } },
  ]
  return <section className="constructor-panel constructor-filters" aria-label="Відбори">
    <div className="constructor-section-head">
      <h3 className="constructor-panel__title">Відбори</h3>
      <ActionIcon type="button" variant="subtle" color="gray" size={24} aria-expanded={expanded}
        aria-label={expanded ? 'Згорнути відбори' : 'Розгорнути відбори'} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </ActionIcon>
    </div>
    {expanded ? <>
      <div className="constructor-filters__toolbar" role="group" aria-label="Дії з відборами">
        <Button type="button" variant="subtle" color="dark" size="compact-sm" leftSection={<Plus size={15} aria-hidden="true" />}
          aria-label="Додати відбір" disabled={disabled} onClick={onAdd}>Додати</Button>
        {tools.map(tool => <Tooltip key={tool.label} label={tool.label}>
          <ActionIcon type="button" variant="subtle" color={tool.label.startsWith('Видалити') ? 'red' : 'gray'} size={26}
            aria-label={tool.label} disabled={disabled || tool.disabled} onClick={tool.onClick}>{tool.icon}</ActionIcon>
        </Tooltip>)}
      </div>
      <div className="constructor-filters__table">
        <div className="constructor-filters__head" aria-hidden="true">
          <span />
          <span>Поле</span>
          <span>Тип порівняння</span>
          <span>Значення</span>
          <span />
        </div>
        {count ? rowKeys.slice(0, count).map((key, index) => <div key={key} data-constructor-filter={index}>
          {renderRow({ index, selected: index === selected, onSelect: () => setSelectedKey(key) })}
        </div>) : <Text size="sm" className="constructor-panel__empty">Відборів немає. Натисніть «Додати», щоб звузити звіт.</Text>}
      </div>
      {footer}
    </> : null}
  </section>
}
