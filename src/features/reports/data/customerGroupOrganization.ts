import type { ReportSelection } from '../types'
import { revenueExactId } from './revenueComparison'
import { reportSelectionCardinalityError } from './reportOptions'

export const isCustomerGroupOrganization = (source: number, field: number) => source === 44 && field === 0
/** Presentation identity only: the stored Data object/string is never rewritten on load. */
export function customerGroupOrganizationId(raw: unknown): number | null {
  if (typeof raw === 'string' && (raw.length > 65536 || !canonicalJsonIdNumber(raw))) return null
  const text = revenueExactId(raw)
  if (!text) return null
  const id = Number(text)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
export function customerGroupOrganizationError(source: number, selections: ReportSelection[]): string | null {
  if (source !== 44) return null
  for (const selection of selections) {
    if (selection.IsChecked === false || selection.SelectedField.Type !== 0) continue
    const cardinality = reportSelectionCardinalityError(selection)
    if (cardinality) return cardinality
    if (!selection.Values.length) return 'Оберіть організацію або вимкніть цю умову.'
    if (selection.Values.length > 100 || ![0, 1, 2, 4].includes(selection.FilterCondition.Type))
      return 'Оберіть до 100 організацій і одну з чотирьох умов відбору.'
    if (selection.Values.some(value => customerGroupOrganizationId(value.Data) === null))
      return 'Повторно оберіть організацію: збережений ідентифікатор не підтверджено.'
  }
  return null
}

/** Inspect the Id numeric token before JSON.parse could round a fractional value into an integer. */
function canonicalJsonIdNumber(raw: string): boolean {
  let depth = 0
  try {
    for (let at = 0; at < raw.length; at++) {
      if (raw[at] === '{' || raw[at] === '[') depth++
      else if (raw[at] === '}' || raw[at] === ']') depth--
      else if (raw[at] === '"') {
        const start = at
        for (at++; at < raw.length; at++) {
          if (raw[at] === '\\') at++
          else if (raw[at] === '"') break
        }
        const tail = raw.slice(at + 1)
        if (depth !== 1 || !/^\s*:/.test(tail) || String(JSON.parse(raw.slice(start, at + 1))).toLowerCase() !== 'id') continue
        const token = tail.replace(/^\s*:\s*/, '')
        return token.startsWith('"') || /^[1-9][0-9]*(?=\s*[,}])/.test(token)
      }
    }
  } catch { return false }
  return false
}
