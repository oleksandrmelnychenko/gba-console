// For mixed API/report fields only. Known monetary UI values use app-money directly.
const MONEY_FIELD_TOKENS = new Set([
  'amount', 'balance', 'cost', 'credit', 'debit', 'debt', 'eur', 'expense', 'gbp',
  'paid', 'pln', 'price', 'profit', 'revenue', 'sum', 'uah', 'usd', 'vat',
  'баланс', 'борг', 'вартість', 'виручка', 'дебет', 'кредит', 'оплачено',
  'пдв', 'прибуток', 'сальдо', 'сума', 'ціна', 'грн',
])

const NON_MONEY_FIELD_TOKENS = new Set([
  'count', 'days', 'date', 'id', 'netuid', 'netid', 'percent', 'percentage', 'pct',
  'qty', 'quantity', 'rate', 'ratio', 'score', 'status', 'type', 'weight',
  'відсоток', 'днів', 'дата', 'кількість', 'курс', 'номер', 'статус', 'тип', 'вага',
])

export function isMoneyField(name: string): boolean {
  const normalized = name
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1 $2')
    .toLocaleLowerCase('uk-UA')
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}€₴$£]+/gu, ' ')
    .trim()
  const tokens = normalized.split(' ')

  if (tokens.some((token) => NON_MONEY_FIELD_TOKENS.has(token))) {
    return false
  }

  return normalized === 'expected value' || normalized === 'до оплати' ||
    /[€₴$£]/u.test(normalized) || tokens.some((token) => MONEY_FIELD_TOKENS.has(token))
}

// Accept an amount (optionally with currency), never percentages or explanatory prose.
const MONEY_TEXT = /^(?:(?:EUR|UAH|USD|PLN|GBP|CHF|CZK|TRY|грн\.?|євро|zł|[€₴$£])\s*)?[+−-]?(?:\d{1,3}(?:[\s.,]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:EUR|UAH|USD|PLN|GBP|CHF|CZK|TRY|грн\.?|євро|zł|[€₴$£])?$/iu

export function isMoneyValue(value: unknown): boolean {
  return typeof value === 'number'
    ? Number.isFinite(value)
    : typeof value === 'string' && MONEY_TEXT.test(value.trim())
}
