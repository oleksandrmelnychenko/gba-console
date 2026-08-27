import { apiRequest } from '../../../shared/api/apiClient'
import {
  getSalesMutationOperationHeaders,
  SalesMutationPreflightValidationError,
  withSalesMutationOperationNetUid,
  type SalesMutationOperationOptions,
} from '../../sales-ukraine/salesMutationOperation'
import { requirePersistedGuid } from '../../sales-ukraine/salesPayloadGuards'
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
  const result = await apiRequest<unknown>('/transporters/types/warehouse-ukraine/shipments')

  return normalizeArray<ShipmentTransporterType>(result)
}

export async function getShipmentTransportersByType(typeNetId: string): Promise<ShipmentTransporter[]> {
  const result = await apiRequest<unknown>('/transporters/warehouse-ukraine/shipments/by-type', {
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
  offset?: number
}

export async function getManualShipmentSales(params: AutoShipmentListParams): Promise<ShipmentSale[]> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/shipments/sales', {
    query: {
      netId: params.transporterNetId,
      from: params.from,
      to: params.to,
    },
  })

  return normalizeArray<ShipmentSale>(result)
}

export async function getAutoShipmentList(
  params: AutoShipmentListParams,
  operation: SalesMutationOperationOptions,
): Promise<ShipmentList> {
  const requiredOperation = requireShipmentMutationOperation(operation)
  const normalizedParams = validateShipmentMutationWindow(params)
  const result = await apiRequest<unknown>('/sales/shipments/warehouse-ukraine/create/auto', {
    headers: getSalesMutationOperationHeaders(requiredOperation.operationId),
    query: {
      netId: normalizedParams.transporterNetId,
      from: normalizedParams.from,
      to: normalizedParams.to,
    },
    ...(requiredOperation.signal ? { signal: requiredOperation.signal } : {}),
  })

  return normalizeShipmentList(result)
}

export async function getAllShipmentLists(params: ShipmentListSearchParams): Promise<ShipmentList[]> {
  const result = await apiRequest<unknown>('/sales/shipments/warehouse-ukraine/registry', {
    query: {
      ...(params.transporterNetId ? { netId: params.transporterNetId } : {}),
      from: params.from,
      to: params.to,
      limit: params.limit ?? 20,
      ...(typeof params.offset === 'number' ? { offset: params.offset } : {}),
    },
  })

  return normalizeArray<ShipmentList>(result).map(normalizeShipmentList)
}

export async function getShipmentListById(shipmentListNetId: string): Promise<ShipmentList> {
  const result = await apiRequest<unknown>('/sales/shipments/warehouse-ukraine/details', {
    query: {
      netId: shipmentListNetId,
    },
  })

  return normalizeShipmentList(result)
}

export async function updateShipmentList(
  shipmentList: ShipmentList,
  operation: SalesMutationOperationOptions,
  window?: { from: string; to: string },
): Promise<ShipmentList> {
  return persistShipmentList(
    '/sales/shipments/warehouse-ukraine/edit',
    shipmentList,
    operation,
    window,
  )
}

export async function carryOutShipmentList(
  shipmentList: ShipmentList,
  operation: SalesMutationOperationOptions,
  window?: { from: string; to: string },
): Promise<ShipmentList> {
  return persistShipmentList(
    '/sales/shipments/warehouse-ukraine/carry-out',
    shipmentList,
    operation,
    window,
  )
}

async function persistShipmentList(
  path: string,
  shipmentList: ShipmentList,
  operation: SalesMutationOperationOptions,
  window?: { from: string; to: string },
): Promise<ShipmentList> {
  const requiredOperation = requireShipmentMutationOperation(operation)
  validatePersistedShipmentList(shipmentList)
  const normalizedWindow = window
    ? validateShipmentDateWindow(window.from, window.to)
    : undefined

  const result = await apiRequest<unknown>(path, {
    method: 'POST',
    body: shipmentList,
    headers: getSalesMutationOperationHeaders(requiredOperation.operationId),
    // Pass the active date window so the server only reconciles (soft-deletes) items the client
    // could actually see — items outside the window are never touched.
    query: normalizedWindow,
    ...(requiredOperation.signal ? { signal: requiredOperation.signal } : {}),
  })

  return normalizeShipmentList(result)
}

export async function getShipmentCreatePageDocument(
  params: AutoShipmentListParams,
  operation: SalesMutationOperationOptions,
): Promise<WarehouseUkraineExportDocument> {
  const requiredOperation = requireShipmentMutationOperation(operation)
  const normalizedParams = validateShipmentMutationWindow(params)
  const result = await apiRequest<unknown>('/sales/shipments/warehouse-ukraine/print/create', {
    headers: getSalesMutationOperationHeaders(requiredOperation.operationId),
    query: {
      netId: normalizedParams.transporterNetId,
      from: normalizedParams.from,
      to: normalizedParams.to,
    },
    ...(requiredOperation.signal ? { signal: requiredOperation.signal } : {}),
  })

  return normalizeExportDocument(result)
}

export async function getShipmentDocument(shipmentListNetId: string): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/shipments/warehouse-ukraine/print', {
    query: {
      netId: shipmentListNetId,
    },
  })

  return normalizeExportDocument(result)
}

export async function getShipmentListForSaleDocument(saleNetId: string): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/invoices/shipment-document', {
    query: {
      netId: saleNetId,
    },
  })

  return normalizeExportDocument(result)
}

export type ShipmentSaleCommentMutation = {
  Comment: string
  NetUid: string
}

export async function updateSaleComment(
  saleNetId: string,
  comment: string,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  await apiRequest<unknown>('/sales/warehouse-ukraine/shipments/edit-comment', {
    method: 'POST',
    headers: getSalesMutationOperationHeaders(operation.operationId),
    query: {
      netId: saleNetId,
    },
    body: withSalesMutationOperationNetUid({ NetUid: saleNetId, Comment: comment }, operation.operationId),
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

export async function updateDeliveryRecipient(
  saleNetId: string,
  recipient: ShipmentDeliveryRecipient,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  await apiRequest<unknown>('/sales/warehouse-ukraine/shipments/edit-recipient', {
    method: 'POST',
    headers: getSalesMutationOperationHeaders(operation.operationId),
    query: {
      netId: saleNetId,
    },
    body: withSalesMutationOperationNetUid(recipient, operation.operationId),
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

export async function updateDeliveryRecipientAddress(
  saleNetId: string,
  address: ShipmentDeliveryRecipientAddress,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  await apiRequest<unknown>('/sales/warehouse-ukraine/shipments/edit-address', {
    method: 'POST',
    headers: getSalesMutationOperationHeaders(operation.operationId),
    query: {
      netId: saleNetId,
    },
    body: withSalesMutationOperationNetUid(address, operation.operationId),
    ...(operation.signal ? { signal: operation.signal } : {}),
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

function validateShipmentMutationWindow(params: AutoShipmentListParams): AutoShipmentListParams {
  return {
    transporterNetId: requirePersistedGuid(
      params.transporterNetId,
      'Оберіть збереженого перевізника',
    ),
    ...validateShipmentDateWindow(params.from, params.to),
  }
}

function requireShipmentMutationOperation(
  operation: SalesMutationOperationOptions | undefined,
): SalesMutationOperationOptions {
  const operationId = requirePersistedGuid(
    operation?.operationId,
    'Операція відвантаження не має коректного ідентифікатора',
  )

  return {
    operationId,
    ...(operation?.signal ? { signal: operation.signal } : {}),
  }
}

function validateShipmentDateWindow(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from)
  const toDate = new Date(to)

  if (!from.trim() || !to.trim() || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new SalesMutationPreflightValidationError('Вкажіть коректний період відвантаження')
  }

  if (fromDate > toDate) {
    throw new SalesMutationPreflightValidationError(
      'Дата початку не може бути пізнішою за дату завершення',
    )
  }

  const spanDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000

  if (spanDays > 366) {
    throw new SalesMutationPreflightValidationError(
      'Період відвантаження не може перевищувати 366 днів',
    )
  }

  return { from, to }
}

function validatePersistedShipmentList(shipmentList: ShipmentList): void {
  if ((shipmentList.Id ?? 0) <= 0) {
    throw new SalesMutationPreflightValidationError(
      'Відомість відвантаження не має збереженого ідентифікатора',
    )
  }

  requirePersistedGuid(
    shipmentList.NetUid,
    'Відомість відвантаження не має збереженого ідентифікатора',
  )

  if (!shipmentList.ShipmentListItems.length) {
    throw new SalesMutationPreflightValidationError(
      'Відомість відвантаження не містить продажів',
    )
  }

  const saleNetIds = new Set<string>()

  for (const item of shipmentList.ShipmentListItems) {
    const qtyPlaces = item.QtyPlaces ?? 0

    if (!Number.isFinite(qtyPlaces) || qtyPlaces < 0) {
      throw new SalesMutationPreflightValidationError(
        'Кількість місць має бути скінченним невід’ємним числом',
      )
    }

    const saleNetId = requirePersistedGuid(
      item.Sale?.NetUid,
      'Позиція відвантаження не має збереженого продажу',
    )

    if ((item.Sale?.Id ?? 0) <= 0) {
      throw new SalesMutationPreflightValidationError(
        'Позиція відвантаження не має збереженого продажу',
      )
    }

    if (saleNetIds.has(saleNetId)) {
      throw new SalesMutationPreflightValidationError(
        'Один продаж не можна додати до відомості двічі',
      )
    }

    saleNetIds.add(saleNetId)
  }
}
