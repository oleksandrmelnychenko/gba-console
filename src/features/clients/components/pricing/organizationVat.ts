import type { Organization, VatRate } from '../../types'

export function organizationHasVat(organization?: Organization, knownOrganizations: readonly Organization[] = []): boolean {
  if (!organization) {
    return false
  }

  const vatRate = organization.VatRate ?? findKnownVatRate(organization.VatRateId, knownOrganizations)

  if (vatRate) {
    return Boolean(vatRate.Value)
  }

  return Boolean(organization.VatRateId) || Boolean(organization.IsVatAgreements)
}

function findKnownVatRate(vatRateId: number | undefined, knownOrganizations: readonly Organization[]): VatRate | undefined {
  if (vatRateId == null) {
    return undefined
  }

  return knownOrganizations.find((known) => known.VatRate?.Id === vatRateId && known.VatRate.Value != null)?.VatRate
}
