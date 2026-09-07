import type { ReportDataset, ReportFilterField, ReportGroupingItem, ReportMeasurementGroup, ReportMeasurementSelection, ReportRequestBody } from '../types'
import { createDefaultMeasurementGroups, flattenCheckedMeasurements, flattenGroupingOptions, REPORT_FILTER_CONDITIONS, REPORT_FILTER_FIELD_GROUPS } from './reportOptions'
import { createSalesReportPreset, SALES_REPORT_PRESETS, type SalesReportPresetId } from './reportPresets'

export type DatasetReportPresetId = SalesReportPresetId | 'quantities-by-unit'
type DatasetReportPreset = { id: DatasetReportPresetId; name: string; description: string }
const QUANTITY_BY_UNIT_PRESET: DatasetReportPreset = {
  id: 'quantities-by-unit', name: 'Кількість за одиницями',
  description: 'Одиниця виміру → день. Окрема кількість для кожної одиниці виміру, без додавання різних одиниць.',
}

const GROUPING_KEYS = new Map(flattenGroupingOptions().map(item => [item.type, item.key]))
GROUPING_KEYS.set(24, 'PurchaseDocument')
GROUPING_KEYS.set(25, 'SupplierContract')
// Preserve the already published price identities. Quantity units use 28.
GROUPING_KEYS.set(26, 'SalesUnitGrossPrice')
GROUPING_KEYS.set(27, 'CostUnitGrossPrice')

const FILTER_KEYS = new Map(REPORT_FILTER_FIELD_GROUPS.flatMap(group => group.children.map(item => [item.type, item.label] as const)))
FILTER_KEYS.set(1, 'Product')
FILTER_KEYS.set(10, 'CustomerManager')
FILTER_KEYS.set(12, 'SaleDocument')
FILTER_KEYS.set(17, 'Supplier')
FILTER_KEYS.set(18, 'SupplierContract')
FILTER_KEYS.set(19, 'PurchaseDocument')

export function datasetGroupings(dataset: ReportDataset | undefined): ReportGroupingItem[] {
  return dataset?.Groupings.map(field => ({ key: GROUPING_KEYS.get(field.Type) ?? field.Name, label: field.Name, type: field.Type })) ?? []
}

export function datasetFilters(dataset: ReportDataset | undefined): Array<{ label: string; value: string; field: ReportFilterField }> {
  return dataset?.Filters.map(field => ({ label: field.Name, value: String(field.Type), field: {
    Name: FILTER_KEYS.get(field.Type) ?? field.Name, Type: field.Type,
  } })) ?? []
}

/** Captions come from the selected dataset; numeric identities remain the wire contract. */
export function datasetMeasurements(dataset: ReportDataset | undefined, selected: ReportMeasurementSelection[] = []): ReportMeasurementGroup[] {
  if (!dataset) return []
  const fields = new Map(dataset.Measurements.map(field => [field.Type, field]))
  const checked = new Set(selected.flatMap(item => item.IsChecked ? [item.Type] : []))
  const known = new Set<number>()
  const groups = createDefaultMeasurementGroups().flatMap(group => {
    const SubList = group.SubList.flatMap(item => {
      const field = fields.get(item.Type)
      if (!field || (field.Selectable === false && !checked.has(item.Type))) return []
      known.add(item.Type)
      return [{ ...item, Label: field.Name, IsChecked: checked.has(item.Type) }]
    })
    if (!SubList.length) return []
    // Purchase/net datasets may reuse measure codes with different meanings.
    const Label = dataset.DataSource === 0 ? undefined : SubList.length === 1 ? SubList[0].Label
      : dataset.DataSource === 2 && group.Name === 'SalesValue' ? 'Продажі з урахуванням повернень' : undefined
    return [{ ...group, Label, SubList, IsChecked: SubList.every(item => item.IsChecked) }]
  })
  for (const field of dataset.Measurements) {
    if (known.has(field.Type) || (field.Selectable === false && !checked.has(field.Type))) continue
    groups.push({ Name: field.Name, Label: field.Name, IsChecked: checked.has(field.Type),
      SubList: [{ Name: field.Name, Label: field.Name, Type: field.Type, IsChecked: checked.has(field.Type) }] })
  }
  return groups
}

export function defaultDatasetRequest(dataset: ReportDataset, from: string, to: string): ReportRequestBody {
  const groupings = datasetGroupings(dataset)
  const row = groupings.find(item => item.type === 3) ?? groupings[0]
  const unit = groupings.find(item => item.type === 28)
  const available = dataset.Measurements.filter(field => field.Selectable !== false)
  const preferred = available.filter(field => field.Type === 0 || field.Type === (dataset.DataSource === 3 ? 2 : 4))
  const fields = preferred.length ? preferred : available.slice(0, 1)
  const selected = fields.map(field => ({ ...field, IsChecked: true, parentName: '' }))
  return { dataSource: dataset.DataSource, from, to, selections: [], sorted: {
    Row: [unit, row].filter((item, index, items): item is ReportGroupingItem => Boolean(item) && items.indexOf(item) === index),
    Col: [], Measurements: flattenCheckedMeasurements(datasetMeasurements(dataset, selected)),
  } }
}

/** Refuse incompatible saved settings before mutating the form. Never remove or remap a filter. */
export function datasetConfigurationError(data: ReportRequestBody, dataset: ReportDataset | undefined): string | null {
  if (data.dataSource === 1 || data.oneC) return 'Шаблон використовує архівне джерело 1С, яке більше не доступне. Налаштування не застосовано.'
  if (!dataset || (data.dataSource ?? 0) !== dataset.DataSource) return 'Набір даних цього звіту недоступний. Налаштування не застосовано.'
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements) || !Array.isArray(data.selections)) {
    return 'Шаблон містить некоректні налаштування. Налаштування не застосовано.'
  }
  const groupingTypes = new Set(dataset.Groupings.map(field => field.Type))
  const measurementTypes = new Set(dataset.Measurements.map(field => field.Type))
  const filterTypes = new Set(dataset.Filters.map(field => field.Type))
  const conditionTypes = new Set(REPORT_FILTER_CONDITIONS.map(field => field.Type))
  const unsupported = [
    ...[...data.sorted.Row, ...data.sorted.Col].flatMap(item => groupingTypes.has(item.type) ? [] : [item.label || item.key || `#${item.type}`]),
    ...data.sorted.Measurements.flatMap(item => measurementTypes.has(item.Type) ? [] : [item.Name || `#${item.Type}`]),
    ...data.selections.flatMap(item => filterTypes.has(item.SelectedField?.Type) && conditionTypes.has(item.FilterCondition?.Type)
      ? [] : [item.SelectedField?.Name || 'Умова відбору']),
  ]
  return unsupported.length ? `Набір «${dataset.Name}» не підтримує налаштування: ${unsupported.join(', ')}. Налаштування не застосовано.` : null
}

export function datasetPresets(dataset: ReportDataset | undefined): DatasetReportPreset[] {
  if (!dataset || ![0, 2, 3].includes(dataset.DataSource)) return []
  const presets: DatasetReportPreset[] = []
  if ([28, 3].every(type => dataset.Groupings.some(field => field.Type === type))
    && dataset.Measurements.some(field => field.Type === 0 && field.Selectable !== false)) {
    presets.push(QUANTITY_BY_UNIT_PRESET)
  }
  if (dataset.DataSource === 3) return presets
  return [...presets, ...SALES_REPORT_PRESETS.flatMap(preset => {
    const data = createSalesReportPreset(preset.id, '', '', []).Data
    if (datasetConfigurationError({ ...data, dataSource: dataset.DataSource }, dataset)) return []
    return [{ ...preset,
      name: dataset.DataSource === 2 ? preset.name.replace('Продажі', 'Чисті продажі') : preset.name,
      description: dataset.DataSource === 2 ? `${preset.description} Повернення віднімаються за правилами цього набору даних.` : preset.description,
    }]
  })]
}

export function datasetPresetRequest(dataset: ReportDataset, id: DatasetReportPresetId, current: ReportRequestBody) {
  const preset = datasetPresets(dataset).find(item => item.id === id)
  if (!preset) return null
  if (id === 'quantities-by-unit') {
    const data = defaultDatasetRequest(dataset, current.from, current.to)
    return { Name: preset.name, Data: { ...data, selections: structuredClone(current.selections), sorted: {
      ...data.sorted, Measurements: data.sorted.Measurements.filter(field => field.Type === 0),
    } } }
  }
  const template = createSalesReportPreset(id, current.from, current.to, current.selections)
  return { ...template, Name: preset.name, Data: { ...template.Data, dataSource: dataset.DataSource } }
}
