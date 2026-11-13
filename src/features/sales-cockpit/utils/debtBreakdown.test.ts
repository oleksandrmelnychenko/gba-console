import { expect, it } from 'vitest'
import { collectDebtBreakdown } from './debtBreakdown'

it('keeps the unknown-date group and names it as shown apart', () => {
  expect(collectDebtBreakdown({ debt_unknown_date_count: 2, debt_unknown_date_eur: 310 })).toEqual([{
    key: 'unknown_date', label: 'Дата документа не визначена', count: 2, amount_eur: 310,
    note: 'Ці документи показано окремо від відомого простроченого боргу.',
  }])
})

it('picks up an opening-balance group without knowing it in advance', () => {
  const parts = collectDebtBreakdown({
    debt_unknown_date_count: 0, debt_unknown_date_eur: 0,
    debt_opening_balance_count: 3, debt_opening_balance_eur: 99.9,
  })
  expect(parts).toEqual([{
    key: 'opening_balance', label: 'У тому числі ввід залишків', count: 3, amount_eur: 99.9,
    note: 'Ці документи вже входять до простроченого боргу.',
  }])
})

it('renders a group it has no name for with the label the service sends or a neutral one', () => {
  expect(collectDebtBreakdown({ debt_disputed_count: 1, debt_disputed_eur: 5, debt_disputed_label: 'Спірні документи' })[0].label)
    .toBe('Спірні документи')
  expect(collectDebtBreakdown({ debt_disputed_eur: 5 })[0]).toMatchObject({ label: 'Окрема група боргу (disputed)', count: 0, amount_eur: 5 })
})

it('accepts a listed breakdown and never repeats a group', () => {
  expect(collectDebtBreakdown({
    debt_opening_balance_count: 3, debt_opening_balance_eur: 10,
    debt_breakdown: [
      { key: 'opening_balance', count: 9, amount_eur: 9 },
      { code: 'other', label: 'Інше', count: 1, eur: 2 },
      null,
    ],
  }).map((part) => [part.key, part.count, part.amount_eur])).toEqual([['opening_balance', 3, 10], ['other', 1, 2]])
})

it('leaves groups with their own messages and empty groups out', () => {
  expect(collectDebtBreakdown({
    debt_unknown_terms_count: 4, debt_unknown_terms_eur: 40,
    debt_unconverted_count: 2,
    debt_opening_balance_count: 0, debt_opening_balance_eur: 0,
    debt_aging: [],
  })).toEqual([])
  expect(collectDebtBreakdown(null)).toEqual([])
})
