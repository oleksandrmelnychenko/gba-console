export type OrganizationNameSource = {
  Name?: string | null
  NameUk?: string | null
  NamePl?: string | null
  FullName?: string | null
}

export function getOrganizationDisplayName(organization?: OrganizationNameSource | null): string {
  if (!organization) {
    return ''
  }

  for (const value of [organization.Name, organization.NameUk, organization.NamePl, organization.FullName]) {
    const text = typeof value === 'string' ? value.trim() : ''

    if (text) {
      return text
    }
  }

  return ''
}
