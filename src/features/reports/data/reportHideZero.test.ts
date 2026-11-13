import { expect, it } from 'vitest'
import { reportHideZeroError } from './reportHideZero'
import { orderedAccountRequest } from './reportOrdering.test-fixtures'

it('refuses a saved hide-zero rule under either alias and accepts its absence', () => {
  const request = orderedAccountRequest()
  expect(reportHideZeroError(request)).toBeNull()
  expect(reportHideZeroError({ ...request, hideZero: { Version: 1 } })).toContain('не підтвердив приховування нулів')
  expect(reportHideZeroError({ ...request, HideZero: { Version: 1 } })).toContain('не підтвердив приховування нулів')
})
