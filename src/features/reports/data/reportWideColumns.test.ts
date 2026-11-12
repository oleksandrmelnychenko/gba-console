import { expect, it } from 'vitest'
import { columnGroupingLimitHint } from './reportWideColumns'

it('warns about column groupings that are known to be very wide and stays silent otherwise', () => {
  expect(columnGroupingLimitHint([])).toBeNull()
  expect(columnGroupingLimitHint([{ type: 2, label: 'По місяцях' }, { type: 29, label: 'Склад' }])).toBeNull()
  expect(columnGroupingLimitHint([{ type: 2, label: 'По місяцях' }, { type: 5, label: 'Товар' }]))
    .toBe('Групування колонок за полем «Товар» може перевищити ліміт 16\u00a0000 колонок. Перенесіть його в рядки або додайте відбір.')
  expect(columnGroupingLimitHint([{ type: 12, label: 'Клієнт' }, { type: 17, label: 'Документ продажу' }]))
    .toContain('за полями «Клієнт», «Документ продажу» може перевищити ліміт 16\u00a0000 колонок')
})
