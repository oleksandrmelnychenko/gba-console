import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { isCurrentVparivanieCapability } from './currentVparivanie'
import { currentVparivanieDataset, currentVparivaniePreview } from './currentVparivanie.test-fixtures'
import { currentVparivanieSecondTier } from './currentVparivanieColumns'

function textKeys() {
  const preview = currentVparivaniePreview()
  preview.ColumnSchema[1].KeyKind = 'Text'
  preview.Columns[2].Values[1].Identity.Kind = 'text'
  preview.Columns[2].Values[1].Identity.Value = 'native-client:111'
  preview.Columns[3].Values[1].Identity.Kind = 'text'
  preview.Columns[3].Values[1].Identity.Value = `source-group:Fenix:${'A'.repeat(32)}`
  return preview
}

it('accepts negotiated exact source-group keys, including equal captions with different identities', () => {
  const capability = { ...(currentVparivanieDataset.currentVparivanie as Record<string, unknown>), CounterpartyIdentity: 'NativeClientOrFenixSourceGroupV1' }
  expect(isCurrentVparivanieCapability(capability)).toBe(true)
  const preview = normalizeNativeReportPreview({ Preview: textKeys() })
  expect(preview.ColumnSchema[1].KeyKind).toBe('Text')
  expect(preview.Columns.slice(2).map(column => column.Values[1].Identity?.Value)).toEqual([
    'native-client:111', `source-group:Fenix:${'A'.repeat(32)}`])
  expect(preview.Columns.slice(2).map(currentVparivanieSecondTier)).toEqual([
    'Одна назва / Результат', 'Одна назва / Результат'])
  expect(preview.Columns.slice(0, 2).map(currentVparivanieSecondTier)).toEqual(['Результат', 'Результат'])
})

it.each(['OtherMode', 'nativeclient:111', 'native-client:0', 'native-client:01',
  'native-client:9223372036854775808', 'source-group:Amg:' + 'A'.repeat(32),
  'source-group:Fenix:' + 'a'.repeat(32), 'source-group:Fenix:' + '0'.repeat(32),
  'source-group:Fenix:' + 'A'.repeat(31)])('refuses unproved or malformed typed identity %s', value => {
  const preview = textKeys()
  if (value === 'OtherMode') {
    expect(isCurrentVparivanieCapability({ ...(currentVparivanieDataset.currentVparivanie as Record<string, unknown>), CounterpartyIdentity: value })).toBe(false)
    return
  }
  preview.Columns[3].Values[1].Identity.Value = value
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow()
})

it('keeps legacy numeric keys and distinguishes a null customer from missing stock-party dimension', () => {
  const preview = currentVparivaniePreview()
  preview.Columns[3].Values[1].Identity.Kind = 'null'
  preview.Columns[3].Values[1].Identity.Value = null
  preview.Columns[3].Values[1].Caption = 'Не вказано'
  const normalized = normalizeNativeReportPreview({ Preview: preview })
  expect(normalized.ColumnSchema[1].KeyKind).toBe('Numeric')
  expect(currentVparivanieSecondTier(normalized.Columns[0])).toBe('Результат')
  expect(currentVparivanieSecondTier(normalized.Columns[3])).toBe('Не вказано / Результат')
})

it.each(['duplicate', 'wrong-axis-kind', 'mismatched-party-kind', 'missing-fourth-axis'])('refuses inconsistent typed axis %s', scenario => {
  const preview = textKeys()
  switch (scenario) {
    case 'duplicate': preview.Columns[3].Values[1].Identity.Value = preview.Columns[2].Values[1].Identity.Value; break
    case 'wrong-axis-kind': preview.ColumnSchema[1].KeyKind = 'Numeric'; break
    case 'mismatched-party-kind': preview.Columns[3].Values[1].Identity.Kind = 'signedInteger'; break
    case 'missing-fourth-axis': preview.Columns[3].Values.pop(); break
  }
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow()
})
