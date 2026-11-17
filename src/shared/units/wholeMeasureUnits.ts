/* Piece-like measure units: a quantity in these units must be a whole number.
   Same rule as the server (WholeMeasureUnitPolicy.IsWhole): the unit name is split into words on
   space . , / ( ) and the unit is whole when any word is one of these tokens, so «QA шт» and «шт.»
   are pieces. There is no «whole quantities» flag on the unit itself: any other name («од», «рул»,
   «pcs», «м», «кг», «л») stays divisible on both sides. */
const WHOLE_MEASURE_UNIT_TOKENS = new Set([
  'шт',
  'штук',
  'штука',
  'компл',
  'комплект',
  'пар',
  'пара',
  'уп',
  'упак',
  'наб',
  'szt',
  'kpl',
])

export function isWholeMeasureUnit(unit: string | null | undefined): boolean {
  return (unit ?? '')
    .split(/[\s.,/()]+/)
    .some((token) => token !== '' && WHOLE_MEASURE_UNIT_TOKENS.has(token.toLowerCase()))
}
