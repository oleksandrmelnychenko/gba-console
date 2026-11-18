import { constructorPresentationRequestSupported, constructorPresentationSupported } from './constructorPresentation'
import { readReportProfile, requestReportProfile, type SalesConstructorProfile } from './salesConstructorProfiles'
import { canonicalFilterField, groupCanonicalFilterOptions } from './reportFilterFields'
import type { ReportDataset, ReportMeasurementGroup, ReportMeasurementItem, ReportRequestBody } from '../types'

export const CONSTRUCTOR_CONDITION_LABELS: Readonly<Record<number, string>> = {
  0: 'Рівне',
  1: 'Не рівне',
  2: 'В списку',
  3: 'В групі зі списку',
  4: 'Не в списку',
  5: 'Не в групі зі списку',
  6: 'В групі',
  7: 'Не в групі',
}

export const PROPERTIES_AND_CATEGORIES_UNAVAILABLE = 'Додаткові властивості й категорії недоступні. Поля товару — в «Додаткових налаштуваннях».'

export function constructorConditionLabel(type: number, fallback: string): string {
  return CONSTRUCTOR_CONDITION_LABELS[type] ?? fallback
}

export function usesConstructorDesk(dataset: ReportDataset | undefined, request: ReportRequestBody): boolean {
  return !!dataset && dataset.DataSource === request.dataSource && constructorPresentationSupported(dataset)
    && constructorPresentationRequestSupported(request)
}

export function constructorProfile(request: ReportRequestBody): SalesConstructorProfile | undefined {
  return request.dataSource === 2 ? readReportProfile(requestReportProfile(request)) : undefined
}

export type ConstructorField = { type: number; label: string; path: string[]; caption?: string }

const PERIOD_TYPES = new Set([0, 1, 2, 3])
const SALES_GROUPING_LABELS: Readonly<Record<number, { label: string; path?: string; caption?: string }>> = {
  0: { label: 'По роках' },
  1: { label: 'По кварталах' },
  2: { label: 'По місяцях' },
  3: { label: 'По днях' },
  4: { label: 'Організація' },
  5: { label: 'Товар', path: 'Товар', caption: 'Товар' },
  6: { label: 'Артикул', path: 'Товар', caption: 'Артикул' },
  7: { label: 'Назва', path: 'Товар', caption: 'Назва товару' },
  8: { label: 'Опис', path: 'Товар', caption: 'Опис товару' },
  9: { label: 'Топ', path: 'Товар', caption: 'Топ товару' },
  10: { label: 'Товарна група', path: 'Товар', caption: 'Товарна група' },
  83: { label: 'Розмір', path: 'Товар', caption: 'Розмір товару' },
  28: { label: 'Одиниця виміру', path: 'Товар', caption: 'Одиниця виміру' },
  12: { label: 'Назва', path: 'Покупець', caption: 'Покупець' },
  13: { label: 'Регіон', path: 'Покупець' },
  14: { label: 'Код по регіону', path: 'Покупець' },
  15: { label: 'Договір', path: 'Покупець' },
  16: { label: 'Відповідальний менеджер покупця', path: 'Покупець' },
  17: { label: 'Документ (номер дата ВН)', path: 'Документ продажу', caption: 'Документ продажу' },
  18: { label: 'Повернення від клієнта', path: 'Документ продажу', caption: 'Повернення від клієнта' },
  19: { label: 'Відповідальний менеджер що забив товар', path: 'Документ продажу' },
  20: { label: 'Відповідальний менеджер що перевів в статус накладної', path: 'Документ продажу' },
  21: { label: 'Постачальник' },
  46: { label: 'ABC-клас', path: 'Аналітика' },
  84: { label: 'Детальний запис' },
}

function groupingCategory(type: number): string | undefined {
  if (PERIOD_TYPES.has(type) || type === 4 || type === 34) return undefined
  if ([5, 6, 7, 8, 9, 10, 28, 83].includes(type)) return 'Товар'
  if ([11, 12, 13, 14, 15, 16, 79, 80].includes(type)) return 'Покупець'
  if ([17, 18, 19, 20, 22, 23, 66, 67, 81].includes(type)) return 'Документ продажу'
  if ([21, 24, 25].includes(type)) return 'Постачальник'
  if ([29, 30, 31, 32, 33].includes(type)) return 'Склад'
  if (type === 82) return 'Набір клієнтів'
  if (type === 46) return 'Аналітика'
  return 'Інше'
}

export function constructorGroupingField(request: ReportRequestBody, type: number, name: string): ConstructorField {
  if (constructorProfile(request)) {
    const known = SALES_GROUPING_LABELS[type]
    if (known) return { type, label: known.label, path: known.path ? [known.path] : [], caption: known.caption ?? known.label }
  }
  const category = groupingCategory(type)
  return { type, label: name, path: category ? [category] : [] }
}

export function constructorGroupingCaption(request: ReportRequestBody, type: number, name: string): string {
  if (!constructorProfile(request)) return name
  const known = SALES_GROUPING_LABELS[type]
  if (!known) return name
  return known.caption ?? known.label
}

export function constructorFilterField(request: ReportRequestBody, type: number, name: string): ConstructorField {
  const field = canonicalFilterField(request.dataSource, type, name)
  return { type, label: field.label, path: field.section ? [field.section] : [] }
}

export function constructorFilterGroups(request: ReportRequestBody, options: ReadonlyArray<{ value: string; label: string; disabled?: boolean; field: { Type: number } }>) {
  return groupCanonicalFilterOptions(request.dataSource, options)
}

type MeasureCaption = { group: string; items?: Readonly<Record<number, string>> }

const SALES_MEASURE_CAPTIONS: Readonly<Record<string, MeasureCaption>> = {
  SalesQuantity: { group: 'Кількість продажу' },
  SalesValue: { group: 'Вартість продажу', items: { 2: 'без ПДВ', 3: 'ПДВ', 4: 'з ПДВ' } },
  Cost: { group: 'Собівартість', items: { 6: 'без ПДВ', 7: 'ПДВ', 8: 'з ПДВ' } },
  Markup: { group: 'Валовий прибуток', items: { 10: 'без ПДВ', 11: 'ПДВ', 12: 'з ПДВ' } },
  Profitability: { group: 'Націнка, %', items: { 14: 'без ПДВ', 15: 'з ПДВ' } },
  MarginPercent: { group: 'Маржа, %', items: { 115: 'без ПДВ', 116: 'з ПДВ' } },
}

const GROSS_PROFIT_MEASURE_CAPTIONS: Readonly<Record<string, MeasureCaption>> = {
  SalesQuantity: { group: 'Кількість (од. зберігання)' },
  SalesValue: { group: 'Вартість продажу (EUR)', items: { 2: 'Без ПДВ', 3: 'ПДВ', 4: 'З ПДВ' } },
  Cost: { group: 'Собівартість (EUR)', items: { 6: 'Без ПДВ', 7: 'ПДВ', 8: 'З ПДВ' } },
  Markup: { group: 'Валовий прибуток (EUR)', items: { 10: 'Без ПДВ', 12: 'З ПДВ' } },
  Profitability: { group: 'Націнка, %' },
  MarginPercent: { group: 'Маржа, %' },
}

function profileMeasureCaptions(request: ReportRequestBody): Readonly<Record<string, MeasureCaption>> | undefined {
  const profile = constructorProfile(request)
  return profile === 'sales' ? SALES_MEASURE_CAPTIONS : profile === 'grossProfit' ? GROSS_PROFIT_MEASURE_CAPTIONS : undefined
}

export function constructorMeasureGroupCaption(request: ReportRequestBody, group: ReportMeasurementGroup, fallback: string): string {
  return profileMeasureCaptions(request)?.[group.Name]?.group ?? fallback
}

export function constructorMeasureItemCaption(request: ReportRequestBody, group: ReportMeasurementGroup, item: ReportMeasurementItem): string | undefined {
  return profileMeasureCaptions(request)?.[group.Name]?.items?.[item.Type]
}
