import { parseQuantityInput, type ParsedQuantityInput } from '../../shared/units/quantityInput'

type Translate = (text: string, values?: Record<string, string | number>) => string

/**
 * «Кількість» of a capitalization row (the entry field and the items grid), typed as text and read by
 * the shared warehouse rule: «2,5» and «2.5» are 2.5 (never 25), pasted «2,5» is 2.5 (never 2), 0 is
 * refused (never 1), «-3» is refused (never 3), piece units need a whole number. Litres, metres and
 * kilograms keep their fractions up to «Провести».
 */
export function parseCapitalizationQty(
  text: string,
  unit: string | null | undefined,
  t: Translate,
): ParsedQuantityInput {
  return parseQuantityInput(text, { unit }, t)
}

/**
 * Field text for a quantity that came from the file or a pending draft: shown as it is, with the
 * decimal comma, so an imported 2.5 stays 2,5 and an imported -2 keeps its minus and is flagged.
 */
export function formatCapitalizationQtyText(qty: number | null | undefined): string {
  return typeof qty === 'number' && Number.isFinite(qty) ? String(qty).replace('.', ',') : ''
}

/** The number the text spells, minus included (for the «від’ємні» flag); undefined when it is not a number. */
export function readCapitalizationQtyValue(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.')

  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : undefined
}
