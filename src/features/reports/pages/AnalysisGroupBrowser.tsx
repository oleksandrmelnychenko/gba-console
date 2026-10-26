import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Loader, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { FolderTree, Search } from 'lucide-react'
import { AppModalFooter } from '../../../shared/ui/AppModal'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { getAnalysisGroupPage, getAnalysisHierarchyPage, type AnalysisGroupNode, type AnalysisHierarchyNode } from '../api/currentVparivanieAnalysisApi'
import { analysisHierarchy, analysisListCondition, analysisSelectionValueError, analysisValueIdentity, changeAnalysisSelectionValues, type AnalysisFieldDescriptor, type AnalysisHierarchyKind } from '../data/currentVparivanieAnalysis'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportEntity, ReportSelectedValue, ReportSelection } from '../types'
import { ReportModal } from './ReportModal'

type Props = { descriptor: AnalysisFieldDescriptor; selection: ReportSelection; onChange: (values: ReportSelectedValue[]) => void }
type BrowserNode = AnalysisGroupNode & { path?: string }

const TITLES: Record<AnalysisHierarchyKind, string> = {
  productGroup: 'Дерево товарних груп',
  counterpartyGroup: 'Дерево груп контрагентів',
  warehouseGroup: 'Дерево груп складів',
}

export function AnalysisGroupBrowser(props: Props) {
  const [opened, setOpened] = useState(false)
  const kind = analysisHierarchy(props.descriptor)?.groupKind ?? 'productGroup'
  return <>
    <Button type="button" variant="default" size="compact-sm" leftSection={<FolderTree size={15} />} onClick={() => setOpened(true)}>{TITLES[kind]}</Button>
    <ReportModal opened={opened} onClose={() => setOpened(false)} title={TITLES[kind]} size={600}>
      {opened ? <GroupBrowserDraft {...props} onClose={() => setOpened(false)} /> : null}
    </ReportModal>
  </>
}

function analysisBrowserNodeData(field: number, kind: AnalysisHierarchyKind, mixed: boolean, node: BrowserNode): ReportEntity {
  if (kind !== 'productGroup') return node.data
  return field === 4 && !mixed ? node.data : { kind: 'productGroup', id: node.id }
}

function GroupBrowserDraft({ descriptor, selection, onChange, onClose }: Props & { onClose: () => void }) {
  const [values, setValues] = useState(selection.Values)
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search.trim(), 400)
  const field = selection.SelectedField.Type
  const hierarchy = analysisHierarchy(descriptor)
  const kind = hierarchy?.groupKind ?? 'productGroup'
  const multiple = isMultiValueReportCondition(selection.FilterCondition.Type) || !!analysisListCondition(selection.FilterCondition.Type, descriptor)
  const mixed = !!hierarchy?.mixedConditions.includes(selection.FilterCondition.Type)
  const selected = new Set(values.map(v => analysisValueIdentity(field, v.Data)))
  const error = analysisSelectionValueError(changeAnalysisSelectionValues(selection, values, descriptor), descriptor)
  const keyOf = (node: BrowserNode) => analysisValueIdentity(field, analysisBrowserNodeData(field, kind, mixed, node))
  const toggle = (node: BrowserNode) => {
    const key = keyOf(node)
    const value = { Name: kind === 'productGroup' ? node.name : node.path ?? node.name, Value: 0, Data: analysisBrowserNodeData(field, kind, mixed, node) }
    setValues(current => multiple ? current.some(v => analysisValueIdentity(field, v.Data) === key)
      ? current.filter(v => analysisValueIdentity(field, v.Data) !== key) : [...current, value] : [value])
  }
  return <Stack gap="sm">
    <TextInput label={kind === 'productGroup' ? 'Пошук кореневої групи' : 'Пошук групи'} leftSection={<Search size={14} />} value={search} onChange={e => setSearch(e.currentTarget.value)} />
    <div className="report-modal__picker-list"><HierarchyLevel key={query} kind={kind} query={query} limit={hierarchy?.maximumPageSize ?? descriptor.hierarchyBrowse?.maximumPageSize ?? 50}
      isSelected={node => selected.has(keyOf(node))} onToggle={toggle} /></div>
    <Text size="xs">Вибрано значень: {values.length}</Text>
    {error ? <Alert color="yellow">{error}</Alert> : null}
    <AppModalFooter>
      <Button type="button" variant="default" color="gray" onClick={onClose}>Скасувати</Button>
      <Button type="button" color="orange" disabled={!values.length || !!error} onClick={() => { onChange(values); onClose() }}>Застосувати</Button>
    </AppModalFooter>
  </Stack>
}

function loadLevel(kind: AnalysisHierarchyKind, parentId: string | null, offset: number, limit: number, query: string, signal: AbortSignal)
  : Promise<{ items: BrowserNode[]; hasMore: boolean }> {
  if (kind === 'productGroup') return getAnalysisGroupPage(parentId, offset, limit, parentId ? '' : query, signal)
  return getAnalysisHierarchyPage(kind, parentId, offset, limit, parentId ? '' : query, signal)
    .then(page => ({ items: page.items as AnalysisHierarchyNode[], hasMore: page.hasMore }))
}

type Level = { items: BrowserNode[]; hasMore: boolean; loading: boolean; error?: string }
function HierarchyLevel({ kind, query, limit, isSelected, onToggle }: {
  kind: AnalysisHierarchyKind; query: string; limit: number; isSelected: (node: BrowserNode) => boolean; onToggle: (node: BrowserNode) => void
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
      const page = await loadLevel(kind, parentId, offset, limit, query, controller.signal)
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
  }, [kind, limit, query])
  useEffect(() => {
    const requests = pending.current
    void load(null, 0)
    return () => { requests.forEach(controller => controller.abort()); requests.clear() }
  }, [load])
  const nodes = (items: BrowserNode[], ancestors: string[] = []): TreeViewNode[] => {
    const ancestorIds = new Set(ancestors)
    return items.map(item => {
    const path = [...ancestors, item.id], key = path.join('/'), level = levels[item.id]
    const label = ancestors.length === 0 && query && item.path ? item.path : item.name
    if (ancestorIds.has(item.id)) return { id: key, label, meta: 'Циклічний зв’язок груп; подальше розкриття недоступне.' }
    const children = nodes(level?.items ?? [], path)
    if (level?.error) children.push({ id: `${key}/error`, label: level.error, actions: <Button size="compact-xs" variant="subtle" onClick={() => void load(item.id, level.items.length)}>Повторити</Button> })
    if (level?.hasMore && !level.error) children.push({ id: `${key}/more`, label: 'Ще підгрупи', onActivate: () => void load(item.id, level.items.length) })
    return { id: key, label, hasChildren: item.hasChildren, children, loading: level?.loading,
      onExpand: () => { if (!level) void load(item.id, 0) },
      selection: isSelected(item) ? 'checked' : 'unchecked', onToggleSelect: () => onToggle(item), onActivate: () => onToggle(item) }
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
