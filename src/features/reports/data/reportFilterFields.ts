export type CanonicalFilterField = { label: string; section?: string; order: number }

export const REPORT_FILTER_SECTIONS = ['Товар', 'Покупець', 'Документ продажу', 'Постачальник', 'Склад', 'Документ руху', 'Рахунок', 'Інше'] as const

const CANONICAL_FIELDS: ReadonlyArray<readonly [number, string, string?]> = [
  [0, 'Організація'],
  [32, 'Організація'],
  [1, 'Товар', 'Товар'],
  [2, 'Артикул', 'Товар'],
  [3, 'Топ', 'Товар'],
  [4, 'Товарна група', 'Товар'],
  [20, 'Одиниця виміру', 'Товар'],
  [5, 'Покупець', 'Покупець'],
  [6, 'Покупець', 'Покупець'],
  [7, 'Покупець. Регіон', 'Покупець'],
  [8, 'Покупець. Код по регіону', 'Покупець'],
  [61, 'Покупець. Код по регіону', 'Покупець'],
  [9, 'Покупець. Договір', 'Покупець'],
  [10, 'Покупець. Відповідальний менеджер покупця', 'Покупець'],
  [60, 'Покупець. Відповідальний менеджер покупця', 'Покупець'],
  [11, 'Покупець. Тип цін', 'Покупець'],
  [12, 'Документ продажу', 'Документ продажу'],
  [13, 'Документ продажу. Номер, дата, час', 'Документ продажу'],
  [14, 'Повернення від клієнта', 'Документ продажу'],
  [15, 'Відповідальний менеджер що забив товар', 'Документ продажу'],
  [16, 'Відповідальний менеджер що перевів в статус накладної', 'Документ продажу'],
  [62, 'Документ продажу. Відповідальний', 'Документ продажу'],
  [63, 'Замовлення покупця. Відповідальний', 'Документ продажу'],
  [64, 'Причина повернення', 'Документ продажу'],
  [17, 'Постачальник', 'Постачальник'],
  [18, 'Постачальник. Договір', 'Постачальник'],
  [19, 'Документ надходження', 'Постачальник'],
  [24, 'Документ повернення постачальнику', 'Постачальник'],
  [27, 'Тип повернення постачальнику', 'Постачальник'],
  [21, 'Склад', 'Склад'],
  [23, 'Склад. Організація', 'Склад'],
  [22, 'Склад. Рядок партії', 'Склад'],
  [29, 'Рахунок', 'Рахунок'],
  [30, 'Рахунок. Валюта', 'Рахунок'],
  [33, 'Рахунок. Вид', 'Рахунок'],
]

const BY_TYPE = new Map(CANONICAL_FIELDS.map(([type, label, section], order) => [type, { label, section, order }]))

const SOURCE_OVERRIDES: Readonly<Record<number, Readonly<Record<number, string>>>> = {
  39: { 6: 'Покупець. Назва' },
  41: { 30: 'Валюта взаєморозрахунків' },
}

function fallbackSection(type: number): string | undefined {
  if (type === 28) return undefined
  if ([31, 34, 35, 36, 37, 38].includes(type)) return 'Рахунок'
  return 'Інше'
}

export function canonicalFilterField(dataSource: number | undefined, type: number, name: string): CanonicalFilterField {
  const known = BY_TYPE.get(type)
  const override = dataSource === undefined ? undefined : SOURCE_OVERRIDES[dataSource]?.[type]
  if (known) return { label: override ?? known.label, section: dataSource === 41 && type === 30 ? undefined : known.section, order: known.order }
  return { label: override ?? name, section: fallbackSection(type), order: CANONICAL_FIELDS.length }
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
    return items.length ? [{ group, items }] : []
  })]
}
