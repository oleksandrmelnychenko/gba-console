import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { SourceRegisterReportBuilder } from './SourceRegisterReportBuilder'
import { SourceRegisterResultTable } from './SourceRegisterResultTable'
import { registerAtomIdentity, REGISTER_STAGES } from './validation'
import { testDescriptor, testDraft, testResult, testUuid } from './registerReports.test-fixtures'
import type { RegisterAlternative, RegisterAtom, SourceRegisterDescriptorWire, SourceRegisterQueryDraft, SourceRegisterQueryWire } from './types'

const wrap = (children: ReactNode) => <MantineProvider env="test">{children}</MantineProvider>
function ControlledBuilder({ descriptor, initial, onSubmit, changed }: { descriptor: SourceRegisterDescriptorWire; initial: SourceRegisterQueryDraft; onSubmit: (query: SourceRegisterQueryWire) => void; changed?: (draft: SourceRegisterQueryDraft) => void }) {
  const [value, setValue] = useState(initial)
  return <SourceRegisterReportBuilder descriptor={descriptor} registerLabel="Синтетичний тестовий регістр" value={value} onChange={draft => { setValue(draft); changed?.(draft) }} onSubmit={onSubmit} />
}

it('submits explicit familiar date/time controls and preserves tick7 when another bound is edited', () => {
  const descriptor = testDescriptor(), submit = vi.fn(), changed = vi.fn()
  render(wrap(<ControlledBuilder descriptor={descriptor} initial={testDraft(descriptor)} onSubmit={submit} changed={changed} />))
  fireEvent.change(screen.getByLabelText('Від (включно): дата'), { target: { value: '2026-04-01' } })
  fireEvent.change(screen.getByLabelText('Від (включно): час'), { target: { value: '13:05:09' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати звіт' }))
  expect(submit).toHaveBeenCalledOnce()
  expect(submit.mock.calls[0][0]).toMatchObject({ from: '2026-04-01T13:05:09.0000001', toExclusive: '2026-04-03T00:00:00.0000002' })
  expect(Object.keys(changed.mock.calls.at(-1)![0]).sort()).toEqual(['columnFields', 'from', 'rowFields', 'selections', 'toExclusive'])
  expect(screen.getByText(descriptor.schema.schemaHash).closest('details')).not.toBeNull()
  expect(screen.queryByLabelText(/policy|complete|publication/i)).toBeNull()
})

it('adds 350 selections, pages visible choices and submits the complete array in caller order', () => {
  const descriptor = testDescriptor(70), submit = vi.fn(), changed = vi.fn(), initial = { ...testDraft(descriptor), selections: [] }
  render(wrap(<ControlledBuilder descriptor={descriptor} initial={initial} onSubmit={submit} changed={changed} />))
  expect((screen.getByRole('button', { name: 'Сформувати звіт' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Додати всі ресурси та стадії' }))
  expect(screen.getByText('Показники (350)')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Показник 21: підняти' })).toBeNull()
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Сторінки вибраних показників' })).getByRole('button', { name: 'Наступна сторінка' }))
  expect(screen.getByRole('button', { name: 'Показник 21: підняти' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Показник 21: підняти' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати звіт' }))
  const selected = submit.mock.calls[0][0].selections
  expect(selected).toHaveLength(350)
  expect(selected[19]).toEqual({ resourceUuid: descriptor.resources[4].uuid, stage: 'Opening' })
  expect(selected[20]).toEqual({ resourceUuid: descriptor.resources[3].uuid, stage: 'Closing' })
  expect(selected.at(-1)).toEqual({ resourceUuid: descriptor.resources[69].uuid, stage: 'Closing' })
  expect(changed.mock.calls.at(-1)![0].selections).toHaveLength(350)
})

it('retains cross-axis duplicates visibly invalid and blocks submit; busy/disabled also block the callback', () => {
  const descriptor = testDescriptor(), draft = testDraft(descriptor), submit = vi.fn(), onChange = vi.fn()
  const { rerender } = render(wrap(<SourceRegisterReportBuilder descriptor={descriptor} registerLabel="Тест" value={{ ...draft, columnFields: draft.rowFields }} onChange={onChange} onSubmit={submit} />))
  expect((screen.getByRole('button', { name: 'Сформувати звіт' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.submit(screen.getByRole('form', { name: 'Конструктор регістрового звіту' })); expect(submit).not.toHaveBeenCalled()
  rerender(wrap(<SourceRegisterReportBuilder descriptor={descriptor} registerLabel="Тест" value={draft} disabled onChange={onChange} onSubmit={submit} />))
  fireEvent.submit(screen.getByRole('form', { name: 'Конструктор регістрового звіту' })); expect(submit).not.toHaveBeenCalled()
})

it('shows exact signed values and large revision, sparse row/column groups and authoritative grand without a chart', () => {
  const descriptor = testDescriptor(), result = testResult(descriptor)
  const { container } = render(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Тестовий результат" result={result} />))
  const table = screen.getByRole('table')
  expect(within(table).getByText('-12,3401')).toBeTruthy(); expect(within(table).getByText('-10,3401')).toBeTruthy()
  expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
  expect(screen.getByText('9007199254740993')).toBeTruthy()
  expect(screen.getByText(result.publication.metadata.scopeHash).closest('details')).not.toBeNull()
  expect(container.querySelector('svg.recharts-surface')).toBeNull()
  expect(table.textContent).toContain('Колонки'); expect(table.textContent).toContain('Рядки')
})

it('keeps all 174 digits and 350 output columns available through presentation-only pages', () => {
  const descriptor = testDescriptor(70), base = testResult(descriptor)
  const selections = descriptor.resources.flatMap(resource => REGISTER_STAGES.map(stage => ({ resourceUuid: resource.uuid, stage })))
  const exact = { coefficient: `-${'9'.repeat(174)}`, scale: '4' }
  const result = { ...base, query: { ...base.query, selections }, groups: [{ ...base.groups[0], values: selections.map(() => exact) }], grandValues: selections.map(() => ({ coefficient: '1', scale: '0' })) }
  render(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Великий тестовий результат" result={result} />))
  expect(screen.getAllByText(`-${'9'.repeat(170)},9999`)).toHaveLength(10)
  const pages = screen.getByLabelText('Сторінки показників результату')
  expect(within(pages).getByRole('button', { name: 'Попередня сторінка' })).toBeTruthy()
  expect(within(pages).getByRole('button', { name: 'Наступна сторінка' })).toBeTruthy()
  fireEvent.click(within(pages).getByRole('button', { name: '35' }))
  expect(screen.getByText('Показники 341–350 із 350')).toBeTruthy()
  expect(screen.getByRole('table').textContent).toContain('Ресурс 70 — Кінцевий залишок')
  expect(result.query.selections).toHaveLength(350); expect(result.groups[0].values[349]).toEqual(exact)
})

it('keeps identical reference captions as distinct exact contracts and preserves typed empty', () => {
  const base = testDescriptor(), sourceTypeUuid = testUuid(800)
  const descriptor = { ...base, dimensions: [{ ...base.dimensions[0], referenceLayout: 'Fixed' as const, alternatives: [{ kind: 'Reference' as const, sourceTypeUuid }] }, ...base.dimensions.slice(1)] }
  const original = testResult(descriptor), refs = ['1', '2', '0'].map(digit => ({ kind: 'Reference' as const, sourceTypeUuid, rawReferenceHex: digit.repeat(32) }))
  const result = { ...original, groups: refs.map((ref, index) => ({ ...original.groups[index % 2], rowKey: [ref] })) }
  const captions = new Map(refs.slice(0, 2).map(ref => [registerAtomIdentity(ref), 'Однаковий договір']))
  render(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Договори" result={result} referenceCaptions={captions} />))
  expect(screen.getAllByText('Однаковий договір')).toHaveLength(2)
  expect(screen.getByText('Порожнє посилання')).toBeTruthy()
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(3)
  expect(screen.getByText('1'.repeat(32)).closest('details')).not.toBeNull()
})

it('renders explicit empty grand and removes the entire previous result after a malformed replacement', () => {
  const descriptor = testDescriptor(), result = { ...testResult(descriptor), groups: [], grandValues: [{ coefficient: '0', scale: '0' }] }
  const { rerender } = render(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Порожній результат" result={result} />))
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(0)
  expect(screen.getByRole('table').querySelector('tfoot')?.textContent).toBe('Загальний підсумок0')
  rerender(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Некоректний результат" result={{ ...result, grandValues: [] }} />))
  expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull()
})

it('renders Null, Undefined, false, empty text, numeric zero and typed empty as distinct rows', () => {
  const base = testDescriptor(), sourceTypeUuid = testUuid(801)
  const alternatives: RegisterAlternative[] = [{ kind: 'Undefined' }, { kind: 'Null' }, { kind: 'Boolean' }, { kind: 'String' }, { kind: 'Number', precision: '38', scale: '38' }, { kind: 'Reference', sourceTypeUuid }]
  const descriptor = { ...base, dimensions: [{ ...base.dimensions[0], referenceLayout: 'Composite' as const, alternatives }, ...base.dimensions.slice(1)] }
  const atoms: RegisterAtom[] = [{ kind: 'Undefined' }, { kind: 'Null' }, { kind: 'Boolean', value: false }, { kind: 'String', value: '' }, { kind: 'Number', coefficient: '0', scale: '0' },
    { kind: 'Reference', sourceTypeUuid, rawReferenceHex: '0'.repeat(32), rawPhysicalTypeTagHex: '7f', rawPhysicalTableTagHex: '01234567' }]
  const original = testResult(descriptor), result = { ...original, groups: atoms.map(atom => ({ ...original.groups[0], rowKey: [atom] })) }
  render(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Типи значень" result={result} />))
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6)
  for (const label of ['Не визначено', 'Відсутнє значення (Null)', 'Ні', 'Порожній рядок', '0', 'Порожнє посилання']) expect(screen.getByText(label)).toBeTruthy()
})

it('resets result pagination when the period or immutable publication changes', () => {
  const descriptor = testDescriptor(3), original = testResult(descriptor)
  const selections = descriptor.resources.flatMap(resource => REGISTER_STAGES.map(stage => ({ resourceUuid: resource.uuid, stage })))
  const result = { ...original, query: { ...original.query, selections }, groups: [], grandValues: selections.map(() => ({ coefficient: '0', scale: '0' })) }
  const { rerender } = render(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Сторінки" result={result} />))
  fireEvent.click(within(screen.getByLabelText('Сторінки показників результату')).getByRole('button', { name: '2' }))
  expect(screen.getByText('Показники 11–15 із 15')).toBeTruthy()
  const next = { ...result, query: { ...result.query, from: '2026-04-02T00:00:00.0000002' } }
  rerender(wrap(<SourceRegisterResultTable descriptor={descriptor} registerLabel="Сторінки" result={next} />))
  expect(screen.getByText('Показники 1–10 із 15')).toBeTruthy()
})
