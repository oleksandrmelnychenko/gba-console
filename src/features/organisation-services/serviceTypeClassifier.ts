import type { ServiceItem, ServiceOrganizationTypeValue } from './types'

export type ServiceTypeClassificationContext = {
  organizationName?: string
  serviceTypes?: ServiceOrganizationTypeValue[]
}

export function getBrokerServiceType(
  service: ServiceItem,
  context: ServiceTypeClassificationContext,
  fallbackServiceType: ServiceOrganizationTypeValue,
): ServiceOrganizationTypeValue {
  const organizationName = normalizeOrganizationName(context.organizationName)
  const customOrganizationName = normalizeOrganizationName(service.CustomOrganization?.Name)
  const exciseDutyOrganizationName = normalizeOrganizationName(service.ExciseDutyOrganization?.Name)
  const matchesCustomOrganization = Boolean(organizationName && customOrganizationName === organizationName)
  const matchesExciseDutyOrganization = Boolean(organizationName && exciseDutyOrganizationName === organizationName)

  if (matchesCustomOrganization && !matchesExciseDutyOrganization) {
    return 2
  }

  if (matchesExciseDutyOrganization && !matchesCustomOrganization) {
    return 3
  }

  if (matchesCustomOrganization && matchesExciseDutyOrganization) {
    const searchedCustom = context.serviceTypes?.includes(2) === true
    const searchedExciseDuty = context.serviceTypes?.includes(3) === true

    if (searchedCustom && !searchedExciseDuty) {
      return 2
    }

    if (searchedExciseDuty && !searchedCustom) {
      return 3
    }
  }

  if (customOrganizationName && !exciseDutyOrganizationName) {
    return 2
  }

  if (exciseDutyOrganizationName && !customOrganizationName) {
    return 3
  }

  return service.SupplyCustomType === 1 ? 3 : fallbackServiceType
}

function normalizeOrganizationName(value?: string): string {
  return value?.trim().toLocaleLowerCase('uk-UA') || ''
}
