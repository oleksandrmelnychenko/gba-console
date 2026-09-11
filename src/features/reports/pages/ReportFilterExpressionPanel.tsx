import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useRef, useState } from 'react'
import type { ReportDataset, ReportFilterExpression, ReportFilterExpressionCapabilities, ReportFilterNode, ReportRequestBody, ReportSelection } from '../types'
import { createFilterExpression, editFilterExpression, filterPathContains, filterPathId, filterTreeEntries, readFilterExpressionCapabilities, readReportFilterExpression, reportFilterExpressionError, requestFilterExpression, type FilterNodePath, type FilterTreeEdit } from '../data/reportFilterExpression'

type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; notice: string | null; onChange: (value: unknown) => void }
const operators = [{ value: '1', label: 'І — усі умови' }, { value: '2', label: 'АБО — будь-яка умова' }]
const pathLabel = (path: number[]) => path.length ? `Група ${path.map(index => index + 1).join('.')}` : 'Коренева група'
function selectionLabel(selection: ReportSelection | undefined, index: number, dataset?: ReportDataset) {
  if (!selection) return `№${index + 1}: відсутня умова`
  const field = dataset?.Filters.find(item => item.Type === selection.SelectedField.Type)?.Name ?? selection.SelectedField.Name
  const values = selection.Values.map(value => value.Name).join('; ')
  return `№${index + 1}: ${field} ${selection.FilterCondition.Name} ${values}${selection.IsChecked === false ? ' (вимкнено)' : ''}`
}

export function ReportFilterExpressionPanel({ data, dataset, disabled, notice, onChange }: Props) {
  const raw = requestFilterExpression(data), tree = readReportFilterExpression(raw), cap = readFilterExpressionCapabilities(dataset)
  const error = reportFilterExpressionError(data, dataset)
  return <Stack component="section" aria-label="Логіка умов відбору" gap="xs" p="sm">
    <Text component="h3" className="app-section-title" fw={600}>Логіка умов відбору</Text>
    <Text size="xs" c="dimmed">Без груп усі увімкнені умови поєднано через І. У групі І мають виконуватися всі умови; у групі АБО — хоча б одна. Значення й прапорці змінюйте в «Умовах відбору» вище.</Text>
    <Text size="xs" c="dimmed">Вимкнені умови та порожні групи не впливають на відбір. Якщо увімкнених умов немає, логіка не обмежує звіт.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {notice ? <Alert color="blue">{notice}</Alert> : null}
    {!cap ? <Text size="sm" c="dimmed">Сервер не надав підтримку груп І/АБО. Звіти без дерева використовують усі увімкнені умови через І.</Text> : null}
    <Group>
    {raw != null ? <Button type="button" size="compact-sm" variant="default" disabled={disabled}
      onClick={() => onChange(undefined)}>Очистити групи: усі умови через І</Button> : cap ? <Button type="button" size="compact-sm" variant="default"
      disabled={disabled || data.selections.length > cap.MaximumLeaves || !cap.Operators.includes(1)}
      onClick={() => onChange(createFilterExpression(data.selections))}>Налаштувати групи І/АБО</Button> : null}
    </Group>
    {tree && cap ? <FilterTreeEditor tree={tree} cap={cap} data={data} dataset={dataset} disabled={disabled} onChange={onChange} /> : null}
  </Stack>
}

type EditorProps = { tree: ReportFilterExpression; cap: ReportFilterExpressionCapabilities; data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; onChange: (value: unknown) => void }
function FilterTreeEditor({ tree, cap, data, dataset, disabled, onChange }: EditorProps) {
  const [editNotice, setEditNotice] = useState<string | null>(null)
  const dragTree = useRef<ReportFilterExpression | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const entries = filterTreeEntries(tree), groups = entries.filter(entry => entry.node.Kind !== 3)
  const referenced = new Set(entries.flatMap(entry => entry.node.Kind === 3 ? [entry.node.SelectionIndex] : []))
  const unassigned = data.selections.flatMap((selection, index) => referenced.has(index) ? [] : [{ value: String(index), label: selectionLabel(selection, index, dataset) }])
  function edit(change: FilterTreeEdit) {
    if (disabled) return
    const next = editFilterExpression(tree, change, cap)
    setEditNotice(next === tree ? 'Переміщення або зміна недоступні: перевірте цільову групу та межі вкладеності. Дерево не змінено.'
      : change.kind === 'move' ? 'Умову або групу перенесено. Її значення, прапорці та посилання збережено.' : null)
    if (next !== tree) onChange(next)
  }
  return <Stack gap="xs">
    <Text size="xs" c="dimmed">Переносьте вузол кнопкою-перетягуванням або виберіть цільову групу з клавіатури. Зміна групи змінює логіку відбору. Межі: {cap.MaximumDepth} рівнів, {cap.MaximumLeaves} умов.</Text>
    {editNotice ? <Alert color="blue">{editNotice}</Alert> : null}
    {unassigned.length ? <Alert color="yellow">Поза деревом: {unassigned.map(item => item.label).join(' • ')}. Увімкнені умови потрібно додати до групи перед запуском.</Alert> : null}
    {tree.Root.Kind === 3 ? <Button type="button" variant="light" size="compact-sm" disabled={disabled || !cap.Operators.includes(1)}
      onClick={() => onChange({ Version: 1, Root: { Kind: 1, Children: [tree.Root] } })}>Об’єднати кореневу умову в групу І</Button> : null}
    <DndContext sensors={sensors} onDragStart={() => { dragTree.current = tree }} onDragCancel={() => { dragTree.current = null }}
      onDragEnd={({ active, over }) => {
      const startedWith = dragTree.current
      dragTree.current = null
      if (startedWith !== tree) { setEditNotice('Під час перетягування дерево змінилося. Переміщення скасовано; повторіть його для поточних умов.'); return }
      const source = entries.find(entry => filterPathId(entry.path) === active.id)
      const target = groups.find(entry => `target:${filterPathId(entry.path)}` === over?.id)
      if (source && target) edit({ kind: 'move', path: source.path, target: target.path })
    }}>
      <FilterTreeNode node={tree.Root} path={[]} groups={groups.map(entry => entry.path)} unassigned={unassigned}
        selections={data.selections} dataset={dataset} cap={cap} disabled={disabled} onEdit={edit} />
    </DndContext>
  </Stack>
}

type NodeProps = { node: ReportFilterNode; path: FilterNodePath; groups: FilterNodePath[]; unassigned: Array<{ value: string; label: string }>;
  selections: ReportSelection[]; dataset?: ReportDataset; cap: ReportFilterExpressionCapabilities; disabled: boolean; onEdit: (edit: FilterTreeEdit) => void }
function FilterTreeNode(props: NodeProps) {
  const { node, path, disabled, onEdit, groups } = props
  const id = filterPathId(path), title = node.Kind === 3 ? `Умова №${node.SelectionIndex + 1}` : pathLabel(path)
  const { setNodeRef: setDragRef, listeners, attributes, isDragging } = useDraggable({ id, disabled: disabled || !path.length })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `target:${id}`, disabled: disabled || node.Kind === 3 })
  return <Stack ref={setDropRef} component="section" aria-label={title} gap="xs" p="xs" ml={path.length ? 'sm' : 0}
    style={{ borderInlineStart: `2px solid ${isOver ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-default-border)'}`, opacity: isDragging ? 0.5 : 1 }}>
    <Group gap="xs" align="end">
      <FilterNodeHeading {...props} title={title} />
      {path.length ? <>
        <Button type="button" ref={setDragRef} {...listeners} {...attributes} aria-label={`Перетягнути — ${title}`}
          disabled={disabled} variant="subtle" size="compact-sm">Перетягнути</Button>
        <FilterMoveControl title={title} path={path} groups={groups} disabled={disabled} onEdit={onEdit} />
      </> : null}
    </Group>
    {node.Kind !== 3 ? <FilterGroupChildren {...props} node={node} title={title} /> : null}
  </Stack>
}

function FilterMoveControl({ title, path, groups, disabled, onEdit }: Pick<NodeProps, 'path' | 'groups' | 'disabled' | 'onEdit'> & { title: string }) {
  const destinations = groups.flatMap(target => filterPathContains(path, target) ? [] : [{ value: filterPathId(target), label: pathLabel(target) }])
  return <Select label={`Перенести до групи — ${title}`} data={destinations} value={null} placeholder="Виберіть групу" disabled={disabled || !destinations.length}
    onChange={value => { const target = groups.find(item => filterPathId(item) === value); if (target) onEdit({ kind: 'move', path, target }) }} />
}

function FilterNodeHeading({ node, path, selections, dataset, cap, disabled, onEdit, title }: NodeProps & { title: string }) {
  if (node.Kind === 3) return <Text size="sm">{selectionLabel(selections[node.SelectionIndex], node.SelectionIndex, dataset)}</Text>
  const allowed = new Set(cap.Operators)
  return <Select label={`Оператор — ${title}`} value={String(node.Kind)} disabled={disabled} allowDeselect={false}
    data={operators.filter(option => allowed.has(Number(option.value) as 1 | 2))}
    onChange={value => { if (value === '1' || value === '2') onEdit({ kind: 'operator', path, operator: Number(value) as 1 | 2 }) }} />
}

function FilterGroupChildren({ node, path, groups, unassigned, selections, dataset, cap, disabled, onEdit, title }: NodeProps & { node: Extract<ReportFilterNode, { Kind: 1 | 2 }>; title: string }) {
  return <>
    <Group gap="xs" align="end">
      <Button type="button" size="compact-sm" variant="light" disabled={disabled || path.length + 1 >= cap.MaximumDepth}
        onClick={() => onEdit({ kind: 'add-group', path })}>Додати групу в {pathLabel(path)}</Button>
      {unassigned.length ? <Select label={`Додати умову — ${title}`} data={unassigned} value={null} placeholder="Умова поза деревом" disabled={disabled}
        onChange={value => { if (value !== null) onEdit({ kind: 'add-selection', path, index: Number(value) }) }} /> : null}
      {path.length ? <Button type="button" size="compact-sm" variant="subtle" color="gray" disabled={disabled}
        onClick={() => onEdit({ kind: 'ungroup', path })}>Розформувати {title}: умови до батьківської групи</Button> : null}
    </Group>
    {!node.Children.length ? <Text size="xs" c="dimmed">Порожня група не впливає на відбір.</Text> : null}
    {node.Children.map((child, index) => {
      const childPath = [...path, index]
      return <FilterTreeNode key={filterPathId(childPath)} node={child} path={childPath} groups={groups} unassigned={unassigned}
        selections={selections} dataset={dataset} cap={cap} disabled={disabled} onEdit={onEdit} />
    })}
  </>
}
