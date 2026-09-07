import type { ReportDataset, ReportOrderRule, ReportOrdering, ReportOrderingCapabilities, ReportRequestBody } from '../types'
import type { ReportGroupingLayout } from './reportGroupingLayout'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const onlyKeys = (value: Record<string, unknown>, keys: ReadonlySet<string>) => Object.keys(value).every(key => keys.has(key))
const orderingKeys = new Set(['Version', 'Rows', 'Columns'])
const ruleKeys = new Set(['Grouping', 'By', 'Direction', 'Nulls', 'Measure'])
const axes = [['Rows', 'Row'], ['Columns', 'Col']] as const
export function requestOrdering(data: ReportRequestBody): unknown { return Object.hasOwn(data, 'ordering') ? data.ordering : data.Ordering }

/** Read the declared shape intact. Unknown fields and missing numeric selectors never receive defaults. */
export function readReportOrdering(value: unknown): ReportOrdering | null {
  if (!record(value) || !onlyKeys(value, orderingKeys) || value.Version !== 1
    || !Array.isArray(value.Rows) || !Array.isArray(value.Columns) || value.Rows.length + value.Columns.length > 32) return null
  for (const [axis] of axes) {
    const groups = new Set<number>()
    for (const rule of value[axis] as unknown[]) {
      if (!record(rule) || !onlyKeys(rule, ruleKeys)
        || !integer(rule.Grouping) || groups.has(rule.Grouping) || ![1, 2, 3].includes(Number(rule.By)) || typeof rule.By !== 'number'
        || ![1, 2].includes(Number(rule.Direction)) || typeof rule.Direction !== 'number'
        || ![1, 2].includes(Number(rule.Nulls)) || typeof rule.Nulls !== 'number'
        || (rule.Measure != null && !integer(rule.Measure))) return null
      groups.add(rule.Grouping)
    }
  }
  return value as ReportOrdering
}

export function readOrderingCapabilities(dataset: ReportDataset | undefined): ReportOrderingCapabilities | null {
  const value = dataset?.Ordering
  if (!record(value) || value.Version !== 1 || !integer(value.MaximumRules) || value.MaximumRules < 1 || value.MaximumRules > 32
    || !Array.isArray(value.Groupings)) return null
  const seen = new Set<number>()
  for (const item of value.Groupings) {
    if (!record(item) || !integer(item.Type) || seen.has(item.Type) || !dataset?.Groupings.some(field => field.Type === item.Type)
      || !Array.isArray(item.By) || !item.By.length || new Set(item.By).size !== item.By.length
      || !item.By.every(by => typeof by === 'number' && [1, 2, 3].includes(by))) return null
    seen.add(item.Type)
  }
  return value as ReportOrderingCapabilities
}

export function reportOrderingError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (Object.hasOwn(data, 'ordering') && Object.hasOwn(data, 'Ordering')) return 'Сортування задане двічі. Збережені правила не змінено; залиште одне поле сортування.'
  const raw = requestOrdering(data)
  if (raw == null) return null
  const ordering = readReportOrdering(raw)
  if (!ordering) return 'Невідома версія або некоректні правила сортування. Збережені правила не змінено; перевірте їх або явно очистіть сортування.'
  if (ordering.Rows.length + ordering.Columns.length === 0) return null
  const capabilities = readOrderingCapabilities(dataset)
  if (!capabilities) return 'Сервер не підтвердив можливості сортування цього набору. Збережені правила не змінено.'
  if (ordering.Rows.length + ordering.Columns.length > capabilities.MaximumRules) return `Сортування підтримує не більше ${capabilities.MaximumRules} правил для обох осей.`
  const fieldsByType = new Map(dataset!.Groupings.map(field => [field.Type, field]))
  const capabilitiesByType = new Map(capabilities.Groupings.map(field => [field.Type, field]))
  for (const [ruleAxis, layoutAxis] of axes) for (const rule of ordering[ruleAxis]) {
    const field = fieldsByType.get(rule.Grouping), caption = field?.Name ?? `[${rule.Grouping}]`
    const capability = capabilitiesByType.get(rule.Grouping)
    if (!field || data.sorted?.[layoutAxis]?.filter(item => item.type === rule.Grouping).length !== 1)
      return `Сортування поля «${caption}»: виберіть поле рівно один раз на відповідній осі.`
    if (!capability?.By.includes(rule.By)) return `Сортування поля «${caption}»: цей спосіб не підтримується сервером. Для дат і чисел оберіть значення поля.`
    if (rule.By === 3) {
      if (rule.Measure == null || !data.sorted.Measurements.some(item => item.Type === rule.Measure && item.IsChecked)
        || !dataset!.Measurements.some(item => item.Type === rule.Measure)) return `Сортування поля «${caption}»: виберіть один увімкнений показник. Правило збережено.`
    } else if (rule.Measure != null) return `Сортування поля «${caption}»: показник застосовується лише до сортування за підсумком.`
  }
  return null
}

/** An explicit layout edit carries rules with their exact group and reports each removed target. */
export function reconcileReportOrdering(raw: unknown, previous: ReportGroupingLayout, next: ReportGroupingLayout) {
  const ordering = readReportOrdering(raw)
  if (!ordering) return { ordering: raw, removed: [] as number[], moved: [] as number[] }
  const result: ReportOrdering = { Version: 1, Rows: [], Columns: [] }, removed: number[] = [], moved: number[] = []
  for (const [ruleAxis, layoutAxis] of axes) for (const rule of ordering[ruleAxis]) {
    if (next[layoutAxis].some(item => item.type === rule.Grouping)) { result[ruleAxis].push(rule); continue }
    const opposite = layoutAxis === 'Row' ? 'Col' : 'Row', targetAxis = ruleAxis === 'Rows' ? 'Columns' : 'Rows'
    if (previous[layoutAxis].some(item => item.type === rule.Grouping) && next[opposite].filter(item => item.type === rule.Grouping).length === 1) {
      result[targetAxis].push(rule); moved.push(rule.Grouping)
    } else if (previous[layoutAxis].some(item => item.type === rule.Grouping)) removed.push(rule.Grouping)
    else result[ruleAxis].push(rule) // Preserve an already invalid imported target for correction.
  }
  return { ordering: result, removed, moved }
}

export function setReportOrderRule(raw: unknown, axis: 'Rows' | 'Columns', grouping: number, rule: ReportOrderRule | null): unknown {
  if (raw != null && !readReportOrdering(raw)) return raw
  const ordering = readReportOrdering(raw) ?? { Version: 1, Rows: [], Columns: [] }
  return { ...ordering, [axis]: [...ordering[axis].filter(item => item.Grouping !== grouping), ...(rule ? [rule] : [])] }
}
