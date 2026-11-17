import type { CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
import type { ReportSelectedValue } from '../types'
import { customerGroupInt64Id } from './customerGroupInt64'
import { customerGroupDirectoryId } from './customerGroupDirectory'
import { distinctOptions } from './distinctCaptions'
export function customerGroupChoiceValues(values: ReportSelectedValue[], options: CustomerGroupChoice[], field?: number) {
  const identity = field === 4 || field === 9 || field === 15 || field === 16 || field === 21 ? customerGroupInt64Id : customerGroupDirectoryId
  const entries = values.map((value, index) => ({ value: identity(value.Data)?.toString() ?? `invalid:${index}`, label: value.Name || 'Збережене значення без назви' }))
  const unique = [...new Map(entries.map(item => [item.value, item])).values()]
  const previous = new Set(unique.map(item => item.value))
  const selected = distinctOptions(unique)
  const data = distinctOptions(options.map(item => unique.find(saved => saved.value === String(item.Id)) ?? { value: String(item.Id), label: item.Name }))
  function change(keys: string[]): ReportSelectedValue[] {
    const desired = new Set(keys)
    const retained = values.filter((_, index) => desired.has(entries[index].value))
    const added = options.filter(item => desired.has(String(item.Id)) && !previous.has(String(item.Id)))
      .map(item => ({ Data: { Id: item.Id }, Name: item.Name, Value: 0 }))
    return [...retained, ...added]
  }
  return { selected, data, change }
}
