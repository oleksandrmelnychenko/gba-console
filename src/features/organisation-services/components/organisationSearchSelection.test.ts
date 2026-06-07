import { describe, expect, it } from 'vitest'
import { findAutoSelectableOrganization, isOrganizationSearchResultForValue } from './organisationSearchSelection'
import type { ServiceOrganization } from '../types'

describe('organisationSearchSelection', () => {
  it('selects an exact organization match from multiple suggestions', () => {
    const organizations: ServiceOrganization[] = [
      { Name: 'Alpha Logistics', ServiceOrganizationTypes: [0] },
      { Name: 'Beta Logistics', ServiceOrganizationTypes: [1] },
    ]

    expect(findAutoSelectableOrganization(organizations, ' beta logistics ')).toBe(organizations[1])
  })

  it('selects the only suggestion when there is no exact match', () => {
    const organizations: ServiceOrganization[] = [
      { Name: 'Gamma Customs', ServiceOrganizationTypes: [2] },
    ]

    expect(findAutoSelectableOrganization(organizations, 'gamma')).toBe(organizations[0])
  })

  it('does not select from multiple non-exact suggestions', () => {
    const organizations: ServiceOrganization[] = [
      { Name: 'Gamma Customs', ServiceOrganizationTypes: [2] },
      { Name: 'Gamma Port', ServiceOrganizationTypes: [6] },
    ]

    expect(findAutoSelectableOrganization(organizations, 'gamma')).toBeNull()
  })

  it('matches result query values with normalized spacing and case', () => {
    expect(isOrganizationSearchResultForValue(' ACME   Україна ', 'acme Україна')).toBe(true)
  })
})
