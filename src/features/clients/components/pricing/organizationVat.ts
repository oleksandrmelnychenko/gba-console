import type { Organization } from '../../types'

export function organizationHasVat(organization?: Organization): boolean {
  if (!organization) {
    return false
  }

  if (organization.VatRate) {
    return Boolean(organization.VatRate.Value)
  }

  return Boolean(organization.VatRateId) || Boolean(organization.IsVatAgreements)
}
