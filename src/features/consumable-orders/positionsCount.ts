const pluralRules = new Intl.PluralRules('uk-UA')

/** «1 позиція», «2 позиції», «5 позицій» (the registry said «2 позицій» / «1 позицій»). */
export function getPositionsWord(count: number): string {
  switch (pluralRules.select(count)) {
    case 'one':
      return 'позиція'
    case 'few':
      return 'позиції'
    default:
      return 'позицій'
  }
}
