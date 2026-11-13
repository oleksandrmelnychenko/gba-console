export type DebtBreakdownPart = {
  key: string
  label: string
  count: number
  amount_eur: number
  note: string | null
}

const SEPARATE_NOTE = 'Ці документи показано окремо від відомого простроченого боргу.'
const INCLUDED_NOTE = 'Ці документи вже входять до простроченого боргу.'

const KNOWN: Record<string, { label: string; note: string }> = {
  unknown_date: { label: 'Дата документа не визначена', note: SEPARATE_NOTE },
  opening_balance: { label: 'У тому числі ввід залишків', note: INCLUDED_NOTE },
  opening_balance_overdue: { label: 'У тому числі ввід залишків', note: INCLUDED_NOTE },
}

const HANDLED_ELSEWHERE = new Set(['unknown_terms', 'unconverted'])

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function part(key: string, count: unknown, amount: unknown, label: unknown): DebtBreakdownPart | null {
  const normalizedCount = finite(count)
  const normalizedAmount = finite(amount)
  if (normalizedCount <= 0 && normalizedAmount <= 0) return null
  const known = KNOWN[key]
  return {
    key,
    label: text(label) ?? known?.label ?? `Окрема група боргу (${key})`,
    count: normalizedCount,
    amount_eur: normalizedAmount,
    note: known?.note ?? null,
  }
}

export function collectDebtBreakdown(source: unknown): DebtBreakdownPart[] {
  if (!source || typeof source !== 'object') return []
  const record = source as Record<string, unknown>
  const parts = new Map<string, DebtBreakdownPart>()

  for (const name of Object.keys(record)) {
    const match = /^debt_(.+)_(count|eur)$/.exec(name)
    if (!match || HANDLED_ELSEWHERE.has(match[1]) || parts.has(match[1])) continue
    const key = match[1]
    const found = part(key, record[`debt_${key}_count`], record[`debt_${key}_eur`], record[`debt_${key}_label`])
    if (found) parts.set(key, found)
  }

  const listed = record.debt_breakdown
  if (Array.isArray(listed)) {
    for (const item of listed) {
      if (!item || typeof item !== 'object') continue
      const entry = item as Record<string, unknown>
      const key = text(entry.key) ?? text(entry.code)
      if (!key || HANDLED_ELSEWHERE.has(key) || parts.has(key)) continue
      const found = part(key, entry.count, entry.amount_eur ?? entry.eur, entry.label)
      if (found) parts.set(key, found)
    }
  }

  return [...parts.values()].sort((left, right) =>
    Number(right.key === 'unknown_date') - Number(left.key === 'unknown_date') || left.key.localeCompare(right.key))
}
