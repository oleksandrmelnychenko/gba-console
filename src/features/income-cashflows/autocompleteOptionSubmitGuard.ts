export type AutocompleteOptionSubmitGuard = {
  clear: () => void
  consumeChange: (value: string) => boolean
  markSubmitted: (value: string) => void
}

export function createAutocompleteOptionSubmitGuard(): AutocompleteOptionSubmitGuard {
  let submittedValue: string | null = null

  return {
    clear() {
      submittedValue = null
    },
    consumeChange(value) {
      const isOptionSubmitEcho = submittedValue === value

      submittedValue = null
      return isOptionSubmitEcho
    },
    markSubmitted(value) {
      submittedValue = value
    },
  }
}
