import { useMemo, useState } from 'react'
import { Stack, TextInput } from '@mantine/core'
import { Search } from 'lucide-react'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { ReportModal } from './ReportModal'

export type ReportFieldPickerOption = { value: string; label: string; path: string[]; disabled?: boolean; reason?: string | null }
export function ReportFieldPicker({ opened, title, options, onSelect, onClose }: {
  opened: boolean; title: string; options: ReportFieldPickerOption[]; onSelect: (value: string) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  const nodes = useMemo(() => {
    const roots: TreeViewNode[] = []
    for (const option of options) {
      if (normalized && ![...option.path, option.label].join(' ').toLocaleLowerCase('uk-UA').includes(normalized)) continue
      let children = roots
      for (let level = 0; level < option.path.length; level++) {
        const id = `category:${JSON.stringify(option.path.slice(0, level + 1))}`
        let category = children.find(node => node.id === id)
        if (!category) { category = { id, label: option.path[level], children: [] }; children.push(category) }
        children = category.children!
      }
      children.push({ id: `field:${option.value}`, label: option.label, meta: option.reason, onActivate: option.disabled ? undefined : () => { setQuery(''); onSelect(option.value) } })
    }
    return roots
  }, [normalized, onSelect, options])
  return <ReportModal opened={opened} title={title} size={560} onClose={() => { setQuery(''); onClose() }}>
    <Stack gap="sm">
      <TextInput label="Пошук поля" placeholder="Назва поля або категорії" value={query}
        leftSection={<Search size={16} />} onChange={event => setQuery(event.currentTarget.value)} />
      <TreeView key={normalized} nodes={nodes} defaultExpandedDepth={5} emptyText="Немає доступних полів" />
    </Stack>
  </ReportModal>
}
