import { apiRequest } from '../../../shared/api/apiClient'
import {
  createClientResourcePerfectClient,
  getClientResourceBasePricings,
  getClientResourceCurrencies,
  getClientResourceOrganizations,
  getClientResourcePricingTypes,
  getClientResourcePricings,
  getClientResourceRegions,
} from '../../client-resources/api/clientResourcesApi'
import {
  getProductGroupWithRoot,
  getProductGroups,
  getRootProductGroups,
} from '../../product-groups/api/productGroupsApi'
import type { ClientResourcePerfectClient } from '../../client-resources/types'
import type {
  ClientGroup,
  ClientWorkplace,
  Country,
  DeliveryRecipient,
  Incoterm,
  Manager,
  PackingMarking,
  PackingMarkingPayment,
  Region,
  RegionCode,
} from '../types'

export {
  createClientResourcePerfectClient,
  getClientResourceBasePricings,
  getClientResourceCurrencies,
  getClientResourceOrganizations,
  getClientResourcePricingTypes,
  getClientResourcePricings,
  getClientResourceRegions,
  getProductGroupWithRoot,
  getProductGroups,
  getRootProductGroups,
}

/** Perfect-client definitions for the client card (`details`) or the new-client form (`create`). */
export async function getClientCardPerfectClients(
  clientTypeRoleId: number,
  context: 'create' | 'details',
): Promise<ClientResourcePerfectClient[]> {
  const result = await apiRequest<unknown>(`/clients/perfect/clients-card/${context}/role`, {
    query: {
      id: clientTypeRoleId,
    },
  })

  return normalizeLookupList<ClientResourcePerfectClient>(result)
}

export async function getSupplierCountries(): Promise<Country[]> {
  return getLookupList<Country>('/countries/all')
}

export async function getIncoterms(): Promise<Incoterm[]> {
  return getLookupList<Incoterm>('/incoterms/all')
}

export async function getPackingMarkings(): Promise<PackingMarking[]> {
  return getLookupList<PackingMarking>('/packings/markings/all')
}

export async function getPackingMarkingPayments(): Promise<PackingMarkingPayment[]> {
  return getLookupList<PackingMarkingPayment>('/packings/markings/payments/all')
}

export async function getAllRegions(): Promise<Region[]> {
  return getLookupList<Region>('/regions/all')
}

export async function getAvailableRegionCode(region: Region): Promise<RegionCode | null> {
  const result = await apiRequest<unknown>('/regions/codes/get/available', {
    method: 'POST',
    body: region,
  })

  if (result && typeof result === 'object') {
    return result as RegionCode
  }

  return null
}

export async function checkRegionCodeAvailability(regionNetUid: string, code: string): Promise<boolean> {
  // Only the new-client form checks code availability, so it reads the client-create facade.
  const result = await apiRequest<unknown>('/regions/codes/clients/create/availability/check', {
    query: {
      code,
      netId: regionNetUid,
    },
  })

  return result === true
}

export async function createIncoterm(incoterm: Incoterm): Promise<Incoterm | null> {
  const result = await apiRequest<unknown>('/incoterms/clients/new', {
    method: 'POST',
    body: incoterm,
  })

  if (result && typeof result === 'object') {
    return result as Incoterm
  }

  return null
}

export async function createCountry(country: Country): Promise<Country | null> {
  const result = await apiRequest<unknown>('/countries/clients/new', {
    method: 'POST',
    body: country,
  })

  if (result && typeof result === 'object') {
    return result as Country
  }

  return null
}

export async function createRegion(region: Region): Promise<Region | null> {
  const result = await apiRequest<unknown>('/regions/clients/new', {
    method: 'POST',
    body: region,
  })

  if (result && typeof result === 'object') {
    return result as Region
  }

  return null
}

export async function getSaleManagers(): Promise<Manager[]> {
  return getLookupList<Manager>('/usermanagement/profiles/managers/sales')
}

export async function getPurchaseManagers(): Promise<Manager[]> {
  return getLookupList<Manager>('/usermanagement/profiles/managers/purchase')
}

export async function getClientGroups(clientNetId: string): Promise<ClientGroup[]> {
  const result = await apiRequest<unknown>('/clients/structure/card/groups', {
    query: {
      clientNetId,
    },
  })

  return normalizeLookupList<ClientGroup>(result)
}

export async function getClientWorkplaces(netId: string): Promise<ClientWorkplace[]> {
  const result = await apiRequest<unknown>('/clients/structure/card/workplaces', {
    query: {
      netId,
    },
  })

  return normalizeLookupList<ClientWorkplace>(result)
}

export async function getClientDeliveryRecipients(netId: string): Promise<DeliveryRecipient[]> {
  const result = await apiRequest<unknown>('/deliveries/recipients/structure/all/client', {
    query: {
      netId,
    },
  })

  return normalizeLookupList<DeliveryRecipient>(result)
}

async function getLookupList<T>(path: string): Promise<T[]> {
  const result = await apiRequest<unknown>(path)

  return normalizeLookupList<T>(result)
}

function normalizeLookupList<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object') {
    const items = (result as { Items?: unknown }).Items

    if (Array.isArray(items)) {
      return items as T[]
    }
  }

  return []
}
