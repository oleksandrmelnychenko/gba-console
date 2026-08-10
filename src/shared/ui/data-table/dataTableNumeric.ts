import type { DataTableColumn } from './types'

const NUMERIC_TOKENS = new Set([
  // Ukrainian monetary and numeric labels.
  'баланс',
  'борг',
  'брутто',
  'вага',
  'валюта',
  'вартість',
  'відсоток',
  'всього',
  'дебет',
  'днів',
  'залишок',
  'залишки',
  'знижка',
  'кількість',
  'кредит',
  'курс',
  'маржа',
  'мито',
  'націнка',
  'нетто',
  'оплачено',
  'пдв',
  'позицій',
  'позиції',
  'прибуток',
  'разом',
  'резерв',
  'рентабельність',
  'сальдо',
  'сума',
  'ціна',
  // English monetary and numeric ids and labels used by API-backed grids.
  'amount',
  'balance',
  'cost',
  'count',
  'credit',
  'currency',
  'days',
  'debit',
  'debt',
  'discount',
  'duty',
  'eur',
  'expense',
  'gbp',
  'gross',
  'margin',
  'markup',
  'net',
  'paid',
  'percent',
  'percentage',
  'pln',
  'positions',
  'price',
  'profit',
  'qty',
  'quantity',
  'rate',
  'remainder',
  'reserve',
  'revenue',
  'sum',
  'tax',
  'total',
  'try',
  'uah',
  'units',
  'usd',
  'vat',
  'weight',
])

const NUMERIC_PHRASES = [
  'до оплати',
  'грошові кошти',
  'к сть',
  'к ть',
  'кільк ть',
  'митна вартість',
  'прострочено',
] as const

const CATEGORICAL_HEADER_PHRASES = [
  'облік пдв',
  'платник пдв',
  'статус оплати',
  'статус платежу',
  'тип оплати',
  'тип ціни',
  'price type',
] as const

export function isDataTableNumericColumn<TData>(
  column: DataTableColumn<TData>,
): boolean {
  if (column.numeric !== undefined) {
    return column.numeric
  }

  if (typeof column.header === 'string') {
    const normalizedHeader = normalizeColumnText(column.header)

    if (CATEGORICAL_HEADER_PHRASES.some((phrase) => normalizedHeader.includes(phrase))) {
      return false
    }

    if (hasNumericTerm(normalizedHeader)) {
      return true
    }
  }

  return hasNumericTerm(normalizeColumnText(column.id))
}

function hasNumericTerm(value: string): boolean {
  const tokens = value.split(' ').filter(Boolean)

  return (
    tokens.some((token) => NUMERIC_TOKENS.has(token)) ||
    NUMERIC_PHRASES.some((phrase) => value.includes(phrase))
  )
}

function normalizeColumnText(value: string): string {
  return value
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1 $2')
    .toLocaleLowerCase('uk-UA')
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
