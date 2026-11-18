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

/**
 * Organizations a picker may offer: the ones with a name. Nameless organizations used to be
 * listed by their GUID (N3-07, 987aa79f); the one already chosen in the form is kept so the
 * field does not lose its value.
 */
export function withNamedOrganizations<T extends OrganizationNameSource & { Id?: number | null; NetUid?: string | null }>(
  organizations: T[],
  keepValue?: string | null,
): T[] {
  return organizations.filter((organization) =>
    Boolean(getOrganizationDisplayName(organization))
    || (Boolean(keepValue) && (organization.NetUid === keepValue || String(organization.Id ?? '') === keepValue)))
}
