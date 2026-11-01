import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import { canonicalCustomerGroupInt64Id, customerGroupInt64Id } from './customerGroupInt64'
import { customerGroupTopName, validCustomerGroupTopName } from './customerGroupTop'
import { reportSelectionCardinalityError } from './reportOptions'

export const NATIVE_PRICE_FILTER_FIELDS = [3, 4, 7, 8, 10, 12, 14, 15, 16, 21] as const
export type NativePriceFilterField = typeof NATIVE_PRICE_FILTER_FIELDS[number]
export type NativePriceFilterDescriptor = {
  fieldType: NativePriceFilterField
  identityKind: 'rawString' | 'positiveInt64String'
  exactParameter: 'exactValue' | 'exactId'
  periodRequired: boolean
  conditions: [0, 1, 2, 4]
  hierarchy: false
}
export const PRICE_FILTER_ENDPOINT = 'datasets/price-comparison/filters/lookup'
export const PRICE_TOP_REFERENCE_NOTE = 'Пошук точного коду TOP відновлює записане значення. Відбір TOP застосовує чинні правила порівняння GBA: регістр літер і кінцеві пробіли можуть не розрізнятися.'
export const PRICE_FILTER_UNAVAILABLE = 'Сервер не підтвердив довідник цього відбору. Збережені значення залишено без змін.'
const CAP_KEYS = ['version', 'dataSource', 'endpoint', 'paging', 'maximumPageSize', 'fields']
const FIELD_KEYS = ['fieldType', 'identityKind', 'exactParameter', 'periodRequired', 'conditions', 'hierarchy']
const FLAT = [0, 1, 2, 4]
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export function isNativePriceFilterField(source: number | undefined, field: number): field is NativePriceFilterField {
  return source === 46 && NATIVE_PRICE_FILTER_FIELDS.some(value => value === field)
}
export function priceFilterDescriptor(field: NativePriceFilterField): NativePriceFilterDescriptor {
  return { fieldType: field, identityKind: field === 3 ? 'rawString' : 'positiveInt64String',
    exactParameter: field === 3 ? 'exactValue' : 'exactId', periodRequired: field === 12 || field === 14,
    conditions: [0, 1, 2, 4], hierarchy: false }
}
function validDescriptor(value: unknown): value is NativePriceFilterDescriptor {
  if (!record(value) || !exactKeys(value, FIELD_KEYS) || typeof value.fieldType !== 'number' || !isNativePriceFilterField(46, value.fieldType)) return false
  const expected = priceFilterDescriptor(value.fieldType)
  return value.identityKind === expected.identityKind && value.exactParameter === expected.exactParameter
    && value.periodRequired === expected.periodRequired && value.hierarchy === false
    && Array.isArray(value.conditions) && value.conditions.length === 4 && value.conditions.every((item, index) => item === FLAT[index])
}
export function nativePriceFilterCapability(dataset: ReportDataset | null | undefined, source: number) {
  if (source !== 46 || dataset?.DataSource !== source || !Array.isArray(dataset.Filters)) return null
  const value = dataset.priceFilterLookup
  if (!record(value) || !exactKeys(value, CAP_KEYS) || value.version !== 1 || value.dataSource !== source
    || value.endpoint !== PRICE_FILTER_ENDPOINT || value.paging !== 'offset' || value.maximumPageSize !== 50
    || !Array.isArray(value.fields) || ![9, 10].includes(value.fields.length)
    || !value.fields.every(validDescriptor)) return null
  const fields = value.fields
  const expected = fields.length === 9 ? NATIVE_PRICE_FILTER_FIELDS.filter(field => field !== 21) : NATIVE_PRICE_FILTER_FIELDS
  if (new Set(fields.map(field => field.fieldType)).size !== expected.length
    || expected.some(type => !fields.some(field => field.fieldType === type))
    || fields.some(field => !dataset.Filters.some(filter => filter && filter.Type === field.fieldType && filter.Selectable !== false))) return null
  return fields
}
export function nativePriceFilterDescriptor(dataset: ReportDataset | null | undefined, source: number, field: number) {
  return nativePriceFilterCapability(dataset, source)?.find(item => item.fieldType === field) ?? null
}
export function nativePriceSavedKey(field: NativePriceFilterField, value: ReportSelectedValue): string | null {
  return field === 3 ? customerGroupTopName(value.Data) : customerGroupInt64Id(value.Data)
}
export function nativePriceRawKey(field: NativePriceFilterField, value: unknown): string | null {
  return field === 3 ? validCustomerGroupTopName(value) ? value : null : canonicalCustomerGroupInt64Id(value)
}
export function nativePriceFilterSelectionError(source: number, selections: ReportSelection[], dataset?: ReportDataset | null): string | null {
  if (source !== 46) return null
  for (const selection of selections) {
    const field = selection.SelectedField.Type
    if (selection.IsChecked === false || !isNativePriceFilterField(source, field)) continue
    if (!nativePriceFilterDescriptor(dataset, source, field)) return PRICE_FILTER_UNAVAILABLE
    if (!FLAT.includes(selection.FilterCondition.Type) || selection.Values.length > 100) return 'Оберіть до 100 значень і одну з чотирьох умов відбору.'
    const cardinality = reportSelectionCardinalityError(selection)
    if (cardinality) return cardinality
    if (!selection.Values.length) return 'Оберіть значення або вимкніть цю умову.'
    if (selection.Values.some(value => nativePriceSavedKey(field, value) === null)) return 'Збережений ключ відбору не підтверджено. Оберіть значення повторно або вимкніть умову.'
  }
  return null
}
export const PRICE_FILTER_HELP: Record<NativePriceFilterField, string> = {
  3: `TOP — поточна позначка картки товару. ${PRICE_TOP_REFERENCE_NOTE}`,
  4: 'Поточні прямі групи товару, без нащадків і без основної групи. Кілька груп не множать суми.',
  7: 'Поточний регіон клієнта власного договору продажу або повернення. Це не історичний регіон документа.',
  8: 'Поточний код регіону клієнта власного договору продажу або повернення. Обирається точний код, а не батьківський регіон.',
  10: 'Поточний основний менеджер клієнта власного договору продажу або повернення, а не автор продажу.',
  12: 'Документ продажу за вибраний період або підтверджений первинний продаж для повернення в цьому періоді.',
  14: 'Власний документ повернення за його датою у вибраному періоді, а не перше пов’язане повернення.',
  15: 'Користувач, який додав товар у первинний продаж. Для повернення — автор початкового рядка, а не автор повернення.',
  16: 'Користувач, який провів накладну первинного продажу. Для повернення — підтверджувач початкового продажу.',
  21: 'Фактичні склади підтвердженого списання GBA, а не склад у заголовку продажу. Назви поточні; архівні записи доступні за назвою та точним ID. Повернення — за власним складом. За цим відбором сума до знижки та похідні показники знижки порожні без підтвердженого розподілу.',
}
