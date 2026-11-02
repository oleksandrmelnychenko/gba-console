import { useMemo, useState } from 'react'
import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { ReportModal } from '../ReportModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import type { ConstructorField } from '../../data/constructorDesk'

type Node = { key: string; label: string; field?: ConstructorField; children: Node[] }

function buildTree(fields: readonly ConstructorField[], query: string): Node[] {
  const roots: Node[] = []
  for (const field of fields) {
    if (query && ![...field.path, field.label].join(' ').toLocaleLowerCase('uk-UA').includes(query)) continue
    let level = roots
    for (let depth = 0; depth < field.path.length; depth++) {
      const key = `category:${field.path.slice(0, depth + 1).join('/')}`
      let category = level.find(node => node.key === key)
      if (!category) { category = { key, label: field.path[depth], children: [] }; level.push(category) }
      level = category.children
    }
    level.push({ key: `field:${field.type}`, label: field.label, field, children: [] })
  }
  return roots
}

function leaves(node: Node): ConstructorField[] {
  return node.field ? [node.field] : node.children.flatMap(leaves)
}

export function ConstructorFieldDialog({ opened, title, fields, onAdd, onClose }: {
  opened: boolean
  title: string
  fields: readonly ConstructorField[]
  onAdd: (types: number[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  const tree = useMemo(() => buildTree(fields, normalized), [fields, normalized])
  const chosen = new Set(selected)
  function close() { setQuery(''); setSelected([]); setCollapsed(new Set()); onClose() }
  function toggle(types: number[], checked: boolean) {
    setSelected(current => checked ? [...current, ...types.filter(type => !current.includes(type))] : current.filter(type => !types.includes(type)))
  }
  function render(node: Node) {
    if (node.field) {
      const field = node.field
      return <li key={node.key} className="constructor-tree__node">
        <div className="constructor-tree-row">
          <span className="constructor-tree-row__toggle" aria-hidden="true" />
          <Checkbox size="xs" aria-label={`Вибрати ${fields.some(other => other.type !== field.type && other.label === field.label) && field.path.length ? `${field.path.join('. ')}. ` : ''}${field.label}`} checked={chosen.has(field.type)}
            onChange={event => toggle([field.type], event.currentTarget.checked)}
            label={<span className={!field.path.length && ![0, 1, 2, 3].includes(field.type) ? 'constructor-field-dialog__root' : undefined}>{field.label}</span>} />
        </div>
      </li>
    }
    const types = leaves(node).map(field => field.type)
    const all = types.every(type => chosen.has(type))
    const some = types.some(type => chosen.has(type))
    const expanded = !!normalized || !collapsed.has(node.key)
    return <li key={node.key} className="constructor-tree__node">
      <div className="constructor-tree-row">
        <button type="button" className="constructor-tree-row__toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'} ${node.label}`}
          onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(node.key)) next.delete(node.key); else next.add(node.key); return next })}>
          {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
        <Checkbox size="xs" aria-label={`Вибрати всі поля: ${node.label}`} checked={all} indeterminate={!all && some}
          onChange={() => toggle(types, !all)} label={<span className="constructor-field-dialog__root">{node.label}</span>} />
      </div>
      {expanded ? <ul className="constructor-tree__children">{node.children.map(render)}</ul> : null}
    </li>
  }
  return <ReportModal opened={opened} title={title} size={760} onClose={close}>
    <Stack gap="sm">
      <TextInput aria-label="Пошук поля" placeholder="Пошук поля..." value={query}
        leftSection={<Search size={16} aria-hidden="true" />} onChange={event => setQuery(event.currentTarget.value)} />
      <div className="constructor-field-dialog__tree">
        {tree.length ? <ul className="constructor-tree constructor-tree--columns">{tree.map(render)}</ul>
          : <Text size="sm" role="status">{fields.length ? 'Нічого не знайдено' : 'Немає доступних полів'}</Text>}
      </div>
      <Group justify="flex-end" gap="xs">
        <Button type="button" variant="default" onClick={close}>Скасувати</Button>
        <Button type="button" color={CREATE_ACTION_COLOR} disabled={!selected.length}
          onClick={() => { const types = fields.filter(field => chosen.has(field.type)).map(field => field.type); setQuery(''); setSelected([]); onAdd(types) }}>Додати вибрані</Button>
      </Group>
    </Stack>
  </ReportModal>
}
