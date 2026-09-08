import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { formatExactRegisterNumber } from './exactNumber'
import { buildRegisterQuery, registerQueryDraft, serializeRegisterQuery } from './query'
import { SourceRegisterReportBuilder } from './SourceRegisterReportBuilder'
import { SourceRegisterResultTable } from './SourceRegisterResultTable'
import { validateRegisterDescriptor, validateRegisterQuery, validateRegisterResult } from './validation'
import type { SourceRegisterDescriptorWire, SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import schemaText from './fixtures/root30-schema.json?raw'
import queryText from './fixtures/root30-query.json?raw'
import statementText from './fixtures/root30-statement.json?raw'
import expectedText from './fixtures/root30-expected.json?raw'

// Actual C# codec writer bytes over independently frozen synthetic operands.
// No original host path, capture facts or network are used by these tests.
// Exact file SHAs are checked by the external fixture preflight and final source manifest.
const PINS = {
  'root30-schema.json': 'c0d4f8e23661cfccbb56ca67cb298ecd4d16da7f727b3cdc5680e278da8180aa',
  'root30-query.json': 'd818030f94014c0cde71c87a8220081878bf8af7a2cee2c920bc944af5233756',
  'root30-statement.json': '9034945be2a43e94be14eeb96af76ef6cd6dba45ae8643b5d612e6821a2951f8',
  'root30-expected.json': '0657beecf3534c8170ba8007a080b44ecd61d54bea2cd80ea8a9a990897ad9dc',
} as const
function fixture<T>(name: keyof typeof PINS): { value: T; text: string } {
  const text = { 'root30-schema.json': schemaText, 'root30-query.json': queryText, 'root30-statement.json': statementText, 'root30-expected.json': expectedText }[name]
  return { value: JSON.parse(text) as T, text }
}
type IndependentExpected = { groups: { rawReferenceHex: string; values: string[] }[]; grandValues: string[]; kernelContentHash: string; sourceParityVerified: false }
const schema = fixture<SourceRegisterDescriptorWire>('root30-schema.json').value
const queryFile = fixture<SourceRegisterQueryWire>('root30-query.json')
const statement = fixture<SourceRegisterResultWire>('root30-statement.json').value
const expected = fixture<IndependentExpected>('root30-expected.json').value
const decimalText = (value: string) => value.replace('.', ',')

it('accepts the actual server schema/query and emits byte-identical query while keeping opaque schema identity', () => {
  expect(validateRegisterDescriptor(schema)).toBeNull()
  expect(validateRegisterQuery(queryFile.value, schema)).toBeNull()
  const restored = buildRegisterQuery(schema, registerQueryDraft(queryFile.value, schema))
  expect(serializeRegisterQuery(restored, schema)).toBe(queryFile.text)
  expect(restored.schema.schemaHash).toBe('a'.repeat(64))
  expect(restored.schema.schemaHash).not.toBe(PINS['root30-schema.json'])
  expect(restored.selections.map(item => item.stage)).toEqual(['Closing', 'Opening', 'Receipt', 'Expense', 'Turnover', 'Closing', 'Opening', 'Receipt', 'Expense', 'Turnover'])
})

it('matches all 30 actual server values to independent literal controls, including negative receipts and typed empty contract', () => {
  expect(validateRegisterResult(statement, schema)).toBeNull()
  expect(statement.publication.contentHash).toBe(expected.kernelContentHash)
  expect(statement.publication.metadata.revision).toBe('9007199254740993')
  expect(statement.query.from).toBe('2026-04-02T00:00:00.0000001')
  expect(statement.query.toExclusive).toBe('2026-04-03T00:00:00.0000002')
  const expectedByReference = new Map(expected.groups.map(group => [group.rawReferenceHex, group.values]))
  let compared = 0
  for (const group of statement.groups) {
    const atom = group.rowKey[0]
    expect(atom.kind).toBe('Reference')
    if (atom.kind !== 'Reference') throw new Error('Expected frozen contract reference')
    const controls = expectedByReference.get(atom.rawReferenceHex)!
    expect(group.values.map(formatExactRegisterNumber)).toEqual(controls.map(decimalText))
    compared += group.values.length
  }
  expect(statement.grandValues.map(formatExactRegisterNumber)).toEqual(expected.grandValues.map(decimalText))
  expect(compared + statement.grandValues.length).toBe(30)
  expect(statement.sourceParityVerified).toBe(false)
})

it('renders all 30 exact cells from actual writer bytes with the independent grand and no invented intersections', () => {
  render(<MantineProvider env="test"><SourceRegisterResultTable descriptor={schema} result={statement} registerLabel="Контроль кодека — лише тест" /></MantineProvider>)
  const table = screen.getByRole('table')
  const expectedByReference = new Map(expected.groups.map(group => [group.rawReferenceHex, group.values]))
  const expectedCells = statement.groups.flatMap(group => {
    const atom = group.rowKey[0]
    if (atom.kind !== 'Reference') throw new Error('Expected frozen contract reference')
    return expectedByReference.get(atom.rawReferenceHex)!.map(decimalText)
  }).concat(expected.grandValues.map(decimalText))
  expect(Array.from(table.querySelectorAll('td.source-register-exact'), cell => cell.textContent)).toEqual(expectedCells)
  expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
  expect(screen.getByText('Порожнє посилання')).toBeTruthy()
  expect(screen.getByText('9007199254740993')).toBeTruthy()
})

it('reloads actual query into the controlled builder without facts or editable publication metadata', () => {
  const submit = vi.fn()
  render(<MantineProvider env="test"><SourceRegisterReportBuilder descriptor={schema} registerLabel="Контроль кодека — лише тест"
    value={registerQueryDraft(queryFile.value, schema)} onChange={vi.fn()} onSubmit={submit} /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати звіт' }))
  expect(submit).toHaveBeenCalledExactlyOnceWith(queryFile.value)
  expect(screen.queryByDisplayValue('9007199254740993')).toBeNull()
  expect(screen.queryByDisplayValue(statement.publication.contentHash)).toBeNull()
})
