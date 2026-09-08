import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { formatExactRegisterNumber } from './exactNumber'
import { registerQueryDraft, buildRegisterQuery, serializeRegisterQuery } from './query'
import { SourceRegisterResultTable } from './SourceRegisterResultTable'
import { validateRegisterDescriptor, validateRegisterResult } from './validation'
import type { SourceRegisterDescriptorWire, SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import typedSchema from './fixtures/typed-schema.json?raw'
import typedQuery from './fixtures/typed-query.json?raw'
import typedStatement from './fixtures/typed-statement.json?raw'
import kernelSchema from './fixtures/kernel166-schema.json?raw'
import kernelQuery from './fixtures/kernel166-query.json?raw'
import kernelStatement from './fixtures/kernel166-statement.json?raw'
import emptySchema from './fixtures/empty-schema.json?raw'
import emptyQuery from './fixtures/empty-query.json?raw'
import emptyStatement from './fixtures/empty-statement.json?raw'
import wideSchema from './fixtures/wide1280-schema.json?raw'
import wideQuery from './fixtures/wide1280-query.json?raw'
import wideStatement from './fixtures/wide1280-statement.json?raw'
import transport174 from './fixtures/transport174-statement.json?raw'

// All operands are synthetic test-only C# writer fixtures. File SHAs are pinned
// by the external fixture preflight. These checks establish transport retention;
// the separate root30 controls establish independent numeric agreement.
const variants = [
  ['typed', typedSchema, typedQuery, typedStatement],
  ['kernel166', kernelSchema, kernelQuery, kernelStatement],
  ['empty', emptySchema, emptyQuery, emptyStatement],
  ['wide1280', wideSchema, wideQuery, wideStatement],
] as const
const parsedSchema = (text: string) => JSON.parse(text) as SourceRegisterDescriptorWire
const parsedStatement = (text: string) => JSON.parse(text) as SourceRegisterResultWire

it.each(variants)('retains %s actual writer schema, query order and every exact output operand', (_name, schemaText, queryText, resultText) => {
  const descriptor = parsedSchema(schemaText), query = JSON.parse(queryText) as SourceRegisterQueryWire, result = parsedStatement(resultText)
  expect(validateRegisterDescriptor(descriptor)).toBeNull()
  expect(validateRegisterResult(result, descriptor)).toBeNull()
  expect(serializeRegisterQuery(buildRegisterQuery(descriptor, registerQueryDraft(query, descriptor)), descriptor)).toBe(queryText)
  for (const value of [...result.groups.flatMap(group => group.values), ...result.grandValues]) {
    // Invert displayed decimal notation independently; no numeric floating point conversion.
    const text = formatExactRegisterNumber(value), point = text.indexOf(',')
    const coefficient = text.replace(',', '').replace(/^(-?)0+(?=\d)/, '$1')
    expect(coefficient).toBe(value.coefficient)
    expect(point < 0 ? '0' : String(text.length - point - 1)).toBe(value.scale)
  }
})

it('renders all seven actual typed key alternatives without collapsing empty/null/undefined', () => {
  const descriptor = parsedSchema(typedSchema), result = parsedStatement(typedStatement)
  render(<MantineProvider env="test"><SourceRegisterResultTable descriptor={descriptor} result={result} registerLabel="Типи — лише контроль кодека" /></MantineProvider>)
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(7)
  for (const label of ['Не визначено', 'Відсутнє значення (Null)', 'Порожнє посилання', 'Ні']) expect(screen.getByText(label)).toBeTruthy()
  const text = screen.getByTitle('Текстове значення')
  expect(text.textContent).toBe('e\u0301 / \u00e9 <&> " 😀')
  expect(text.querySelector('*')).toBeNull()
})

it('shows all 166 digits from actual kernel arithmetic at scale38', () => {
  const descriptor = parsedSchema(kernelSchema), result = parsedStatement(kernelStatement)
  render(<MantineProvider env="test"><SourceRegisterResultTable descriptor={descriptor} result={result} registerLabel="Велике число — контроль ядра" /></MantineProvider>)
  const coefficient = `${'9'.repeat(128)}${'0'.repeat(37)}1`
  expect(result.grandValues).toEqual([{ coefficient, scale: '38' }])
  expect(screen.getAllByText(`${'9'.repeat(128)},${'0'.repeat(37)}1`)).toHaveLength(2)
})

it('keeps 1280 actual selected columns available, including signed values on the final page', () => {
  const descriptor = parsedSchema(wideSchema), result = parsedStatement(wideStatement)
  render(<MantineProvider env="test"><SourceRegisterResultTable descriptor={descriptor} result={result} registerLabel="1280 — контроль кодека" /></MantineProvider>)
  expect(result.query.selections).toHaveLength(1280)
  const navigation = screen.getByRole('navigation', { name: 'Сторінки показників результату' })
  fireEvent.click(within(navigation).getByRole('button', { name: 'Наступна сторінка' }))
  expect(screen.getByText('Показники 11–20 із 1280')).toBeTruthy()
  fireEvent.click(within(navigation).getByRole('button', { name: '128' }))
  expect(screen.getByText('Показники 1271–1280 із 1280')).toBeTruthy()
  const expected = result.groups[0].values.slice(1270).concat(result.grandValues.slice(1270))
  expect(expected.every(value => value.scale === '0')).toBe(true)
  expect(Array.from(screen.getByRole('table').querySelectorAll('td.source-register-exact'), cell => cell.textContent)).toEqual(expected.map(value => value.coefficient))
})

it('retains actual empty output as no groups plus its explicit grand', () => {
  const descriptor = parsedSchema(emptySchema), result = parsedStatement(emptyStatement)
  render(<MantineProvider env="test"><SourceRegisterResultTable descriptor={descriptor} result={result} registerLabel="Порожній — контроль кодека" /></MantineProvider>)
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(0)
  expect(screen.getByRole('table').querySelector('tfoot')?.textContent).toBe('Загальний підсумок0')
})

it('retains the 174-digit output-only transport boundary without treating it as authenticated kernel evidence', () => {
  const candidate = parsedStatement(transport174)
  // This intentionally synthetic output mutation has no independent publication
  // proof. Exercise only the exact formatter, never promote it to a live result.
  expect(candidate.grandValues[0]).toEqual({ coefficient: '9'.repeat(174), scale: '38' })
  expect(formatExactRegisterNumber(candidate.grandValues[0])).toBe(`${'9'.repeat(136)},${'9'.repeat(38)}`)
})
