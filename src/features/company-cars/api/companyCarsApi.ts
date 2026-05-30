import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CompanyCar,
  CompanyCarPayload,
  CompanyCarRoadList,
  CompanyCarRoadListFilter,
  CompanyCarRoadListPayload,
  Organization,
  OutcomePaymentOrder,
  UserProfile,
} from '../types'

export async function getCompanyCars(): Promise<CompanyCar[]> {
  const result = await apiRequest<unknown>('/consumables/company/cars/all')

  return normalizeCompanyCars(result)
}

export async function searchCompanyCars(value: string): Promise<CompanyCar[]> {
  const result = await apiRequest<unknown>('/consumables/company/cars/all/search', {
    query: {
      value,
    },
  })

  return normalizeCompanyCars(result)
}

export async function getCompanyCar(netId: string): Promise<CompanyCar | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/get', {
    query: {
      netId,
    },
  })

  return normalizeCompanyCar(result)
}

export async function createCompanyCar(companyCar: CompanyCarPayload): Promise<CompanyCar | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/new', {
    method: 'POST',
    body: companyCar,
  })

  return normalizeCompanyCar(result)
}

export async function updateCompanyCar(companyCar: CompanyCarPayload): Promise<CompanyCar | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/update', {
    method: 'POST',
    body: companyCar,
  })

  return normalizeCompanyCar(result)
}

export async function deleteCompanyCar(netId: string): Promise<void> {
  await apiRequest<unknown>('/consumables/company/cars/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getCompanyCarRoadLists(filter: CompanyCarRoadListFilter): Promise<CompanyCarRoadList[]> {
  const result = await apiRequest<unknown>('/consumables/company/cars/roadlists/all/filtered', {
    query: {
      companyCarNetId: filter.companyCarNetId,
      from: filter.from,
      to: filter.to,
    },
  })

  return normalizeCompanyCarRoadLists(result)
}

export async function createCompanyCarRoadList(roadList: CompanyCarRoadListPayload): Promise<CompanyCarRoadList | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/roadlists/new', {
    method: 'POST',
    body: roadList,
  })

  return normalizeCompanyCarRoadList(result)
}

export async function updateCompanyCarRoadList(roadList: CompanyCarRoadListPayload): Promise<CompanyCarRoadList | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/roadlists/update', {
    method: 'POST',
    body: roadList,
  })

  return normalizeCompanyCarRoadList(result)
}

export async function calculateCompanyCarRoadList(roadList: CompanyCarRoadListPayload): Promise<CompanyCarRoadList | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/roadlists/calculate', {
    method: 'POST',
    body: roadList,
  })

  return normalizeCompanyCarRoadList(result)
}

export async function deleteCompanyCarRoadList(netId: string): Promise<void> {
  await apiRequest<unknown>('/consumables/company/cars/roadlists/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getOutcomeOrdersByCompanyCar(companyCarNetId: string): Promise<OutcomePaymentOrder[]> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/all/companycar', {
    query: {
      netId: companyCarNetId,
    },
  })

  return readArrayPayload(result, ['Items', 'OutcomePaymentOrders', 'Data']) as OutcomePaymentOrder[]
}

export async function getCompanyCarOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

export async function searchCompanyCarUsers(value: string): Promise<UserProfile[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as UserProfile[]
}

function normalizeCompanyCars(result: unknown): CompanyCar[] {
  return readArrayPayload(result, ['Items', 'CompanyCars', 'Data'])
    .map(normalizeCompanyCar)
    .filter((companyCar): companyCar is CompanyCar => Boolean(companyCar))
}

function normalizeCompanyCar(result: unknown): CompanyCar | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const companyCar = result as CompanyCar

  return {
    ...companyCar,
    CompanyCarFuelings: Array.isArray(companyCar.CompanyCarFuelings) ? companyCar.CompanyCarFuelings : [],
    CompanyCarRoadLists: Array.isArray(companyCar.CompanyCarRoadLists) ? companyCar.CompanyCarRoadLists : [],
  }
}

function normalizeCompanyCarRoadLists(result: unknown): CompanyCarRoadList[] {
  return readArrayPayload(result, ['Items', 'CompanyCarRoadLists', 'RoadLists', 'Data'])
    .map(normalizeCompanyCarRoadList)
    .filter((roadList): roadList is CompanyCarRoadList => Boolean(roadList))
}

function normalizeCompanyCarRoadList(result: unknown): CompanyCarRoadList | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const roadList = result as CompanyCarRoadList

  return {
    ...roadList,
    CompanyCarRoadListDrivers: Array.isArray(roadList.CompanyCarRoadListDrivers)
      ? roadList.CompanyCarRoadListDrivers.filter((driver): driver is NonNullable<typeof driver> => Boolean(driver && typeof driver === 'object'))
      : [],
  }
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}
