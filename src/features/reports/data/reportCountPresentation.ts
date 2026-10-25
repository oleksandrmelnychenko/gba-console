export function deskPlural(count: number, forms: readonly [string, string, string]): string {
  const tens = Math.abs(count) % 100
  const units = tens % 10
  if (tens > 10 && tens < 20) return forms[2]
  if (units === 1) return forms[0]
  if (units >= 2 && units <= 4) return forms[1]
  return forms[2]
}

export function deskCount(count: number): string {
  return count.toLocaleString('uk-UA').replace(/\s/g, '\u00a0')
}

export function deskRowsText(returned: number, total: number, hasMore: boolean): string {
  if (!hasMore && returned === total)
    return `${deskCount(total)} ${deskPlural(total, ['рядок', 'рядки', 'рядків'])}`
  return `Показано ${deskCount(returned)} з ${deskCount(total)} ${deskPlural(total, ['рядка', 'рядків', 'рядків'])}`
}
