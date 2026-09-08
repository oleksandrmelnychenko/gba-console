import type { ReportDataset, ReportFilterExpression, ReportFilterExpressionCapabilities, ReportFilterNode, ReportRequestBody, ReportSelection } from '../types'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const keys = (value: Record<string, unknown>, allowed: ReadonlySet<string>) => Object.keys(value).every(key => allowed.has(key))
const expressionKeys = new Set(['Version', 'Root'])
const nodeKeys = new Set(['Kind', 'Children', 'SelectionIndex'])
export const FILTER_EXPRESSION_LIMITS = { MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128 } as const
export type FilterNodePath = number[]
export type FilterTreeEntry = { node: ReportFilterNode; path: FilterNodePath }

export function requestFilterExpression(data: ReportRequestBody): unknown {
  return Object.hasOwn(data, 'filterExpression') ? data.filterExpression : data.FilterExpression
}

/** Shape only: selection indices always refer to the original array, including unchecked rows. */
export function readReportFilterExpression(raw: unknown): ReportFilterExpression | null {
  if (!record(raw) || !keys(raw, expressionKeys) || raw.Version !== 1 || !record(raw.Root)) return null
  const stack: Array<{ node: unknown; depth: number }> = [{ node: raw.Root, depth: 1 }]
  const objects = new Set<unknown>(), indices = new Set<number>()
  while (stack.length) {
    const { node, depth } = stack.pop()!
    if (!record(node) || objects.has(node) || depth > 8 || !keys(node, nodeKeys)) return null
    objects.add(node)
    if (objects.size > 128) return null
    if (node.Kind === 3) {
      if (node.Children != null || !integer(node.SelectionIndex) || indices.has(node.SelectionIndex)) return null
      indices.add(node.SelectionIndex)
      if (indices.size > 64) return null
    } else if (node.Kind === 1 || node.Kind === 2) {
      if (node.SelectionIndex != null || !Array.isArray(node.Children) || node.Children.length > 128) return null
      stack.push(...node.Children.map(child => ({ node: child, depth: depth + 1 })))
    } else return null
  }
  return raw as ReportFilterExpression
}

export function filterTreeEntries(tree: ReportFilterExpression): FilterTreeEntry[] {
  const entries: FilterTreeEntry[] = []
  function visit(node: ReportFilterNode, path: number[]) {
    entries.push({ node, path })
    if (node.Kind !== 3) node.Children.forEach((child, index) => visit(child, [...path, index]))
  }
  visit(tree.Root, [])
  return entries
}

export function readFilterExpressionCapabilities(dataset?: ReportDataset): ReportFilterExpressionCapabilities | null {
  const cap = dataset?.FilterExpression
  if (!record(cap) || cap.Version !== 1 || !Array.isArray(cap.Operators) || !cap.Operators.length
    || new Set(cap.Operators).size !== cap.Operators.length || !cap.Operators.every(item => item === 1 || item === 2)) return null
  for (const [key, limit] of Object.entries(FILTER_EXPRESSION_LIMITS)) if (!integer(cap[key]) || cap[key] < 1 || cap[key] > limit) return null
  return cap as ReportFilterExpressionCapabilities
}

export function filterExpressionScopeError(tree: ReportFilterExpression, selections: ReportSelection[], cap: ReportFilterExpressionCapabilities): string | null {
  const entries = filterTreeEntries(tree), leaves = entries.filter(entry => entry.node.Kind === 3)
  if (entries.length > cap.MaximumNodes || leaves.length > cap.MaximumLeaves || entries.some(entry => entry.path.length + 1 > cap.MaximumDepth))
    return `Логіка умов перевищує межі сервера: ${cap.MaximumDepth} рівнів, ${cap.MaximumLeaves} умов, ${cap.MaximumNodes} вузлів.`
  const allowedOperators = new Set(cap.Operators)
  if (entries.some(({ node }) => node.Kind !== 3 && !allowedOperators.has(node.Kind))) return 'Сервер не підтримує обраний оператор логіки умов.'
  const referenced = new Set<number>()
  for (const { node } of leaves) if (node.Kind === 3) {
    if (!selections[node.SelectionIndex]) return `Логіка умов посилається на відсутню умову №${node.SelectionIndex + 1}. Дерево не змінено.`
    referenced.add(node.SelectionIndex)
  }
  const missing = selections.findIndex((selection, index) => selection?.IsChecked !== false && !referenced.has(index))
  return missing < 0 ? null : `Увімкнену умову №${missing + 1} не включено до логіки. Явно додайте її до потрібної групи.`
}

export function reportFilterExpressionError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (Object.hasOwn(data, 'filterExpression') && Object.hasOwn(data, 'FilterExpression')) return 'Логіку умов задано двічі. Збережені поля не змінено; залиште одне поле логіки.'
  const raw = requestFilterExpression(data)
  if (raw == null) return null
  const tree = readReportFilterExpression(raw)
  if (!tree) return 'Невідома версія або некоректне дерево логіки умов. Оригінал не змінено; перевірте його або явно поверніться до всіх умов через І.'
  const cap = readFilterExpressionCapabilities(dataset)
  if (!cap) return 'Сервер не підтвердив підтримку груп І/АБО для цього набору. Збережену логіку не змінено.'
  if (!Array.isArray(data.selections)) return 'Для логіки умов потрібен вихідний список відборів.'
  return filterExpressionScopeError(tree, data.selections, cap)
}

export function reportSelectionsForRequest(selections: ReportSelection[], raw: unknown): ReportSelection[] {
  return raw != null ? selections : selections.filter(selection => selection.IsChecked && selection.SelectedField.Name)
}

export function createFilterExpression(selections: ReportSelection[], operator: 1 | 2 = 1): ReportFilterExpression {
  return { Version: 1, Root: { Kind: operator, Children: selections.map((_, SelectionIndex) => ({ Kind: 3, SelectionIndex })) } }
}

/** Deletion is explicit; remove its leaf, shift only later indices, keep group operators and empty groups. */
export function removeFilterSelection(raw: unknown, index: number): unknown {
  const tree = readReportFilterExpression(raw)
  if (!tree) return raw
  function adjust(node: ReportFilterNode): ReportFilterNode | null {
    if (node.Kind === 3) return node.SelectionIndex === index ? null : { ...node, SelectionIndex: node.SelectionIndex > index ? node.SelectionIndex - 1 : node.SelectionIndex }
    return { ...node, Children: node.Children.flatMap(child => { const adjusted = adjust(child); return adjusted ? [adjusted] : [] }) }
  }
  return { ...tree, Root: adjust(tree.Root) ?? { Kind: 1, Children: [] } }
}

export const filterPathId = (path: FilterNodePath) => path.length ? path.join('.') : 'root'
export const filterPathContains = (parent: FilterNodePath, child: FilterNodePath) => parent.length <= child.length && parent.every((part, index) => part === child[index])
export function filterNodeAt(tree: ReportFilterExpression, path: FilterNodePath): ReportFilterNode | null {
  let node = tree.Root
  for (const index of path) {
    if (!integer(index) || node.Kind === 3 || !node.Children[index]) return null
    node = node.Children[index]
  }
  return node
}

export type FilterTreeEdit =
  | { kind: 'operator'; path: FilterNodePath; operator: 1 | 2 }
  | { kind: 'add-group'; path: FilterNodePath }
  | { kind: 'add-selection'; path: FilterNodePath; index: number }
  | { kind: 'move'; path: FilterNodePath; target: FilterNodePath }
  | { kind: 'ungroup'; path: FilterNodePath }

/** Mouse drag and keyboard destination controls use the same path-safe, immutable edit. */
export function editFilterExpression(raw: unknown, edit: FilterTreeEdit, cap: ReportFilterExpressionCapabilities): unknown {
  const original = readReportFilterExpression(raw)
  if (!original) return raw
  const tree = structuredClone(original), node = filterNodeAt(tree, edit.path)
  if (!node) return raw
  if (edit.kind === 'operator') {
    if (node.Kind === 3 || !cap.Operators.includes(edit.operator)) return raw
    node.Kind = edit.operator
  } else if (edit.kind === 'add-group' || edit.kind === 'add-selection') {
    if (node.Kind === 3) return raw
    if (edit.kind === 'add-group') node.Children.push({ Kind: cap.Operators[0], Children: [] })
    else {
      if (!integer(edit.index) || filterTreeEntries(tree).some(entry => entry.node.Kind === 3 && entry.node.SelectionIndex === edit.index)) return raw
      node.Children.push({ Kind: 3, SelectionIndex: edit.index })
    }
  } else {
    if (!edit.path.length) return raw
    const parent = filterNodeAt(tree, edit.path.slice(0, -1))
    if (!parent || parent.Kind === 3) return raw
    const index = edit.path.at(-1)!
    if (edit.kind === 'ungroup') {
      if (node.Kind === 3) return raw
      parent.Children.splice(index, 1, ...node.Children)
    } else {
      if (filterPathContains(edit.path, edit.target)) return raw
      // Resolve the target object BEFORE removing its earlier sibling; its path can then shift safely.
      const target = filterNodeAt(tree, edit.target)
      if (!target || target.Kind === 3) return raw
      parent.Children.splice(index, 1)
      target.Children.push(node)
    }
  }
  if (!readReportFilterExpression(tree)) return raw
  const entries = filterTreeEntries(tree)
  if (entries.length > cap.MaximumNodes || entries.filter(entry => entry.node.Kind === 3).length > cap.MaximumLeaves
    || entries.some(entry => entry.path.length + 1 > cap.MaximumDepth)) return raw
  return tree
}
