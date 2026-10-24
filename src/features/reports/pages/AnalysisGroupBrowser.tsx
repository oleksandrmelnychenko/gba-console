import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Loader, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { FolderTree, Search } from 'lucide-react'
import { AppModalFooter } from '../../../shared/ui/AppModal'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { getAnalysisGroupPage, type AnalysisGroupNode } from '../api/currentVparivanieAnalysisApi'
import { analysisSelectionValueError, analysisValueIdentity, mixedAnalysisSelection, type AnalysisFieldDescriptor } from '../data/currentVparivanieAnalysis'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportSelectedValue, ReportSelection } from '../types'
import { ReportModal } from './ReportModal'

type Props = { descriptor: AnalysisFieldDescriptor; selection: ReportSelection; onChange: (values: ReportSelectedValue[]) => void }
export function AnalysisGroupBrowser(props: Props) {
  const [opened, setOpened] = useState(false)
  return <>
    <Button type="button" variant="default" size="compact-sm" leftSection={<FolderTree size={15} />} onClick={() => setOpened(true)}>Дерево товарних груп</Button>
    <ReportModal opened={opened} onClose={() => setOpened(false)} title="Дерево товарних груп" size={600}>
      {opened ? <GroupBrowserDraft {...props} onClose={() => setOpened(false)} /> : null}
    </ReportModal>
  </>
}
function GroupBrowserDraft({ descriptor, selection, onChange, onClose }: Props & { onClose: () => void }) {
  const [values, setValues] = useState(selection.Values)
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search.trim(), 200)
  const multiple = isMultiValueReportCondition(selection.FilterCondition.Type)
  const mixed = mixedAnalysisSelection(descriptor, selection.FilterCondition.Type)
  const selected = new Set(values.map(v => analysisValueIdentity(4, v.Data)))
  const error = analysisSelectionValueError({ ...selection, Values: values }, descriptor)
  const toggle = (node: AnalysisGroupNode) => {
    const key = `productGroup:${node.id}`
    const value = { Name: node.name, Value: 0, Data: mixed ? { kind: 'productGroup', id: node.id } : node.data }
    setValues(current => multiple ? current.some(v => analysisValueIdentity(4, v.Data) === key)
      ? current.filter(v => analysisValueIdentity(4, v.Data) !== key) : [...current, value] : [value])
  }
  return <Stack gap="sm">
    <Text size="xs" c="dimmed">{multiple ? 'Оберіть потрібні групи.' : 'Оберіть одну групу.'} Група зберігається один раз; умови «У групі» та «У групі зі списку» враховують її підгрупи. Пошук окремої вкладеної групи також доступний у полі «Значення».</Text>
    <TextInput label="Пошук кореневої групи" leftSection={<Search size={14} />} value={search} onChange={e => setSearch(e.currentTarget.value)} />
    <HierarchyLevel key={query} query={query} limit={descriptor.hierarchyBrowse!.maximumPageSize} selected={selected} onToggle={toggle} />
    <Text size="xs">Вибрано значень: {values.length}</Text>
    {error ? <Alert color="yellow">{error}</Alert> : null}
    <AppModalFooter>
      <Button type="button" variant="default" color="gray" onClick={onClose}>Скасувати</Button>
      <Button type="button" color="orange" disabled={!values.length || !!error} onClick={() => { onChange(values); onClose() }}>Застосувати</Button>
    </AppModalFooter>
  </Stack>
}

type Level = { items: AnalysisGroupNode[]; hasMore: boolean; loading: boolean; error?: string }
function HierarchyLevel({ query, limit, selected, onToggle }: {
  query: string; limit: number; selected: Set<string>; onToggle: (node: AnalysisGroupNode) => void
}) {
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const pending = useRef(new Map<string, AbortController>())
  const load = useCallback(async (parentId: string | null, offset: number) => {
    const key = parentId ?? 'root'
    if (pending.current.has(key)) return
    const controller = new AbortController()
    pending.current.set(key, controller)
    setLevels(current => ({ ...current, [key]: { items: current[key]?.items ?? [], hasMore: current[key]?.hasMore ?? false, loading: true } }))
    try {
      const page = await getAnalysisGroupPage(parentId, offset, limit, parentId ? '' : query, controller.signal)
      if (controller.signal.aborted) return
      setLevels(current => {
        const previous = current[key]?.items ?? [], ids = new Set(previous.map(item => item.id))
        if (offset !== previous.length || page.items.some(item => ids.has(item.id))) return { ...current,
          [key]: { ...current[key], loading: false, error: 'Список груп змінився. Закрийте й відкрийте дерево, щоб оновити його.' } }
        return { ...current, [key]: { items: [...previous, ...page.items], hasMore: page.hasMore, loading: false } }
      })
    } catch (error) {
      if (!controller.signal.aborted) setLevels(current => ({ ...current, [key]: { ...current[key], loading: false,
        error: error instanceof Error ? error.message : 'Не вдалося прочитати групи.' } }))
    } finally { if (pending.current.get(key) === controller) pending.current.delete(key) }
  }, [limit, query])
  useEffect(() => {
    const requests = pending.current
    void load(null, 0)
    return () => { requests.forEach(controller => controller.abort()); requests.clear() }
  }, [load])
  const nodes = (items: AnalysisGroupNode[], ancestors: string[] = []): TreeViewNode[] => {
    const ancestorIds = new Set(ancestors)
    return items.map(item => {
    const path = [...ancestors, item.id], key = path.join('/'), level = levels[item.id]
    if (ancestorIds.has(item.id)) return { id: key, label: item.name, meta: 'Циклічний зв’язок груп; подальше розкриття недоступне.' }
    const children = nodes(level?.items ?? [], path)
    if (level?.error) children.push({ id: `${key}/error`, label: level.error, actions: <Button size="compact-xs" variant="subtle" onClick={() => void load(item.id, level.items.length)}>Повторити</Button> })
    if (level?.hasMore && !level.error) children.push({ id: `${key}/more`, label: 'Ще підгрупи', onActivate: () => void load(item.id, level.items.length) })
    return { id: key, label: item.name, hasChildren: item.hasChildren, children, loading: level?.loading,
      onExpand: () => { if (!level) void load(item.id, 0) },
      selection: selected.has(`productGroup:${item.id}`) ? 'checked' : 'unchecked', onToggleSelect: () => onToggle(item), onActivate: () => onToggle(item) }
    })
  }
  const root = levels.root
  return <Stack gap="xs">
    {root?.error ? <Alert color="red">{root.error}<Button size="compact-xs" variant="subtle" onClick={() => void load(null, root.items.length)}>Повторити</Button></Alert> : null}
    {!root || root.loading ? <Loader size="sm" aria-label="Завантаження груп" /> : null}
    <TreeView nodes={nodes(root?.items ?? [])} defaultExpandedDepth={-1} emptyText={!root || root.loading || root.error ? undefined : 'Груп не знайдено'} />
    {root?.hasMore && !root.error ? <Button type="button" variant="subtle" loading={root.loading} onClick={() => void load(null, root.items.length)}>Ще кореневі групи</Button> : null}
  </Stack>
}
