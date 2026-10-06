import { useState } from 'react'
import { availabilityFilterKey, type AvailabilityChoice, type AvailabilityField, type AvailabilityFilter, type AvailabilityResult } from '../data/originalCashAvailability'
type Selection = { scope: string; filters: AvailabilityFilter[]; choices: AvailabilityChoice[] }
export function useCashAvailabilitySelection(scope: string) {
  const [stored, setStored] = useState<Selection>(() => ({ scope, filters: [], choices: [] }))
  let current = stored
  if (stored.scope !== scope) { current = { scope, filters: [], choices: [] }; setStored(current) }
  function select(field: AvailabilityField, keys: string[]) {
    const wanted = new Set(keys), exact = current.choices.filter(v => v.Value.Field === field && wanted.has(availabilityFilterKey(v.Value)))
    setStored(previous => previous.scope === scope ? { ...previous, filters: [...previous.filters.filter(v => v.Field !== field), ...exact.map(v => v.Value)] } : previous)
  }
  function receive(result: AvailabilityResult) {
    setStored(previous => {
      if (previous.scope !== scope) return previous
      const fresh = new Set(result.Choices.map(v => availabilityFilterKey(v.Value))), applied = new Set(previous.filters.map(availabilityFilterKey))
      const retained = previous.choices.filter(v => applied.has(availabilityFilterKey(v.Value)) && !fresh.has(availabilityFilterKey(v.Value)))
      return { ...previous, choices: [...result.Choices, ...retained] }
    })
  }
  return { filters: current.filters, choices: current.choices, select, receive }
}
