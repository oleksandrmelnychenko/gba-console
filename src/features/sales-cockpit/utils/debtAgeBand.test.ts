import { expect, it } from 'vitest'
import { debtAgeBandLabel } from './debtAgeBand'

it('names the age band of a debt task by days past the payment terms', () => {
  expect(debtAgeBandLabel({ age_band: 'fresh', grace_days: 3 })).toBe('4–30 днів')
  expect(debtAgeBandLabel({ age_band: 'aged', grace_days: 3 })).toBe('31–90 днів')
  expect(debtAgeBandLabel({ age_band: 'old', grace_days: 3 })).toBe('понад 90 днів')
  expect(debtAgeBandLabel({ age_band: 'fresh', grace_days: 5 })).toBe('6–30 днів')
  expect(debtAgeBandLabel({ age_band: 'fresh' })).toBe('4–30 днів')
})

it('stays silent for an unknown band or an older task', () => {
  expect(debtAgeBandLabel({ age_band: 'grace', grace_days: 3 })).toBeNull()
  expect(debtAgeBandLabel({ overdue_amount: 10 })).toBeNull()
  expect(debtAgeBandLabel(undefined)).toBeNull()
})
