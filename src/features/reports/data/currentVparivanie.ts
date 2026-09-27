import type { ReportDataset, ReportFilterCondition, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'

export const CURRENT_VPARIVANIE_SOURCE = 39
export const CURRENT_VPARIVANIE_TITLE = 'Впарювання: поточні залишки та продажі GBA'
export const CURRENT_VPARIVANIE_PRODUCT_FIELDS = ['Article', 'Name', 'Description', 'Group', 'OE', 'Size', 'Top'] as const
export const CURRENT_VPARIVANIE_PRODUCT_CAPTIONS = ['Артикул', 'Наименование', 'Описание', 'Группа', 'OE', 'Размер', 'Топ'] as const
export const CURRENT_VPARIVANIE_COUNTERPARTY_IDENTITY = 'NativeClientOrFenixSourceGroupV1'
export function currentVparivanieNotice(managerSupported = false): string {
  return `Залишки — поточна записана вільна кількість GBA. Продажі — за вибраний включний період Europe/Kyiv. Клієнт впливає лише на колонки контрагентів, склад — лише на залишки. ${managerSupported ? 'Менеджер покупця з 1С (Fenix) впливає лише на колонки контрагентів.' : 'Менеджер покупця поки недоступний.'} Невідомі кількості та підсумки різних одиниць залишаються NULL.`
}
export const CURRENT_VPARIVANIE_NOTICE = currentVparivanieNotice()
const invalid = 'Оберіть товари або одну групу товарів, період і показник «Результат». Доступні точні відбори клієнта та складів.'
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const same = (value: unknown, expected: readonly (string | number)[]) => Array.isArray(value)
  && value.length === expected.length && value.every((item, index) => item === expected[index])
const forbidden = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'sourcebuyersubtree', 'suppliersourceworld',
  'currentvparivanie', 'currentvparivanieproducts', 'returnsonly', 'discountmarkup', 'provideddiscounts', 'priceanalysis'])

export function currentVparivanieFilterConditions(field: number): ReportFilterCondition[] {
  if (field === 4) return [{ Type: 6, Name: 'У групі' }]
  if (field === 1 || field === 21) return [{ Type: 0, Name: 'Дорівнює' }, { Type: 2, Name: 'У списку' }]
  return [{ Type: 0, Name: 'Дорівнює' }]
}

export function isCurrentVparivanieCapability(value: unknown): boolean {
  return record(value) && value.Version === 1 && value.StockAnchor === 'CurrentRecordedFree'
    && value.PeriodCalendar === 'Europe/Kyiv' && value.MaximumProducts === 128 && value.MaximumFacts === 20000
    && value.MaximumWarehouses === 32 && same(value.ProductDisplayColumns, CURRENT_VPARIVANIE_PRODUCT_FIELDS)
    && same(value.FixedRowGroupings, [5]) && same(value.FixedColumnGroupings, [74, 75])
    && same(value.FixedMeasurements, [83]) && typeof value.ManagerFilterSupported === 'boolean'
    && value.UnknownQuantity === 'null' && value.MixedUnits === 'null'
    && value.HistoricalStockSupported === false && value.HistoricalXlsParityVerified === false
    && (value.CounterpartyIdentity === undefined || value.CounterpartyIdentity === CURRENT_VPARIVANIE_COUNTERPARTY_IDENTITY)
}

/** Source references remain bytes encoded as hex; they are never native User IDs. */
export function currentVparivanieManagerReference(raw: unknown): string | null {
  return record(raw) && typeof raw.Id === 'string' && /^[a-f\d]{32}$/i.test(raw.Id)
    && Object.keys(raw).filter(key => key.toLowerCase() === 'id').join(',') === 'Id'
    && !/^0{32}$/.test(raw.Id) ? raw.Id.toUpperCase() : null
}

export function currentVparivanieManagerSupported(dataset: ReportDataset): boolean {
  return isCurrentVparivanieCapability(dataset.currentVparivanie)
    && record(dataset.currentVparivanie) && dataset.currentVparivanie.ManagerFilterSupported === true
    && dataset.Filters.some(field => field.Type === 60 && field.Selectable === true)
}

export function isCurrentVparivanieDataset(dataset: ReportDataset): boolean {
  return dataset.DataSource === CURRENT_VPARIVANIE_SOURCE && dataset.PeriodRequired === true && dataset.PeriodSupported === true
    && isCurrentVparivanieCapability(dataset.currentVparivanie)
    && dataset.Groupings.map(item => item.Type).join(',') === '5,74,75'
    && dataset.Measurements.map(item => item.Type).join(',') === '83'
    && dataset.Measurements[0].Name === 'Результат' && dataset.Measurements[0].Selectable !== false
    && dataset.Groupings.every(item => item.Selectable !== false)
    && dataset.Filters.map(item => item.Type).join(',') === '1,4,5,21,60'
    && dataset.Filters.filter(item => item.Type !== 60).every(item => item.Selectable !== false)
    && (record(dataset.currentVparivanie) && dataset.currentVparivanie.ManagerFilterSupported === true
      ? dataset.Filters.find(item => item.Type === 60)?.Selectable === true
      : dataset.Filters.find(item => item.Type === 60)?.Selectable !== true)
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 2000 || year > 7998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Keeps bounded native identities exact; no catalogue or Source request is made here. */
export function currentVparivanieConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== CURRENT_VPARIVANIE_SOURCE) return null
  if (dataset && !isCurrentVparivanieDataset(dataset)) return 'Сервер не підтвердив поточну матрицю «Впарювання».'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to)
    return 'Оберіть коректний включний період продажів «Впарювання».'
  if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= 366)
    return 'Період продажів може охоплювати щонайбільше 366 днів.'
  if (Object.entries(data).some(([key, value]) => forbidden.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  if (!sorted || !Array.isArray(sorted.Row) || sorted.Row.map(item => item.type).join(',') !== '5'
    || !Array.isArray(sorted.Col) || sorted.Col.map(item => item.type).join(',') !== '74,75'
    || !Array.isArray(sorted.Measurements) || sorted.Measurements.map(item => item.Type).join(',') !== '83'
    || sorted.Measurements.some(item => item.IsChecked === false || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')))
    return invalid
  if (!Array.isArray(data.selections) || data.selections.length < 1 || data.selections.length > 5) return invalid
  const fields = new Set<number>()
  for (const selection of data.selections) {
    const field = selection?.SelectedField?.Type
    if (field === 60 && dataset && !currentVparivanieManagerSupported(dataset))
      return 'Відбір за менеджером покупця поки недоступний: точний зв’язок із синхронізованими даними не підтверджено.'
    if (![1, 4, 5, 21, 60].includes(field) || fields.has(field) || selection.IsChecked === false
      || (selection.IsChecked != null && typeof selection.IsChecked !== 'boolean') || !Array.isArray(selection.Values)) return invalid
    const condition = selection.FilterCondition?.Type
    const max = field === 1 ? 128 : field === 21 ? 32 : 1
    if ((field === 4 ? condition !== 6 : field === 5 || field === 60 ? condition !== 0 : condition !== 0 && condition !== 2)
      || selection.Values.length < 1 || selection.Values.length > max
      || (condition === 0 && selection.Values.length !== 1)) return invalid
    const ids = selection.Values.map(item => field === 60 ? currentVparivanieManagerReference(item?.Data) : revenueExactId(item?.Data))
    if (ids.some(id => id === null) || new Set(ids).size !== ids.length
      || selection.Values.some(item => item.Value !== undefined && (!Number.isInteger(item.Value)
        || item.Value < -2147483648 || item.Value > 2147483647))
      || field === 60 && selection.Values.some(item => item.Value !== 0)) return invalid
    fields.add(field)
  }
  return fields.has(1) || fields.has(4) ? null : invalid
}
