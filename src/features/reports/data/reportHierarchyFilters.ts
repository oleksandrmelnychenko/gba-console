import { analysisHierarchyIdentity, isAnalysisHierarchy, validAnalysisFilterValue, type AnalysisFieldDescriptor, type AnalysisHierarchy } from './currentVparivanieAnalysis'
import type { ReportDataset, ReportFilterCondition, ReportSelection } from '../types'

export const GROUP_CONDITION_TYPES = [3, 5, 6, 7] as const
const GROUP_CONDITION_NAMES: Record<number, string> = { 3: 'У групі зі списку', 5: 'Не у групі зі списку', 6: 'У групі', 7: 'Не у групі' }
const POSITIVE_GROUPS = [3, 6]
const NEGATIVE_GROUPS = [5, 7]
export const MAXIMUM_GROUP_VALUES = 100

export function datasetFieldHierarchy(dataset: ReportDataset | null | undefined, field: number | undefined): AnalysisHierarchy | undefined {
  if (!dataset || dataset.DataSource === 39 || field === undefined) return undefined
  const hierarchy = dataset.Filters.find(item => item.Type === field)?.hierarchy
  return hierarchy && isAnalysisHierarchy(hierarchy, field) ? hierarchy : undefined
}

export function datasetHierarchyDescriptor(dataset: ReportDataset | null | undefined, field: number, name: string): AnalysisFieldDescriptor | undefined {
  const hierarchy = datasetFieldHierarchy(dataset, field)
  return hierarchy ? { type: field, name, path: [], valueKind: 'nativeId', branches: [], conditions: [0, 1, 2, 3, 4, 5, 6, 7],
    lookupKind: 'nativeId', coverage: 'currentMasterData', hierarchy } : undefined
}

export function isGroupConditionType(condition: number | undefined): boolean {
  return condition !== undefined && (GROUP_CONDITION_TYPES as readonly number[]).includes(condition)
}

export function isDatasetGroupSelection(dataset: ReportDataset | null | undefined, selection: ReportSelection | null | undefined): boolean {
  return !!selection && isGroupConditionType(selection.FilterCondition?.Type) && !!datasetFieldHierarchy(dataset, selection.SelectedField?.Type)
}

export function datasetGroupConditionTypes(dataset: ReportDataset | null | undefined, field: number | undefined, admitted: Iterable<number>): number[] {
  if (!datasetFieldHierarchy(dataset, field)) return []
  const base = new Set(admitted)
  return [...(base.has(2) ? POSITIVE_GROUPS : []), ...(base.has(4) ? NEGATIVE_GROUPS : [])]
}

export function withDatasetGroupConditions(dataset: ReportDataset | null | undefined, field: number | undefined,
  conditions: readonly ReportFilterCondition[], admitted: Iterable<number> = conditions.map(condition => condition.Type)): ReportFilterCondition[] {
  const groups = datasetGroupConditionTypes(dataset, field, admitted)
  if (!groups.length) return [...conditions]
  return [...conditions, ...groups.filter(type => !conditions.some(condition => condition.Type === type))
    .map(Type => ({ Type, Name: GROUP_CONDITION_NAMES[Type] }))].sort((a, b) => a.Type - b.Type)
}

export function datasetGroupSelectionError(dataset: ReportDataset | null | undefined, selection: ReportSelection): string | null {
  const field = selection.SelectedField.Type, condition = selection.FilterCondition.Type
  const descriptor = datasetHierarchyDescriptor(dataset, field, selection.SelectedField.Name)
  if (!descriptor) return null
  if (isGroupConditionType(condition)) {
    if (selection.Values.length > MAXIMUM_GROUP_VALUES) return 'Оберіть до 100 груп і значень.'
    if ([6, 7].includes(condition) && selection.Values.length > 1) return 'Оберіть одну групу для цієї умови.'
    if (selection.Values.some(value => !validAnalysisFilterValue(field, value.Data, descriptor, condition)))
      return [6, 7].includes(condition)
        ? 'Для умов «У групі» та «Не у групі» оберіть групу; окремі значення доступні в умовах «У групі зі списку» та «Не у групі зі списку».'
        : 'Оберіть групи або значення зі списку ще раз.'
    return null
  }
  return selection.Values.some(value => analysisHierarchyIdentity(field, value.Data))
    ? 'Групи можна обрати лише в умовах «У групі…»; приберіть групи або змініть умову.' : null
}
