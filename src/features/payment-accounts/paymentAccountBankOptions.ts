import type { BankItem } from './types'

/* The account stores only the bank NAME: after that bank was deleted the picker showed
   an empty «Банк» while the name was still saved and re-sent. Keep it visible. */
export function toBankOptions(banks: BankItem[], storedBankName = '') {
  const seenValues = new Set<string>()
  const storedName = storedBankName.trim()
  const options = banks.reduce<Array<{ label: string; value: string }>>((options, bank) => {
    const value = bank.Name?.trim() || ''

    if (value && !seenValues.has(value)) {
      seenValues.add(value)
      options.push({
        label: value,
        value,
      })
    }

    return options
  }, [])

  if (storedName && !seenValues.has(storedName)) {
    options.push({ label: `${storedName} (банк видалено)`, value: storedName })
  }

  return options
}
