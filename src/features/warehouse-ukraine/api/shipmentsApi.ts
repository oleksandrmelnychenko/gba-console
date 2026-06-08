import { apiRequest } from '../../../shared/api/apiClient'
import type { WarehouseUkraineExportDocument } from '../types'
import type {
  ShipmentDeliveryRecipient,
  ShipmentDeliveryRecipientAddress,
  ShipmentList,
  ShipmentListItem,
  ShipmentSale,
  ShipmentTransporter,
  ShipmentTransporterType,
} from '../shipmentTypes'
import { normalizeExportDocument } from './salesApi'

export async function getShipmentTransporterTypes(): Promise<ShipmentTransporterType[]> {
  const result = await apiRequest<unknown>('/transporters/types/all')

  return normalizeArray<ShipmentTransporterType>(result)
}

export async function getShipmentTransportersByType(typeNetId: string): Promise<ShipmentTransporter[]> {
  const result = await apiRequest<unknown>('/transporters/all/type', {
    query: {
      netId: typeNetId,
    },
  })

  return normalizeArray<ShipmentTransporter>(result)
}

export type AutoShipmentListParams = {
  transporterNetId: string
  from: string
  to: string
}

export type ShipmentListSearchParams = {
  transporterNetId?: string
  from: string
  to: string
  limit?: number
}

export async function getManualShipmentSales(params: AutoShipmentListParams): Promise<ShipmentSale[]> {
  const result = await apiRequest<unknown>('/sales/all/transporter/filtered', {
    query: {
      netId: params.transporterNetId,
      from: params.from,
      to: params.to,
    },
  })

  return normalizeArray<ShipmentSale>(result)
}

export async function getAutoShipmentList(params: AutoShipmentListParams): Promise<ShipmentList> {
  const result = await apiRequest<unknown>('/sales/shipments/update/filtered/auto', {
    query: {
      netId: params.transporterNetId,
      from: params.from,
      to: params.to,
    },
  })

  return normalizeShipmentList(result)
}

export async function getAllShipmentLists(params: ShipmentListSearchParams): Promise<ShipmentList[]> {
  const result = await apiRequest<unknown>('/sales/shipments/all/filtered', {
    query: {
      ...(params.transporterNetId ? { netId: params.transporterNetId } : {}),
      from: params.from,
      to: params.to,
      limit: params.limit ?? 20,
    },
  })

  return normalizeArray<ShipmentList>(result).map(normalizeShipmentList)
}

export async function getShipmentListById(shipmentListNetId: string): Promise<ShipmentList> {
  const result = await apiRequest<unknown>('/sales/shipments/get', {
    query: {
      netId: shipmentListNetId,
    },
  })

  return normalizeShipmentList(result)
}

export async function updateShipmentList(shipmentList: ShipmentList): Promise<void> {
  await apiRequest<unknown>('/sales/shipments/update', {
    method: 'POST',
    body: shipmentList,
  })
}

export async function getShipmentCreatePageDocument(
  params: AutoShipmentListParams,
): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/shipments/document/create/export', {
    query: {
      netId: params.transporterNetId,
      from: params.from,
      to: params.to,
    },
  })

  return normalizeExportDocument(result)
}

export async function getShipmentDocument(shipmentListNetId: string): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/shipments/document/export', {
    query: {
      netId: shipmentListNetId,
    },
  })

  return normalizeExportDocument(result)
}

export async function getShipmentListForSaleDocument(saleNetId: string): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/shipment/list/print/documents', {
    query: {
      netId: saleNetId,
    },
  })

  return normalizeExportDocument(result)
}

export async function updateSaleComment(saleNetId: string, comment: string): Promise<void> {
  await apiRequest<unknown>('/sales/update/comment', {
    method: 'POST',
    query: {
      netId: saleNetId,
    },
    body: { NetUid: saleNetId, Comment: comment },
  })
}

export async function updateDeliveryRecipient(
  saleNetId: string,
  recipient: ShipmentDeliveryRecipient,
): Promise<void> {
  await apiRequest<unknown>('/sales/update/recipient', {
    method: 'POST',
    query: {
      netId: saleNetId,
    },
    body: recipient,
  })
}

export async function updateDeliveryRecipientAddress(
  saleNetId: string,
  address: ShipmentDeliveryRecipientAddress,
): Promise<void> {
  await apiRequest<unknown>('/sales/update/recipient/address', {
    method: 'POST',
    query: {
      netId: saleNetId,
    },
    body: address,
  })
}

function normalizeArray<TItem>(result: unknown): TItem[] {
  if (Array.isArray(result)) {
    return result as TItem[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray((result as { Items: unknown }).Items)) {
    return (result as { Items: TItem[] }).Items
  }

  return []
}

function normalizeShipmentList(result: unknown): ShipmentList {
  if (!result || typeof result !== 'object') {
    return { ShipmentListItems: [] }
  }

  const payload = result as Partial<ShipmentList>
  const items = Array.isArray(payload.ShipmentListItems) ? (payload.ShipmentListItems as ShipmentListItem[]) : []

  return {
    ...payload,
    ShipmentListItems: items,
  }
}
