/* Piece-like measure units: a quantity in these units must be a whole number.
   Same list as the procurement dashboard (basket-supply-ukraine-order). */
const WHOLE_MEASURE_UNITS = new Set(['шт', 'компл', 'пар', 'пара', 'уп', 'упак', 'наб'])

export function isWholeMeasureUnit(unit: string | null | undefined): boolean {
  return WHOLE_MEASURE_UNITS.has((unit ?? '').trim().replace(/\.$/, '').toLowerCase())
}
