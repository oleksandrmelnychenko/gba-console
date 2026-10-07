import { expect, it } from 'vitest'
import { createSalesReportPreset } from './reportPresets'
import { normalizeTemplateOrder, templateOrderRequest, templatesInAuthoritativeOrder } from './reportTemplateOrder'

const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222'
const first = { ...createSalesReportPreset('daily', '', '', []), Id: a, Name: 'Другий', Revision: 3 }
const second = { ...createSalesReportPreset('agreements', '', '', []), Id: b, Name: 'Перший', Revision: 7 }
const state = () => ({ ListRevision: 9, Items: [
  { Id: b, Name: second.Name, Revision: 7, DisplayOrder: 1 },
  { Id: a, Name: first.Name, Revision: 3, DisplayOrder: 2 },
] })

it('maps the complete authoritative order to the exact stored definitions without changing their data', () => {
  const before = JSON.stringify([first, second])
  const ordered = templatesInAuthoritativeOrder([first, second], state())
  expect(ordered).toEqual([second, first]); expect(ordered[0]).toBe(second); expect(ordered[1]).toBe(first)
  expect(JSON.stringify([first, second])).toBe(before)
})

it.each(['revision', 'name', 'missing', 'duplicate'])('refuses %s definition mismatches before exposing a reordered list', kind => {
  const definitions = [first, second]
  if (kind === 'revision') definitions[0] = { ...first, Revision: 4 }
  if (kind === 'name') definitions[0] = { ...first, Name: 'Renamed' }
  if (kind === 'missing') definitions.pop()
  if (kind === 'duplicate') definitions[1] = { ...first }
  expect(() => templatesInAuthoritativeOrder(definitions, state())).toThrow(/Оновіть/)
})

it.each(['unsafe', 'fraction', 'duplicate', 'gap', 'zero-id', 'overlong', 'surrogate', 'unknown-field', 'too-many'])('refuses malformed order metadata: %s', kind => {
  const value = state()
  if (kind === 'unsafe') value.ListRevision = Number.MAX_SAFE_INTEGER + 1
  if (kind === 'fraction') value.ListRevision = 1.5
  if (kind === 'duplicate') value.Items[1].Id = b
  if (kind === 'gap') value.Items[1].DisplayOrder = 3
  if (kind === 'zero-id') value.Items[1].Id = '00000000-0000-0000-0000-000000000000'
  if (kind === 'overlong') value.Items[0].Name = 'я'.repeat(121)
  if (kind === 'surrogate') value.Items[0].Name = '\ud800'
  if (kind === 'unknown-field') Object.assign(value, { Owner: 'other' })
  if (kind === 'too-many') value.Items = Array.from({ length: 201 }, () => value.Items[0])
  expect(() => normalizeTemplateOrder(value)).toThrow(/Оновіть/)
})

it('accepts an empty authoritative list and preserves a safe long revision without coercion', () => {
  expect(normalizeTemplateOrder({ ListRevision: Number.MAX_SAFE_INTEGER, Items: [] })).toEqual({ ListRevision: Number.MAX_SAFE_INTEGER, Items: [] })
})

it('sends only the order command and expected list revision, without report settings or caller identity', () => {
  expect(templateOrderRequest({ Operation: 'sort_name_asc' }, 0)).toEqual({ Operation: 'sort_name_asc', Id: null, Position: null, ExpectedListRevision: 0 })
  expect(templateOrderRequest({ Operation: 'transfer', Id: a, Position: 2 }, 9)).toEqual({ Operation: 'transfer', Id: a, Position: 2, ExpectedListRevision: 9 })
})

it.each([
  { command: { Operation: 'move_up' as const }, revision: 1 },
  { command: { Operation: 'sort_name_desc' as const, Id: a }, revision: 1 },
  { command: { Operation: 'move_up' as const, Id: a, Position: 1 }, revision: 1 },
  { command: { Operation: 'transfer' as const, Id: a, Position: 0 }, revision: 1 },
  { command: { Operation: 'transfer' as const, Id: a, Position: 201 }, revision: 1 },
  { command: { Operation: 'transfer' as const, Id: a, Position: 1.5 }, revision: 1 },
  { command: { Operation: 'sort_name_asc' as const }, revision: Number.MAX_SAFE_INTEGER },
])('refuses an invalid command or unrepresentable next revision %#', ({ command, revision }) => {
  expect(() => templateOrderRequest(command, revision)).toThrow(/Оновіть/)
})
