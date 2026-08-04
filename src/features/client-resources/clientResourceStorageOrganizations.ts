import type { ClientResourceOrganization } from './types'

const UKRAINE_CULTURE = 'uk'

export function buildSaleOrganizationsByStorageId(
  organizations: ClientResourceOrganization[],
): Map<number, string[]> {
  const result = new Map<number, string[]>()

  for (const organization of organizations) {
    if (!organization.StorageId) {
      continue
    }

    const names = result.get(organization.StorageId) || []
    const translatedName = organization.OrganizationTranslations
      ?.find((translation) => translation.CultureCode === UKRAINE_CULTURE)
      ?.Name?.trim()
    names.push(translatedName || organization.Name?.trim() || '')
    result.set(organization.StorageId, names)
  }

  for (const names of result.values()) {
    names.sort((left, right) => left.localeCompare(right, 'uk'))
  }

  return result
}
