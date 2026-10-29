import { useState } from 'react'
import { ActionIcon, Button, Checkbox, Group, Text, TextInput } from '@mantine/core'
import { ArrowDown, ArrowDownAZ, ArrowUp, ArrowUpAZ, Search } from 'lucide-react'
import type { ReportMeasurementGroup, ReportMeasurementItem } from '../types'
import { alphabetizeMeasurements, reorderMeasurementGroup, reorderMeasurementItem } from '../data/reportConstructorTree'
import './report-constructor-tree.css'

type Props = {
  groups: ReportMeasurementGroup[]
  onChange: (groups: ReportMeasurementGroup[]) => void
  groupLabel: (group: ReportMeasurementGroup) => string
  itemLabel: (item: ReportMeasurementItem) => string
  itemUnit: (item: ReportMeasurementItem) => string
}

function OrderButtons({ label, first, last, onMove }: { label: string; first: boolean; last: boolean; onMove: (direction: -1 | 1) => void }) {
  return <Group gap={0} wrap="nowrap">
    <ActionIcon type="button" variant="subtle" color="gray" size={26} disabled={first} aria-label={`Перемістити ${label} вище`} onClick={() => onMove(-1)}><ArrowUp size={14} /></ActionIcon>
    <ActionIcon type="button" variant="subtle" color="gray" size={26} disabled={last} aria-label={`Перемістити ${label} нижче`} onClick={() => onMove(1)}><ArrowDown size={14} /></ActionIcon>
  </Group>
}

export function ReportMeasureTree({ groups, onChange, groupLabel, itemLabel, itemUnit }: Props) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const canSort = groups.length > 1 || groups.some(group => group.SubList.length > 1)
  const visibleItemLabel = (item: ReportMeasurementItem) => item.Name.endsWith('WithoutVAT') ? 'Без ПДВ'
    : item.Name.endsWith('WithVAT') ? 'З ПДВ' : item.Name.endsWith('VAT') ? 'ПДВ' : itemLabel(item)
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  const matches = (text: string) => !normalized || text.toLocaleLowerCase('uk-UA').includes(normalized)
  function toggle(groupName: string, type?: number) {
    onChange(groups.map(group => {
      if (group.Name !== groupName) return group
      const checked = !group.SubList.every(item => item.IsChecked)
      const SubList = group.SubList.map(item => type === undefined ? { ...item, IsChecked: checked } : item.Type === type ? { ...item, IsChecked: !item.IsChecked } : item)
      return { ...group, SubList, IsChecked: SubList.every(item => item.IsChecked) }
    }))
  }
  return <div className="report-measure-tree">
    <Group gap="xs" wrap="nowrap" className="report-measure-tree__toolbar">
      <TextInput aria-label="Пошук показника" placeholder="Пошук показника" leftSection={<Search size={15} aria-hidden="true" />}
        value={query} onChange={event => setQuery(event.currentTarget.value)} />
      <Group gap={4} wrap="nowrap" role="group" aria-label="Порядок усіх показників">
        <Button type="button" variant="default" size="compact-xs" disabled={!canSort}
          aria-label="Упорядкувати всі показники від А до Я" title="Упорядкувати всі показники від А до Я"
          leftSection={<ArrowDownAZ size={14} aria-hidden="true" />}
          onClick={() => onChange(alphabetizeMeasurements(groups, 1, groupLabel, visibleItemLabel))}>А–Я</Button>
        <Button type="button" variant="default" size="compact-xs" disabled={!canSort}
          aria-label="Упорядкувати всі показники від Я до А" title="Упорядкувати всі показники від Я до А"
          leftSection={<ArrowUpAZ size={14} aria-hidden="true" />}
          onClick={() => onChange(alphabetizeMeasurements(groups, -1, groupLabel, visibleItemLabel))}>Я–А</Button>
      </Group>
    </Group>
    <div className="report-measure-tree__list">
      {groups.map((group, groupIndex) => {
        const label = groupLabel(group)
        const visible = group.SubList.filter(item => matches(label) || matches(itemLabel(item)))
        if (!visible.length) return null
        const expanded = !!normalized || !collapsed.has(group.Name)
        const children = group.SubList.length > 1 || itemLabel(group.SubList[0]) !== label
        return <div className="report-measure-tree__group" key={group.Name}>
          <div className="report-measure-tree__row">
            {children ? <button type="button" className="report-measure-tree__disclosure" aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'} ${label}`} aria-expanded={expanded}
              onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(group.Name)) next.delete(group.Name); else next.add(group.Name); return next })}>{expanded ? '⌄' : '›'}</button> : null}
            <Checkbox label={label} aria-label={label} checked={group.SubList.every(item => item.IsChecked)}
              indeterminate={group.SubList.some(item => item.IsChecked) && !group.SubList.every(item => item.IsChecked)} onChange={() => toggle(group.Name)} />
            <OrderButtons label={label} first={groupIndex === 0} last={groupIndex === groups.length - 1} onMove={direction => onChange(reorderMeasurementGroup(groups, group.Name, direction))} />
          </div>
          {children && expanded ? <div className="report-measure-tree__children">{visible.map(item => {
            const index = group.SubList.indexOf(item), caption = itemLabel(item)
            return <div className="report-measure-tree__row" key={item.Type}>
              <Checkbox label={visibleItemLabel(item)}
                aria-label={caption} checked={item.IsChecked} onChange={() => toggle(group.Name, item.Type)} />
              <OrderButtons label={caption} first={index === 0} last={index === group.SubList.length - 1} onMove={direction => onChange(reorderMeasurementItem(groups, item.Type, direction))} />
            </div>
          })}</div> : !children ? <Text size="xs" c="dimmed">{itemUnit(group.SubList[0])}</Text> : null}
        </div>
      })}
      {!groups.some(group => matches(groupLabel(group)) || group.SubList.some(item => matches(itemLabel(item)))) ? <Text role="status" size="sm">Нічого не знайдено</Text> : null}
    </div>
  </div>
}
