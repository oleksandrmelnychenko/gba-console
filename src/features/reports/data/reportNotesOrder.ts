const RESULT_FIGURE = /(?::|Для)\s*\d|\d(?:[.,]\d+)?\s*(?:EUR|UAH|грн)/u

function leadingWord(text: string): string {
  return /^[\p{L}ʼ'’-]{4,}/u.exec(text.trim())?.[0].toLocaleLowerCase('uk-UA') ?? ''
}

export function orderReportNotes(notes: readonly string[], unknownColumnCaptions: readonly string[]): string[] {
  const unknownWords = new Set(unknownColumnCaptions.map(leadingWord).filter(Boolean))
  const rank = (note: string) => RESULT_FIGURE.test(note) ? 0 : unknownWords.has(leadingWord(note)) ? 1 : 2
  return notes.map((note, index) => ({ note, index, rank: rank(note) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index).map(item => item.note)
}
