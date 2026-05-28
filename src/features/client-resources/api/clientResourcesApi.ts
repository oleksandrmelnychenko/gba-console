import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ClientResourceClientType,
  ClientResourceClientTypeRole,
  ClientResourceCurrency,
  ClientResourceMeasureUnit,
  ClientResourceOrganization,
  ClientResourcePerfectClient,
  ClientResourcePricing,
  ClientResourcePricingType,
  ClientResourceRegion,
  ClientResourceRegionCode,
  ClientResourceStorage,
  ClientResourceTaxInspection,
  ClientResourceTransporter,
  ClientResourceTransporterType,
  ClientResourceVatRate,
} from '../types'

export async function getClientResourceRegions(): Promise<ClientResourceRegion[]> {
  return getResourceList<ClientResourceRegion>('/regions/all/codes')
}

export async function createClientResourceRegion(region: ClientResourceRegion): Promise<ClientResourceRegion | null> {
  const result = await apiRequest<unknown>('/regions/new', {
    method: 'POST',
    body: region,
  })

  return normalizeResourceItem<ClientResourceRegion>(result)
}

export async function updateClientResourceRegion(region: ClientResourceRegion): Promise<ClientResourceRegion | null> {
  const result = await apiRequest<unknown>('/regions/update', {
    method: 'POST',
    body: region,
  })

  return normalizeResourceItem<ClientResourceRegion>(result)
}

export async function deleteClientResourceRegion(netId: string): Promise<ClientResourceRegion | null> {
  const result = await apiRequest<unknown>('/regions/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourceRegion>(result)
}

export async function createClientResourceRegionCode(
  regionCode: ClientResourceRegionCode,
): Promise<ClientResourceRegionCode | null> {
  const result = await apiRequest<unknown>('/regions/codes/new', {
    method: 'POST',
    body: regionCode,
  })

  return normalizeResourceItem<ClientResourceRegionCode>(result)
}

export async function updateClientResourceRegionCode(
  regionCode: ClientResourceRegionCode,
): Promise<ClientResourceRegionCode | null> {
  const result = await apiRequest<unknown>('/regions/codes/update', {
    method: 'POST',
    body: regionCode,
  })

  return normalizeResourceItem<ClientResourceRegionCode>(result)
}

export async function deleteClientResourceRegionCode(netId: string): Promise<void> {
  await apiRequest<unknown>('/regions/codes/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getClientResourceCurrencies(): Promise<ClientResourceCurrency[]> {
  return getResourceList<ClientResourceCurrency>('/currencies/all')
}

export async function createClientResourceCurrency(
  currency: ClientResourceCurrency,
): Promise<ClientResourceCurrency | null> {
  const result = await apiRequest<unknown>('/currencies/new', {
    method: 'POST',
    body: currency,
  })

  return normalizeResourceItem<ClientResourceCurrency>(result)
}

export async function updateClientResourceCurrency(
  currency: ClientResourceCurrency,
): Promise<ClientResourceCurrency | null> {
  const result = await apiRequest<unknown>('/currencies/update', {
    method: 'POST',
    body: currency,
  })

  return normalizeResourceItem<ClientResourceCurrency>(result)
}

export async function deleteClientResourceCurrency(netId: string): Promise<ClientResourceCurrency | null> {
  const result = await apiRequest<unknown>('/currencies/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourceCurrency>(result)
}

export async function getClientResourceOrganizations(): Promise<ClientResourceOrganization[]> {
  return getResourceList<ClientResourceOrganization>('/organizations/all')
}

export async function createClientResourceOrganization(
  organization: ClientResourceOrganization,
): Promise<ClientResourceOrganization | null> {
  const result = await apiRequest<unknown>('/organizations/new', {
    method: 'POST',
    body: organization,
  })

  return normalizeResourceItem<ClientResourceOrganization>(result)
}

export async function updateClientResourceOrganization(
  organization: ClientResourceOrganization,
): Promise<ClientResourceOrganization | null> {
  const result = await apiRequest<unknown>('/organizations/update', {
    method: 'POST',
    body: organization,
  })

  return normalizeResourceItem<ClientResourceOrganization>(result)
}

export async function deleteClientResourceOrganization(netId: string): Promise<ClientResourceOrganization | null> {
  const result = await apiRequest<unknown>('/organizations/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourceOrganization>(result)
}

export async function getClientResourcePricings(): Promise<ClientResourcePricing[]> {
  return getResourceList<ClientResourcePricing>('/pricings/all')
}

export async function getClientResourceBasePricings(): Promise<ClientResourcePricing[]> {
  return getResourceList<ClientResourcePricing>('/pricings/all/base')
}

export async function getClientResourcePricingTypes(): Promise<ClientResourcePricingType[]> {
  return getResourceList<ClientResourcePricingType>('/pricings/types/all')
}

export async function createClientResourcePricing(pricing: ClientResourcePricing): Promise<ClientResourcePricing | null> {
  const result = await apiRequest<unknown>('/pricings/new', {
    method: 'POST',
    body: pricing,
  })

  return normalizeResourceItem<ClientResourcePricing>(result)
}

export async function updateClientResourcePricing(pricing: ClientResourcePricing): Promise<ClientResourcePricing | null> {
  const result = await apiRequest<unknown>('/pricings/update', {
    method: 'POST',
    body: pricing,
  })

  return normalizeResourceItem<ClientResourcePricing>(result)
}

export async function deleteClientResourcePricing(netId: string): Promise<ClientResourcePricing | null> {
  const result = await apiRequest<unknown>('/pricings/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourcePricing>(result)
}

export async function changeClientResourcePricingPriority(
  pricingId: number,
  raise: boolean,
): Promise<ClientResourcePricing[]> {
  const result = await apiRequest<unknown>('/pricings/update/priority', {
    method: 'POST',
    body: {},
    query: {
      pricingId,
      raise,
    },
  })

  return normalizeResourceList<ClientResourcePricing>(result)
}

export async function getClientResourceTaxInspections(): Promise<ClientResourceTaxInspection[]> {
  return getResourceList<ClientResourceTaxInspection>('/tax/inspections/all')
}

export async function createClientResourceTaxInspection(
  taxInspection: ClientResourceTaxInspection,
): Promise<ClientResourceTaxInspection | null> {
  const result = await apiRequest<unknown>('/tax/inspections/new', {
    method: 'POST',
    body: taxInspection,
  })

  return normalizeResourceItem<ClientResourceTaxInspection>(result)
}

export async function updateClientResourceTaxInspection(
  taxInspection: ClientResourceTaxInspection,
): Promise<ClientResourceTaxInspection | null> {
  const result = await apiRequest<unknown>('/tax/inspections/update', {
    method: 'POST',
    body: taxInspection,
  })

  return normalizeResourceItem<ClientResourceTaxInspection>(result)
}

export async function deleteClientResourceTaxInspection(netId: string): Promise<void> {
  await apiRequest<unknown>('/tax/inspections/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getClientResourceStorages(): Promise<ClientResourceStorage[]> {
  return getResourceList<ClientResourceStorage>('/storages/all')
}

export async function createClientResourceStorage(storage: ClientResourceStorage): Promise<ClientResourceStorage | null> {
  const result = await apiRequest<unknown>('/storages/new', {
    method: 'POST',
    body: storage,
  })

  return normalizeResourceItem<ClientResourceStorage>(result)
}

export async function updateClientResourceStorage(storage: ClientResourceStorage): Promise<ClientResourceStorage | null> {
  const result = await apiRequest<unknown>('/storages/update', {
    method: 'POST',
    body: storage,
  })

  return normalizeResourceItem<ClientResourceStorage>(result)
}

export async function deleteClientResourceStorage(netId: string): Promise<ClientResourceStorage | null> {
  const result = await apiRequest<unknown>('/storages/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourceStorage>(result)
}

export async function getClientResourceMeasureUnits(): Promise<ClientResourceMeasureUnit[]> {
  return getResourceList<ClientResourceMeasureUnit>('/measureunits/all')
}

export async function createClientResourceMeasureUnit(
  measureUnit: ClientResourceMeasureUnit,
): Promise<ClientResourceMeasureUnit[]> {
  const result = await apiRequest<unknown>('/measureunits/new', {
    method: 'POST',
    body: measureUnit,
  })

  return normalizeResourceList<ClientResourceMeasureUnit>(result)
}

export async function updateClientResourceMeasureUnit(
  measureUnit: ClientResourceMeasureUnit,
): Promise<ClientResourceMeasureUnit[]> {
  const result = await apiRequest<unknown>('/measureunits/update', {
    method: 'POST',
    body: measureUnit,
  })

  return normalizeResourceList<ClientResourceMeasureUnit>(result)
}

export async function deleteClientResourceMeasureUnit(netId: string): Promise<ClientResourceMeasureUnit[]> {
  const result = await apiRequest<unknown>('/measureunits/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceList<ClientResourceMeasureUnit>(result)
}

export async function getClientResourceClientTypes(): Promise<ClientResourceClientType[]> {
  return getResourceList<ClientResourceClientType>('/clients/types/all')
}

export async function updateClientResourceClientTypeRole(
  role: ClientResourceClientTypeRole,
): Promise<void> {
  await apiRequest<unknown>('/clients/types/roles/update', {
    method: 'POST',
    body: role,
  })
}

export async function getClientResourcePerfectClients(
  clientTypeRoleId: number,
): Promise<ClientResourcePerfectClient[]> {
  const result = await apiRequest<unknown>('/clients/perfect/all/role', {
    query: {
      id: clientTypeRoleId,
    },
  })

  return normalizeResourceList<ClientResourcePerfectClient>(result)
}

export async function createClientResourcePerfectClient(
  perfectClient: ClientResourcePerfectClient,
): Promise<ClientResourcePerfectClient | null> {
  const result = await apiRequest<unknown>('/clients/perfect/new', {
    method: 'POST',
    body: perfectClient,
  })

  return normalizeResourceItem<ClientResourcePerfectClient>(result)
}

export async function updateClientResourcePerfectClient(
  perfectClient: ClientResourcePerfectClient,
): Promise<ClientResourcePerfectClient | null> {
  const result = await apiRequest<unknown>('/clients/perfect/update', {
    method: 'POST',
    body: perfectClient,
  })

  return normalizeResourceItem<ClientResourcePerfectClient>(result)
}

export async function deleteClientResourcePerfectClient(netId: string): Promise<ClientResourcePerfectClient | null> {
  const result = await apiRequest<unknown>('/clients/perfect/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourcePerfectClient>(result)
}

export async function getClientResourceTransporterTypes(): Promise<ClientResourceTransporterType[]> {
  return getResourceList<ClientResourceTransporterType>('/transporters/types/all')
}

export async function getClientResourceVatRates(): Promise<ClientResourceVatRate[]> {
  return getResourceList<ClientResourceVatRate>('/vat/rates/all/get')
}

export async function getClientResourceTransporters(typeNetId: string): Promise<ClientResourceTransporter[]> {
  const result = await apiRequest<unknown>('/transporters/all/type', {
    query: {
      netId: typeNetId,
    },
  })

  return normalizeResourceList<ClientResourceTransporter>(result)
}

export async function createClientResourceTransporter(
  transporter: FormData,
): Promise<ClientResourceTransporter | null> {
  const result = await apiRequest<unknown>('/transporters/new', {
    method: 'POST',
    body: transporter,
  })

  return normalizeResourceItem<ClientResourceTransporter>(result)
}

export async function updateClientResourceTransporter(
  transporter: FormData,
): Promise<ClientResourceTransporter | null> {
  const result = await apiRequest<unknown>('/transporters/update', {
    method: 'POST',
    body: transporter,
  })

  return normalizeResourceItem<ClientResourceTransporter>(result)
}

export async function deleteClientResourceTransporter(netId: string): Promise<ClientResourceTransporter | null> {
  const result = await apiRequest<unknown>('/transporters/delete', {
    query: {
      netId,
    },
  })

  return normalizeResourceItem<ClientResourceTransporter>(result)
}

async function getResourceList<T>(path: string): Promise<T[]> {
  const result = await apiRequest<unknown>(path)

  return normalizeResourceList<T>(result)
}

function normalizeResourceList<T>(result: unknown): T[] {
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

function normalizeResourceItem<T>(result: unknown): T | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as T
}
