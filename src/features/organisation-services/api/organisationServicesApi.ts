import { apiRequest } from '../../../shared/api/apiClient'
import type {
  OrganizationPaymentTasks,
  OrganizationPaymentTasksParams,
  ServiceOrganization,
  ServiceOrganizationTypeValue,
  SupplyPaymentTask,
} from '../types'

export async function searchServiceOrganizations(
  value: string,
  signal?: AbortSignal,
): Promise<ServiceOrganization[]> {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return []
  }

  const result = await apiRequest<unknown>('/supplies/services/search/organizations/all', {
    query: {
      value: normalizedValue,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeServiceOrganizations(result)
}

export async function getOrganizationPaymentTasks(
  params: OrganizationPaymentTasksParams,
  signal?: AbortSignal,
): Promise<OrganizationPaymentTasks> {
  const result = await apiRequest<unknown>('/supplies/services/search/organizations/paymenttasks/all', {
    query: {
      organizationName: params.organizationName,
      serviceTypes: params.serviceTypes,
      from: params.from,
      to: params.to,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeOrganizationPaymentTasks(result)
}

function normalizeServiceOrganizations(result: unknown): ServiceOrganization[] {
  const organizations = readList<ServiceOrganization>(result)

  return organizations
    .map((organization) => ({
      ...organization,
      ServiceOrganizationTypes: normalizeServiceOrganizationTypes(organization.ServiceOrganizationTypes),
    }))
    .filter((organization) => Boolean(organization.Name?.trim()))
}

function normalizeOrganizationPaymentTasks(result: unknown): OrganizationPaymentTasks {
  if (!result || typeof result !== 'object') {
    return createEmptyPaymentTasks()
  }

  const payload = result as Record<string, unknown>
  const tasks = Array.isArray(payload.SupplyPaymentTasks)
    ? (payload.SupplyPaymentTasks as SupplyPaymentTask[])
    : []

  return {
    SupplyPaymentTasks: tasks.map(ensurePaymentTaskLists),
    Total: readNumber(payload.Total),
    TotalByRange: readNumber(payload.TotalByRange),
  }
}

function ensurePaymentTaskLists(task: SupplyPaymentTask): SupplyPaymentTask {
  return {
    ...task,
    BrokerServices: Array.isArray(task.BrokerServices) ? task.BrokerServices : [],
    ContainerServices: Array.isArray(task.ContainerServices) ? task.ContainerServices : [],
    CustomAgencyServices: Array.isArray(task.CustomAgencyServices) ? task.CustomAgencyServices : [],
    InvoiceDocuments: Array.isArray(task.InvoiceDocuments) ? task.InvoiceDocuments : [],
    MergedServices: Array.isArray(task.MergedServices) ? task.MergedServices : [],
    PlaneDeliveryServices: Array.isArray(task.PlaneDeliveryServices) ? task.PlaneDeliveryServices : [],
    PortCustomAgencyServices: Array.isArray(task.PortCustomAgencyServices) ? task.PortCustomAgencyServices : [],
    PortWorkServices: Array.isArray(task.PortWorkServices) ? task.PortWorkServices : [],
    SupplyPaymentTaskDocuments: Array.isArray(task.SupplyPaymentTaskDocuments) ? task.SupplyPaymentTaskDocuments : [],
    TransportationServices: Array.isArray(task.TransportationServices) ? task.TransportationServices : [],
    VehicleDeliveryServices: Array.isArray(task.VehicleDeliveryServices) ? task.VehicleDeliveryServices : [],
    VehicleServices: Array.isArray(task.VehicleServices) ? task.VehicleServices : [],
  }
}

function normalizeServiceOrganizationTypes(types: unknown): ServiceOrganizationTypeValue[] {
  if (!Array.isArray(types)) {
    return []
  }

  const normalizedTypes = types
    .map((type) => Number(type))
    .filter(isServiceOrganizationTypeValue)

  return Array.from(new Set(normalizedTypes))
}

function isServiceOrganizationTypeValue(value: number): value is ServiceOrganizationTypeValue {
  return Number.isInteger(value) && value >= 0 && value <= 9
}

function readList<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as T[]
  }

  return []
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    return Number.isFinite(parsedValue) ? parsedValue : 0
  }

  return 0
}

function createEmptyPaymentTasks(): OrganizationPaymentTasks {
  return {
    SupplyPaymentTasks: [],
    Total: 0,
    TotalByRange: 0,
  }
}
