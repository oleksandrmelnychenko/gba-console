import { useMemo, useState } from 'react'
import { Button, Checkbox, Group, Stack, TextInput } from '@mantine/core'
import { Search } from 'lucide-react'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { ReportModal } from './ReportModal'

export type ReportFieldPickerOption = { value: string; label: string; path: string[]; disabled?: boolean; reason?: string | null }
export function ReportFieldPicker({ opened, title, options, onSelect, onSelectMany, onClose }: {
  opened: boolean; title: string; options: ReportFieldPickerOption[]; onSelect: (value: string) => void; onSelectMany?: (values: string[]) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  function close() { setQuery(''); setSelected([]); onClose() }
  function toggle(value: string) { setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]) }
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  const nodes = useMemo(() => {
    const roots: TreeViewNode[] = []
    const selectedValues = new Set(selected)
    for (const option of options) {
      if (normalized && ![...option.path, option.label].join(' ').toLocaleLowerCase('uk-UA').includes(normalized)) continue
      let children = roots
      for (let level = 0; level < option.path.length; level++) {
        const id = `category:${JSON.stringify(option.path.slice(0, level + 1))}`
        let category = children.find(node => node.id === id)
        if (!category) { category = { id, label: option.path[level], children: [] }; children.push(category) }
        children = category.children!
      }
      children.push({ id: `field:${option.value}`, label: option.label, meta: option.reason,
        icon: onSelectMany ? <Checkbox aria-label={`Вибрати ${option.label}`} checked={selectedValues.has(option.value)} disabled={option.disabled} onChange={() => toggle(option.value)} /> : undefined,
        onActivate: option.disabled ? undefined : () => { if (onSelectMany) toggle(option.value); else { setQuery(''); onSelect(option.value) } } })
    }
    return roots
  }, [normalized, onSelect, onSelectMany, options, selected])
  return <ReportModal opened={opened} title={title} size={560} onClose={close}>
    <Stack gap="sm">
      <TextInput label="Пошук поля" placeholder="Назва поля або категорії" value={query}
        leftSection={<Search size={16} />} onChange={event => setQuery(event.currentTarget.value)} />
      <div className="report-modal__picker-list"><TreeView key={normalized} nodes={nodes} defaultExpandedDepth={5} emptyText="Немає доступних полів" /></div>
      {onSelectMany ? <Group justify="flex-end"><Button type="button" variant="default" onClick={close}>Скасувати</Button><Button type="button" disabled={!selected.length} onClick={() => { onSelectMany(selected.filter(value => options.some(option => option.value === value && !option.disabled))); setSelected([]); setQuery('') }}>Додати вибрані ({selected.length})</Button></Group> : null}
    </Stack>
  </ReportModal>
}
