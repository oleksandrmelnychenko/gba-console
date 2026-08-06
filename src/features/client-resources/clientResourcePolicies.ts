import type { ClientResourceOrganization, ClientResourcePricing } from './types'

const TECHNICAL_SOURCE_ORGANIZATION_NAMES = new Set([
  'ТОВЗЛАГОДААВТО',
  'ТОВПАККОНКОРД',
  'ТОВХМЕЛЬНИЦЬКИЙАГРЕГАТНИЙЗАВОД',
  'ФОПБЕРЕШВІЛІВАДИМВІКТОРОВИЧ',
])

function normalizeOrganizationName(value: string | undefined): string {
  return (value || '')
    .normalize('NFKC')
    .toLocaleUpperCase('uk')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function isBusinessOrganizationVisible(organization: ClientResourceOrganization): boolean {
  return ![organization.Name, organization.FullName]
    .map(normalizeOrganizationName)
    .some((name) => TECHNICAL_SOURCE_ORGANIZATION_NAMES.has(name))
}

export function canDeletePricing(pricing: ClientResourcePricing): boolean {
  return pricing.IsSourceManaged !== true
}

export function canEditPricing(pricing: ClientResourcePricing): boolean {
  if (pricing.IsSourceManaged !== true) {
    return true
  }

  return Boolean(pricing.BasePricingId || pricing.BasePricing || pricing.ExtraCharge)
}
