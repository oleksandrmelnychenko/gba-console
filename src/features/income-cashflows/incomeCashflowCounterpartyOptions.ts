import type { Client } from './types'

export function getIncomeCashflowCounterpartyLabel(
  counterparty: Client,
): string {
  const regionCode = counterparty.RegionCode?.Value?.trim() || ''
  const name = getCounterpartyName(counterparty)

  return [regionCode, name].filter(Boolean).join(' · ')
}

export function getIncomeCashflowCounterpartyOptions(
  counterparties: Client[],
): string[] {
  const labels: string[] = []
  const seenLabels = new Set<string>()

  for (const counterparty of counterparties) {
    const label = getIncomeCashflowCounterpartyLabel(counterparty)

    if (!label || seenLabels.has(label)) {
      continue
    }

    seenLabels.add(label)
    labels.push(label)
  }

  return labels
}

export function findIncomeCashflowCounterpartyByOption(
  counterparties: Client[],
  option: string,
): Client | undefined {
  return counterparties.find(
    (counterparty) =>
      getIncomeCashflowCounterpartyLabel(counterparty) === option,
  )
}

export function getIncomeCashflowCounterpartySearchValue(
  counterparties: Client[],
  input: string,
): string {
  const selectedCounterparty = findIncomeCashflowCounterpartyByOption(
    counterparties,
    input,
  )

  return selectedCounterparty?.RegionCode?.Value?.trim() || input.trim()
}

function getCounterpartyName(counterparty: Client): string {
  return counterparty.FullName
    || counterparty.LastName
    || counterparty.Name
    || counterparty.OperationName
    || counterparty.Code
    || counterparty.Number
    || ''
}
