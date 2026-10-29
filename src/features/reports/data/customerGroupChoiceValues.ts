import type { CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
import type { ReportSelectedValue } from '../types'
import { customerGroupDirectoryId } from './customerGroupDirectory'
export function customerGroupChoiceValues(values: ReportSelectedValue[], options: CustomerGroupChoice[]) {
  const entries = values.map((value, index) => ({ value: customerGroupDirectoryId(value.Data)?.toString() ?? `invalid:${index}`, label: value.Name || 'Збережене значення без назви' }))
  const selected = [...new Map(entries.map(item => [item.value, item])).values()]
  const previous = new Set(selected.map(item => item.value))
  const data = options.map(item => selected.find(saved => saved.value === String(item.Id)) ?? { value: String(item.Id), label: item.Name })
  function change(keys: string[]): ReportSelectedValue[] {
    const desired = new Set(keys)
    const retained = values.filter((_, index) => desired.has(entries[index].value))
    const added = options.filter(item => desired.has(String(item.Id)) && !previous.has(String(item.Id)))
      .map(item => ({ Data: { Id: item.Id }, Name: item.Name, Value: 0 }))
    return [...retained, ...added]
  }
  return { selected, data, change }
}
