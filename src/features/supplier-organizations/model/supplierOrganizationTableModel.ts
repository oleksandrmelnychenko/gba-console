import type { SupplyOrganization } from '../types'

export type SupplierOrganizationCellText = {
  primary: string
  secondary: string
}

export function deduplicateSupplyOrganizationsByIdentity(
  organizations: SupplyOrganization[],
): SupplyOrganization[] {
  const seenIdentities = new Set<string>()

  return organizations.filter((organization) => {
    const identity = getSupplyOrganizationIdentity(organization)

    if (!identity) {
      return true
    }

    if (seenIdentities.has(identity)) {
      return false
    }

    seenIdentities.add(identity)
    return true
  })
}

export function getSupplyOrganizationNameCellText(
  organization: SupplyOrganization,
): SupplierOrganizationCellText {
  return {
    primary: cleanText(organization.Name),
    // Agreement owners and contacts have dedicated columns. Repeating them
    // below the supplier name made one record look like two different rows.
    secondary: cleanText(organization.Address),
  }
}

export function getSupplyOrganizationContactCellText(
  organization: SupplyOrganization,
): SupplierOrganizationCellText {
  const primary = firstText([
    organization.ContactPersonName,
    organization.PhoneNumber,
    organization.ContactPersonPhone,
  ])
  const secondary = firstText(
    [
      organization.ContactPersonEmail,
      organization.EmailAddress,
      organization.ContactPersonPhone,
      organization.PhoneNumber,
    ],
    primary,
  )

  return { primary, secondary }
}

export function getSupplyOrganizationBankCellText(
  organization: SupplyOrganization,
): SupplierOrganizationCellText {
  const primary = firstText([
    organization.Bank,
    organization.Requisites,
    organization.BankAccount,
  ])
  const secondary = firstText(
    [
      organization.BankAccount,
      organization.BankAccountEUR,
      organization.SwiftBic,
      organization.Swift,
    ],
    primary,
  )

  return { primary, secondary }
}

export function getSupplyOrganizationAgreementCellText(
  organization: SupplyOrganization,
): SupplierOrganizationCellText {
  const organizations = getAgreementOrganizations(organization)
  const agreements = getAgreementNames(organization)
  const currencies = getAgreementCurrencies(organization)

  if (organizations) {
    return {
      primary: organizations,
      secondary: compactStrings([agreements, currencies]).join(' · '),
    }
  }

  return {
    primary: agreements,
    secondary: currencies,
  }
}

export function getAgreementOrganizations(organization: SupplyOrganization): string {
  return uniqueStrings(
    (organization.SupplyOrganizationAgreements || []).map(
      (agreement) => agreement.Organization?.Name || agreement.Organization?.FullName,
    ),
  ).join(' · ')
}

export function getAgreementNames(organization: SupplyOrganization): string {
  return uniqueStrings(
    (organization.SupplyOrganizationAgreements || []).map(
      (agreement) => agreement.Name || agreement.Number,
    ),
  ).join(' · ')
}

export function getAgreementCurrencies(organization: SupplyOrganization): string {
  return uniqueStrings(
    (organization.SupplyOrganizationAgreements || []).map(
      (agreement) => agreement.Currency?.Code || agreement.Currency?.Name,
    ),
  ).join(' · ')
}

function getSupplyOrganizationIdentity(organization: SupplyOrganization): string | null {
  const netUid = cleanText(organization.NetUid)

  if (netUid) {
    return `net:${netUid}`
  }

  return typeof organization.Id === 'number' && Number.isFinite(organization.Id)
    ? `id:${organization.Id}`
    : null
}

function firstText(values: Array<string | null | undefined>, excludedValue = ''): string {
  const excluded = cleanText(excludedValue)

  return compactStrings(values).find((value) => value !== excluded) || ''
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(compactStrings(values))]
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map(cleanText).filter(Boolean)
}

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : ''
}
