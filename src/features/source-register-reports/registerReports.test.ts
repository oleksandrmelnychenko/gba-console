import { describe, expect, it } from 'vitest'
import { formatExactRegisterNumber, isExactRegisterNumber } from './exactNumber'
import { formatRegisterPeriod, isRegisterLocalTimestamp, registerPeriodDraft } from './period'
import { appendRegisterStages, buildRegisterQuery, moveRegisterItem, registerQueryDraft, serializeRegisterQuery } from './query'
import { hasExactMembers, registerAtomIdentity, REGISTER_STAGES, validateRegisterDescriptor, validateRegisterQuery, validateRegisterResult } from './validation'
import { testDescriptor, testDraft, testQuery, testResult, testUuid } from './registerReports.test-fixtures'
import type { RegisterAtom, RegisterSelection, SourceRegisterQueryDraft } from './types'

describe('exact output strings', () => {
  it('preserves every signed output digit beyond decimal38 and scale38 without a floating point operand', () => {
    const coefficient = `-${'9'.repeat(174)}`
    expect(formatExactRegisterNumber({ coefficient, scale: '38' })).toBe(`-${'9'.repeat(136)},${'9'.repeat(38)}`)
    expect(formatExactRegisterNumber({ coefficient: '-1', scale: '38' })).toBe(`-0,${'0'.repeat(37)}1`)
    expect(formatExactRegisterNumber({ coefficient: '9007199254740993', scale: '0' })).toBe('9007199254740993')
    expect(formatExactRegisterNumber({ coefficient: '0', scale: '0' })).toBe('0')
  })
  it.each([
    { coefficient: '9'.repeat(175), scale: '0' }, { coefficient: '1', scale: '39' }, { coefficient: '1e2', scale: '0' },
    { coefficient: '01', scale: '0' }, { coefficient: '-0', scale: '0' }, { coefficient: '+1', scale: '0' },
    { coefficient: '0', scale: '1' }, { coefficient: '10', scale: '1' }, { coefficient: '1', scale: '01' },
    { coefficient: 9007199254740992, scale: '0' }, { coefficient: '1', scale: 0 }, { coefficient: '1', scale: '0', extra: true }, null,
  ])('rejects malformed/noncanonical operands %#', value => expect(isExactRegisterNumber(value)).toBe(false))
})

describe('local wall-clock periods', () => {
  it.each(['0001-01-01T00:00:00.0000001', '2024-02-29T23:59:59.1234567', '9999-12-31T23:59:59.9999999'])('preserves all ticks in %s', value => {
    expect(isRegisterLocalTimestamp(value)).toBe(true)
    expect(formatRegisterPeriod(registerPeriodDraft(value))).toBe(value)
  })
  it.each(['0000-01-01T00:00:00.0000000', '2026-02-29T00:00:00.0000000', '1900-02-29T00:00:00.0000000', '2026-04-31T00:00:00.0000000',
    '2026-04-01T24:00:00.0000000', '2026-04-01T00:00:60.0000000', '2026-04-01T00:00:00.000000', '2026-04-01T00:00:00.0000000Z', '2026-04-01T00:00:00.0000000+03:00'])('rejects invalid/offset date %s', value => expect(isRegisterLocalTimestamp(value)).toBe(false))
  it('formats familiar controls with explicit fraction, leaving their values unchanged', () => {
    const input = Object.freeze({ date: '2026-04-01', time: '13:05', fraction: '5' })
    expect(formatRegisterPeriod(input)).toBe('2026-04-01T13:05:00.5000000')
    expect(input.fraction).toBe('5')
    expect(formatRegisterPeriod({ ...input, fraction: '12345678' })).toBeNull()
  })
})

describe('descriptor and controlled query boundary', () => {
  it.each([70, 256])('retains every caller selection for %i resources without a bit mask', count => {
    const descriptor = testDescriptor(count), initial = testDraft(descriptor)
    const selections = [...descriptor.resources].reverse().flatMap(resource => [...REGISTER_STAGES].reverse().map(stage => ({ resourceUuid: resource.uuid, stage })))
    const draft = { ...initial, rowFields: [...initial.columnFields], columnFields: [...initial.rowFields], selections }
    const query = buildRegisterQuery(descriptor, draft)
    expect(query.selections).toEqual(selections); expect(query.selections).toHaveLength(count * 5)
    expect(query.rowFields).toEqual(initial.columnFields); expect(query.columnFields).toEqual(initial.rowFields)
    expect(JSON.parse(serializeRegisterQuery(query, descriptor))).toEqual(query)
    expect(registerQueryDraft(query, descriptor)).toEqual(draft)
    expect(query.selections).not.toBe(draft.selections); expect(query.schema).not.toBe(descriptor.schema)
  })
  it('builds only the allowlisted query and rejects candidate facts/proofs and extra selection members', () => {
    const descriptor = testDescriptor(), draft = testDraft(descriptor), query = buildRegisterQuery(descriptor, draft)
    expect(hasExactMembers(query, ['version', 'kind', 'schema', 'from', 'toExclusive', 'rowFields', 'columnFields', 'selections'])).toBe(true)
    for (const key of ['complete', 'publication', 'scopeHash', 'facts', 'policy']) {
      expect(() => buildRegisterQuery(descriptor, { ...draft, [key]: true } as SourceRegisterQueryDraft)).toThrow()
      expect(validateRegisterQuery({ ...query, [key]: true }, descriptor)).not.toBeNull()
    }
    expect(validateRegisterQuery({ ...query, selections: [{ ...query.selections[0], complete: true }] }, descriptor)).not.toBeNull()
  })
  it('rejects duplicates, unsupported UUID/stage, wrong schema, empty selections and nonpositive period', () => {
    const descriptor = testDescriptor(), query = testQuery(descriptor)
    for (const mutation of [
      { rowFields: [query.rowFields[0], query.rowFields[0]] }, { columnFields: query.rowFields }, { selections: [] },
      { selections: [query.selections[0], query.selections[0]] }, { selections: [{ resourceUuid: testUuid(9999), stage: 'Closing' }] },
      { selections: [{ ...query.selections[0], stage: 4 }] }, { from: query.toExclusive }, { rowFields: [descriptor.resources[0].uuid] },
      { schema: { ...query.schema, schemaHash: 'f'.repeat(64) } },
    ]) expect(validateRegisterQuery({ ...query, ...mutation }, descriptor)).not.toBeNull()
    expect(validateRegisterQuery({ ...query, rowFields: [], columnFields: [] }, descriptor)).toBeNull()
  })
  it('does not derive schema identity or field equality from labels', () => {
    const descriptor = testDescriptor()
    const renamed = { ...descriptor, resources: descriptor.resources.map(item => ({ ...item, caption: 'Однакова назва' })) }
    expect(validateRegisterDescriptor(renamed)).toBeNull()
    expect(buildRegisterQuery(renamed, testDraft(renamed)).schema.schemaHash).toBe(descriptor.schema.schemaHash)
    expect(validateRegisterDescriptor({ ...renamed, resources: [renamed.resources[0], renamed.resources[0]] })).not.toBeNull()
    expect(validateRegisterDescriptor({ ...renamed, resources: [{ ...renamed.resources[0], caption: '\ud800' }] })).not.toBeNull()
  })
  it('edits order immutably and appends missing stages after existing selections', () => {
    const input: readonly RegisterSelection[] = Object.freeze([{ resourceUuid: testUuid(100), stage: 'Closing' }])
    const selected = appendRegisterStages(input, testUuid(100))
    expect(selected.map(item => item.stage)).toEqual(['Closing', 'Opening', 'Receipt', 'Expense', 'Turnover'])
    expect(appendRegisterStages(selected, testUuid(100))).toEqual(selected)
    expect(moveRegisterItem(selected, 4, -1).map(item => item.stage)).toEqual(['Closing', 'Opening', 'Receipt', 'Turnover', 'Expense'])
    expect(input).toHaveLength(1)
  })
})

describe('authoritative result boundary', () => {
  it('accepts sparse signed groups and exact large revision while retaining server grand', () => {
    const descriptor = testDescriptor(), result = testResult(descriptor)
    expect(validateRegisterResult(result, descriptor)).toBeNull()
    expect(result.publication.metadata.revision).toBe('9007199254740993')
    expect(result.groups).toHaveLength(2); expect(result.grandValues[0]).toEqual({ coefficient: '-103401', scale: '4' })
  })
  it('rejects incomplete coverage, stale schema, numeric revision, wrong width and malformed or duplicated groups', () => {
    const descriptor = testDescriptor(), result = testResult(descriptor)
    for (const mutation of [
      { sourceParityVerified: true }, { sourceAdapterReady: false }, { schema: { ...result.schema, world: 'other' } },
      { groups: [...result.groups, result.groups[0]] }, { grandValues: [] }, { groups: [{ ...result.groups[0], values: [{ coefficient: '0', scale: '4' }] }] },
      { groups: [{ ...result.groups[0], rowKey: [{ kind: 'Null' }] }] },
    ]) expect(validateRegisterResult({ ...result, ...mutation }, descriptor)).not.toBeNull()
    for (const mutation of [{ complete: false }, { revision: 9007199254740992 }, { revision: '9223372036854775808' }, { coverageStart: result.query.toExclusive }]) {
      expect(validateRegisterResult({ ...result, publication: { ...result.publication, metadata: { ...result.publication.metadata, ...mutation } } }, descriptor)).not.toBeNull()
    }
  })
  it('keeps typed empty references, Null, Undefined, empty string, false and zero distinct', () => {
    const atoms: RegisterAtom[] = [{ kind: 'Undefined' }, { kind: 'Null' }, { kind: 'String', value: '' }, { kind: 'Boolean', value: false }, { kind: 'Number', coefficient: '0', scale: '0' },
      { kind: 'Reference', sourceTypeUuid: testUuid(200), rawReferenceHex: '0'.repeat(32) }, { kind: 'Reference', sourceTypeUuid: testUuid(201), rawReferenceHex: '0'.repeat(32) }]
    expect(new Set(atoms.map(registerAtomIdentity)).size).toBe(atoms.length)
    expect(registerAtomIdentity({ rawReferenceHex: '0'.repeat(32), sourceTypeUuid: testUuid(200), kind: 'Reference' })).toBe(registerAtomIdentity(atoms[5]))
  })
  it('enforces explicit reference layout and consistent physical type/table tags', () => {
    const base = testDescriptor(), type = testUuid(300)
    const descriptor = { ...base, dimensions: [{ ...base.dimensions[0], referenceLayout: 'Composite' as const, alternatives: [{ kind: 'Reference' as const, sourceTypeUuid: type }] }, ...base.dimensions.slice(1)] }
    const original = testResult(descriptor)
    const result = { ...original, groups: original.groups.map((group, index) => ({ ...group, rowKey: [{ kind: 'Reference' as const, sourceTypeUuid: type, rawReferenceHex: String(index).repeat(32), rawPhysicalTypeTagHex: '7f', rawPhysicalTableTagHex: '01234567' }] })) }
    expect(validateRegisterResult(result, descriptor)).toBeNull()
    const wrong = { ...result, groups: [result.groups[0], { ...result.groups[1], rowKey: [{ ...result.groups[1].rowKey[0], rawPhysicalTableTagHex: '76543210' }] }] }
    expect(validateRegisterResult(wrong, descriptor)).not.toBeNull()
    const noTags = { ...result, groups: [{ ...result.groups[0], rowKey: [{ kind: 'Reference', sourceTypeUuid: type, rawReferenceHex: '0'.repeat(32) }] }] }
    expect(validateRegisterResult(noTags, descriptor)).not.toBeNull()
  })
  it('accepts explicit complete-empty zeros without inventing groups; absent grand is invalid', () => {
    const descriptor = testDescriptor(), result = { ...testResult(descriptor), groups: [], grandValues: [{ coefficient: '0', scale: '0' }] }
    expect(validateRegisterResult(result, descriptor)).toBeNull()
    expect(validateRegisterResult({ ...result, grandValues: undefined }, descriptor)).not.toBeNull()
  })
})
