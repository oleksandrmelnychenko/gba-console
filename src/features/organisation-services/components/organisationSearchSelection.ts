import type { ServiceOrganization } from '../types'

export function findAutoSelectableOrganization(
  organizations: ServiceOrganization[],
  searchValue: string,
): ServiceOrganization | null {
  const normalizedSearchValue = normalizeOrganizationSearchValue(searchValue)

  if (!normalizedSearchValue) {
    return null
  }

  const exactMatch = organizations.find(
    (organization) => normalizeOrganizationSearchValue(organization.Name) === normalizedSearchValue,
  )

  if (exactMatch) {
    return exactMatch
  }

  return organizations.length === 1 ? organizations[0] : null
}

export function isOrganizationSearchResultForValue(resultValue: string, searchValue: string): boolean {
  return normalizeOrganizationSearchValue(resultValue) === normalizeOrganizationSearchValue(searchValue)
}

function normalizeOrganizationSearchValue(value?: string): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA')
}
