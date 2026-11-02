import { useState } from 'react'
import { ActionIcon, Checkbox, Text, TextInput, Tooltip } from '@mantine/core'
import { ArrowDownAZ, ChevronDown, ChevronRight, ChevronUp, ListChecks, ListX, Search } from 'lucide-react'
import type { ReportMeasurementGroup, ReportMeasurementItem } from '../../types'
import { alphabetizeMeasurements, reorderMeasurementGroup, reorderMeasurementItem } from '../../data/reportConstructorTree'

type Selected = { group: string; type?: number } | null

type Props = {
  groups: ReportMeasurementGroup[]
  disabled?: boolean
  onChange: (groups: ReportMeasurementGroup[]) => void
  groupLabel: (group: ReportMeasurementGroup) => string
  itemLabel: (group: ReportMeasurementGroup, item: ReportMeasurementItem) => string
  itemAccessibleLabel: (group: ReportMeasurementGroup, item: ReportMeasurementItem) => string
  leafHint?: (group: ReportMeasurementGroup) => string | undefined
}

export function ConstructorMeasures({ groups, disabled = false, onChange, groupLabel, itemLabel, itemAccessibleLabel, leafHint }: Props) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [selected, setSelected] = useState<Selected>(null)
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  const matches = (text: string) => !normalized || text.toLocaleLowerCase('uk-UA').includes(normalized)
  const allChecked = groups.length > 0 && groups.every(group => group.SubList.every(item => item.IsChecked))
  const hasChildren = (group: ReportMeasurementGroup) => group.SubList.length > 1 || itemLabel(group, group.SubList[0]) !== groupLabel(group)
  const selectedGroupIndex = selected ? groups.findIndex(group => group.Name === selected.group) : -1
  const selectedGroup = selectedGroupIndex >= 0 ? groups[selectedGroupIndex] : undefined
  const selectedItemIndex = selectedGroup && selected?.type !== undefined ? selectedGroup.SubList.findIndex(item => item.Type === selected.type) : -1
  const selectedCaption = selectedGroup ? selectedItemIndex >= 0 ? itemAccessibleLabel(selectedGroup, selectedGroup.SubList[selectedItemIndex]) : groupLabel(selectedGroup) : ''
  const canMove = (direction: -1 | 1) => {
    if (!selectedGroup) return false
    const index = selectedItemIndex >= 0 ? selectedItemIndex : selectedGroupIndex
    const size = selectedItemIndex >= 0 ? selectedGroup.SubList.length : groups.length
    return index + direction >= 0 && index + direction < size
  }
  function move(direction: -1 | 1) {
    if (!selectedGroup || !canMove(direction)) return
    onChange(selectedItemIndex >= 0 ? reorderMeasurementItem(groups, selectedGroup.SubList[selectedItemIndex].Type, direction)
      : reorderMeasurementGroup(groups, selectedGroup.Name, direction))
  }
  function setAll(checked: boolean) {
    onChange(groups.map(group => ({ ...group, IsChecked: checked, SubList: group.SubList.map(item => ({ ...item, IsChecked: checked })) })))
  }
  function toggle(groupName: string, type?: number) {
    onChange(groups.map(group => {
      if (group.Name !== groupName) return group
      const checked = !group.SubList.every(item => item.IsChecked)
      const SubList = group.SubList.map(item => type === undefined ? { ...item, IsChecked: checked } : item.Type === type ? { ...item, IsChecked: !item.IsChecked } : item)
      return { ...group, SubList, IsChecked: SubList.every(item => item.IsChecked) }
    }))
  }
  function alphabetize() {
    const owner = new Map(groups.flatMap(group => group.SubList.map(item => [item, group] as const)))
    onChange(alphabetizeMeasurements(groups, 1, groupLabel, item => itemLabel(owner.get(item)!, item)))
  }
  const toolbar = [
    { label: allChecked ? 'Зняти всі показники' : 'Вибрати всі показники', icon: <ListChecks size={16} />, disabled: !groups.length, onClick: () => setAll(!allChecked) },
    { label: selectedCaption ? `Перемістити ${selectedCaption} вище` : 'Перемістити вибраний показник вище', icon: <ChevronUp size={16} />, disabled: !canMove(-1), onClick: () => move(-1) },
    { label: selectedCaption ? `Перемістити ${selectedCaption} нижче` : 'Перемістити вибраний показник нижче', icon: <ChevronDown size={16} />, disabled: !canMove(1), onClick: () => move(1) },
    { label: 'Упорядкувати всі показники від А до Я', icon: <ArrowDownAZ size={16} />, disabled: groups.length < 2 && !groups.some(group => group.SubList.length > 1), onClick: alphabetize },
    { label: 'Очистити вибір показників', icon: <ListX size={16} />, disabled: !groups.some(group => group.SubList.some(item => item.IsChecked)), onClick: () => setAll(false) },
  ]
  const isSelected = (group: string, type?: number) => selected?.group === group && selected.type === type
  const anyVisible = groups.some(group => matches(groupLabel(group)) || group.SubList.some(item => matches(itemLabel(group, item)) || matches(itemAccessibleLabel(group, item))))
  return <div className="constructor-measures">
    <div className="constructor-panel__toolbar">
      <TextInput className="constructor-panel__search" size="xs" aria-label="Пошук показника" placeholder="Пошук показника..."
        leftSection={<Search size={14} aria-hidden="true" />} value={query} onChange={event => setQuery(event.currentTarget.value)} />
      <div className="constructor-panel__buttons" role="group" aria-label="Дії з показниками">
        {toolbar.map(button => <Tooltip key={button.label} label={button.label}>
          <ActionIcon type="button" variant="default" size={28} aria-label={button.label} disabled={disabled || button.disabled} onClick={button.onClick}>{button.icon}</ActionIcon>
        </Tooltip>)}
      </div>
    </div>
    <ul className="constructor-tree" aria-label="Показники">
      {groups.map(group => {
        const label = groupLabel(group)
        const children = hasChildren(group)
        const visible = group.SubList.filter(item => matches(label) || matches(itemLabel(group, item)) || matches(itemAccessibleLabel(group, item)))
        if (!visible.length) return null
        const expanded = !!normalized || !collapsed.has(group.Name)
        const checked = group.SubList.every(item => item.IsChecked)
        const accessible = children ? label : itemAccessibleLabel(group, group.SubList[0])
        return <li className="constructor-tree__node" key={group.Name}>
          <div className="constructor-tree-row" data-selected={isSelected(group.Name)}>
            {children ? <button type="button" className="constructor-tree-row__toggle" aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'} ${label}`} aria-expanded={expanded}
              onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(group.Name)) next.delete(group.Name); else next.add(group.Name); return next })}>
              {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}</button>
              : <span className="constructor-tree-row__toggle" aria-hidden="true" />}
            <Checkbox size="xs" aria-label={accessible} checked={checked} disabled={disabled}
              indeterminate={!checked && group.SubList.some(item => item.IsChecked)} onChange={() => toggle(group.Name)} />
            <button type="button" className="constructor-tree-row__label" aria-pressed={isSelected(group.Name)}
              title={!children ? leafHint?.(group) : undefined} onClick={() => setSelected({ group: group.Name })}>{label}</button>
          </div>
          {children && expanded ? <ul className="constructor-tree__children">{visible.map(item => {
            const caption = itemAccessibleLabel(group, item)
            return <li key={item.Type} className="constructor-tree__node">
              <div className="constructor-tree-row constructor-tree-row--child" data-selected={isSelected(group.Name, item.Type)}>
                <Checkbox size="xs" aria-label={caption} checked={item.IsChecked} disabled={disabled} onChange={() => toggle(group.Name, item.Type)} />
                <button type="button" className="constructor-tree-row__label" aria-label={caption} aria-pressed={isSelected(group.Name, item.Type)}
                  onClick={() => setSelected({ group: group.Name, type: item.Type })}>{itemLabel(group, item)}</button>
              </div>
            </li>
          })}</ul> : null}
        </li>
      })}
    </ul>
    {groups.length && !anyVisible ? <Text role="status" size="sm" className="constructor-panel__empty">Нічого не знайдено</Text> : null}
    {!groups.length ? <Text size="sm" className="constructor-panel__empty">Немає доступних показників</Text> : null}
  </div>
}
