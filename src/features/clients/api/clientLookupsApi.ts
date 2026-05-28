import { apiRequest } from '../../../shared/api/apiClient'
import {
  getClientResourceBasePricings,
  getClientResourceCurrencies,
  getClientResourceOrganizations,
  getClientResourcePerfectClients,
  getClientResourcePricingTypes,
  getClientResourcePricings,
  getClientResourceRegions,
} from '../../client-resources/api/clientResourcesApi'
import {
  getProductGroupWithRoot,
  getProductGroups,
  getRootProductGroups,
} from '../../product-groups/api/productGroupsApi'
import type {
  ClientGroup,
  ClientWorkplace,
  Country,
  DeliveryRecipient,
  Incoterm,
  Manager,
  PackingMarking,
  PackingMarkingPayment,
} from '../types'

export {
  getClientResourceBasePricings,
  getClientResourceCurrencies,
  getClientResourceOrganizations,
  getClientResourcePerfectClients,
  getClientResourcePricingTypes,
  getClientResourcePricings,
  getClientResourceRegions,
  getProductGroupWithRoot,
  getProductGroups,
  getRootProductGroups,
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

export async function getSaleManagers(): Promise<Manager[]> {
  return getLookupList<Manager>('/usermanagement/profiles/managers/sales')
}

export async function getPurchaseManagers(): Promise<Manager[]> {
  return getLookupList<Manager>('/usermanagement/profiles/managers/purchase')
}

export async function getClientGroups(clientNetId: string): Promise<ClientGroup[]> {
  const result = await apiRequest<unknown>('/clients/all/groups', {
    query: {
      clientNetId,
    },
  })

  return normalizeLookupList<ClientGroup>(result)
}

export async function getClientWorkplaces(netId: string): Promise<ClientWorkplace[]> {
  const result = await apiRequest<unknown>('/clients/all/workplaces/by/client', {
    query: {
      netId,
    },
  })

  return normalizeLookupList<ClientWorkplace>(result)
}

export async function getClientDeliveryRecipients(netId: string): Promise<DeliveryRecipient[]> {
  const result = await apiRequest<unknown>('/deliveries/recipients/all/client', {
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
