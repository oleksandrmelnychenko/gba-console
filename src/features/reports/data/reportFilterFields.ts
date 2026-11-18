export type CanonicalFilterField = { label: string; section?: string; order: number }

export const REPORT_FILTER_SECTIONS = ['Товар', 'Покупець', 'Документ продажу', 'Постачальник', 'Склад', 'Документ руху', 'Рахунок', 'Інше'] as const

const SECTION_TITLES: Readonly<Record<string, string>> = {
  'Товар': 'Товари', 'Покупець': 'Покупці', 'Документ продажу': 'Документи продажу', 'Постачальник': 'Постачальники',
  'Склад': 'Склади', 'Документ руху': 'Документи руху', 'Рахунок': 'Рахунки',
}

const CANONICAL_FIELDS: ReadonlyArray<readonly [number, string | null, string?]> = [
  [0, 'Організація'],
  [32, 'Організація'],
  [1, 'Товар', 'Товар'],
  [2, 'Артикул', 'Товар'],
  [3, 'Топ', 'Товар'],
  [4, 'Товарна група', 'Товар'],
  [75, null, 'Товар'],
  [20, 'Одиниця виміру', 'Товар'],
  [5, 'Покупець', 'Покупець'],
  [6, 'Покупець', 'Покупець'],
  [7, 'Регіон', 'Покупець'],
  [8, 'Код по регіону', 'Покупець'],
  [61, 'Код по регіону', 'Покупець'],
  [9, 'Договір', 'Покупець'],
  [10, 'Відповідальний менеджер покупця', 'Покупець'],
  [60, 'Відповідальний менеджер покупця', 'Покупець'],
  [11, 'Тип цін покупця', 'Покупець'],
  [12, 'Документ продажу', 'Документ продажу'],
  [13, null, 'Документ продажу'],
  [14, 'Повернення від клієнта', 'Документ продажу'],
  [15, 'Відповідальний менеджер що забив товар', 'Документ продажу'],
  [16, 'Відповідальний менеджер що перевів в статус накладної', 'Документ продажу'],
  [62, null, 'Документ продажу'],
  [63, null, 'Документ продажу'],
  [64, 'Причина повернення', 'Документ продажу'],
  [17, null, 'Постачальник'],
  [18, null, 'Постачальник'],
  [19, null, 'Постачальник'],
  [24, null, 'Постачальник'],
  [27, null, 'Постачальник'],
  [21, 'Склад', 'Склад'],
  [23, null, 'Склад'],
  [22, null, 'Склад'],
  [29, null, 'Рахунок'],
  [30, null, 'Рахунок'],
  [33, null, 'Рахунок'],
]

const BY_TYPE = new Map(CANONICAL_FIELDS.map(([type, label, section], order) => [type, { label, section, order }]))


function fallbackSection(type: number): string | undefined {
  if (type === 28) return undefined
  if ([31, 34, 35, 36, 37, 38].includes(type)) return 'Рахунок'
  return 'Інше'
}

export function canonicalFilterField(dataSource: number | undefined, type: number, name: string): CanonicalFilterField {
  const known = BY_TYPE.get(type)
  const own = dataSource === 39 && type === 6
  if (known && !own) return { label: known.label ?? name, section: dataSource === 41 && type === 30 ? undefined : known.section, order: known.order }
  return { label: name, section: own ? 'Покупець' : fallbackSection(type), order: known?.order ?? CANONICAL_FIELDS.length }
}

export function canonicalFilterLabel(dataSource: number | undefined, type: number, name: string): string {
  return canonicalFilterField(dataSource, type, name).label
}

type GroupableOption = { value: string; label: string; disabled?: boolean; section?: string; field: { Type: number } }
type GroupedItem = { value: string; label: string; disabled?: boolean }

export function groupCanonicalFilterOptions(dataSource: number | undefined, options: ReadonlyArray<GroupableOption>): Array<GroupedItem | { group: string; items: GroupedItem[] }> {
  const described = options.map((option, index) => {
    const field = canonicalFilterField(dataSource, option.field.Type, option.label)
    return { option, index, field: option.section && field.section === 'Інше' ? { ...field, section: option.section } : field }
  })
    .sort((a, b) => a.field.order - b.field.order || a.index - b.index)
  const item = ({ option, field }: (typeof described)[number]): GroupedItem =>
    option.disabled === undefined ? { value: option.value, label: field.label } : { value: option.value, label: field.label, disabled: option.disabled }
  const plain = described.filter(entry => !entry.field.section).map(item)
  const sections = [...REPORT_FILTER_SECTIONS, ...new Set(described.flatMap(entry => entry.field.section && !(REPORT_FILTER_SECTIONS as readonly string[]).includes(entry.field.section) ? [entry.field.section] : []))]
  return [...plain, ...sections.flatMap(group => {
    const items = described.filter(entry => entry.field.section === group).map(item)
    return items.length ? [{ group: SECTION_TITLES[group] ?? group, items }] : []
  })]
}
