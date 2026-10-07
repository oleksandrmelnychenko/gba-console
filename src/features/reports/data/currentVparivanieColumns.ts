import type { NativeReportPreviewAxis } from './nativeReportPreview'

type Schema = { Identity?: string; KeyKind?: string }
const fail = (): never => { throw new Error('Сервер повернув некоректні ключі колонок матриці «Впарювання».') }
const positiveNativeClient = (value: string) => /^native-client:[1-9]\d{0,18}$/.test(value)
  && BigInt(value.slice('native-client:'.length)) <= 9223372036854775807n
/** Captions are presentation only; exact typed keys keep equal names apart. */
export function validateCurrentVparivanieColumns(schema: Schema[], columns: NativeReportPreviewAxis[]): void {
  if (schema.length !== 4 || schema[0].Identity !== 'CurrentVparivanieGroup'
    || schema[0].KeyKind !== 'Numeric' || schema[1].Identity !== 'CurrentVparivanieCounterparty'
    || !['Numeric', 'Text'].includes(schema[1].KeyKind ?? '')
    || schema[2].Identity !== '$measureGroup' || schema[3].Identity !== '$measure') fail()
  const textIdentity = schema[1].KeyKind === 'Text'
  const seen = new Set<string>()
  for (const column of columns) {
    if (column.Values.length !== 4) fail()
    const [group, party, measureGroup, measure] = column.Values
    const groupIdentity = group.Identity
    const partyIdentity = party.Identity
    if (!groupIdentity || !partyIdentity) throw new Error('Сервер повернув некоректні ключі колонок матриці «Впарювання».')
    if (groupIdentity.Kind !== 'signedInteger' || !['1', '2', '3'].includes(groupIdentity.Value ?? '')
      || groupIdentity.Provenance !== 'columnAxisKey'
      || measureGroup.Caption !== 'Результат' || measure.Caption !== 'Результат') fail()
    if (groupIdentity.Value === '1' || groupIdentity.Value === '2') {
      if (partyIdentity.Kind !== 'null' || partyIdentity.Value !== null) fail()
    } else if (partyIdentity.Kind === 'null') {
      if (partyIdentity.Value !== null) fail()
    } else if (textIdentity) {
      const value = partyIdentity.Value
      if (partyIdentity.Kind !== 'text' || typeof value !== 'string'
        || !(positiveNativeClient(value) || /^source-group:Fenix:(?!0{32}$)[A-F\d]{32}$/.test(value))) fail()
    } else if (partyIdentity.Kind !== 'signedInteger'
      || !/^[1-9]\d{0,18}$/.test(partyIdentity.Value ?? '')
      || BigInt(partyIdentity.Value!) > 9223372036854775807n) fail()
    if (partyIdentity.Provenance !== 'columnAxisKey') fail()
    const key = `${groupIdentity.Value}:${partyIdentity.Kind}:${partyIdentity.Value ?? ''}`
    if (seen.has(key)) fail()
    seen.add(key)
  }
}

export function currentVparivanieSecondTier(column: NativeReportPreviewAxis): string {
  return column.Values[0]?.Identity?.Value === '3'
    ? `${column.Values[1]?.Caption || 'Не вказано'} / Результат`
    : 'Результат'
}
