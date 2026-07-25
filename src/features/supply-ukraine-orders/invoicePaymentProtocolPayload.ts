import type {
  SupplyInvoice,
  SupplyOrderPaymentDeliveryProtocol,
  SupplyPaymentTask,
} from './types'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export function sanitizeInvoicePaymentDeliveryProtocols(
  invoice: SupplyInvoice,
  protocols: SupplyOrderPaymentDeliveryProtocol[] = invoice.PaymentDeliveryProtocols || [],
): SupplyOrderPaymentDeliveryProtocol[] {
  return protocols.map((protocol) =>
    sanitizePaymentDeliveryProtocol(invoice, protocol),
  )
}

function sanitizePaymentDeliveryProtocol(
  invoice: SupplyInvoice,
  protocol: SupplyOrderPaymentDeliveryProtocol,
): SupplyOrderPaymentDeliveryProtocol {
  const key = protocol.SupplyOrderPaymentDeliveryProtocolKey || null
  const task = protocol.SupplyPaymentTask || null
  const user = task?.User || protocol.User || null
  const value = protocol.Value || 0
  const persistedProtocol = hasPersistedId(protocol.Id)
  const base = stripEntityGraph(protocol)

  if (!persistedProtocol) {
    delete base.Id
    delete base.NetUid

    const payload: SupplyOrderPaymentDeliveryProtocol = {
      ...base,
      IsAccounting: Boolean(protocol.IsAccounting),
      SupplyInvoiceId: protocol.SupplyInvoiceId || invoice.Id,
      SupplyOrderPaymentDeliveryProtocolKey: key,
      SupplyOrderPaymentDeliveryProtocolKeyId: protocol.SupplyOrderPaymentDeliveryProtocolKeyId || key?.Id,
      SupplyPaymentTask: task ? sanitizeTrueNewTask(task, protocol, user, value) : null,
      User: protocol.User || user,
      UserId: protocol.UserId || user?.Id,
      Value: value,
    }
    delete payload.SupplyPaymentTaskId

    return payload
  }

  assertPersistedIdentity(protocol, 'invoice payment protocol')

  if (protocol.Deleted) {
    const payload: SupplyOrderPaymentDeliveryProtocol = {
      ...base,
      SupplyPaymentTask: null,
    }
    delete payload.SupplyPaymentTaskId

    return payload
  }

  const taskPayload = task
    ? sanitizePersistedTask(task, protocol, user, value)
    : null
  const scalarTaskId = positiveId(protocol.SupplyPaymentTaskId)

  if (taskPayload && scalarTaskId && scalarTaskId !== taskPayload.Id) {
    throw new Error('Invoice payment protocol task identity is inconsistent')
  }

  return {
    ...base,
    IsAccounting: Boolean(protocol.IsAccounting),
    SupplyInvoiceId: protocol.SupplyInvoiceId || invoice.Id,
    SupplyOrderPaymentDeliveryProtocolKey: key,
    SupplyOrderPaymentDeliveryProtocolKeyId: protocol.SupplyOrderPaymentDeliveryProtocolKeyId || key?.Id,
    SupplyPaymentTask: taskPayload,
    SupplyPaymentTaskId: taskPayload?.Id || scalarTaskId,
    User: protocol.User || user,
    UserId: protocol.UserId || user?.Id,
    Value: value,
  }
}

function sanitizeTrueNewTask(
  task: SupplyPaymentTask,
  protocol: SupplyOrderPaymentDeliveryProtocol,
  user: SupplyPaymentTask['User'],
  value: number,
): SupplyPaymentTask {
  const netUid = typeof task.NetUid === 'string' ? task.NetUid.trim() : ''

  if (hasPersistedId(task.Id) || (netUid && netUid.toLowerCase() !== EMPTY_GUID) || task.Deleted) {
    throw new Error('A new invoice payment protocol requires a true-new payment task')
  }

  const payload = stripEntityGraph(task)
  delete payload.Id
  delete payload.NetUid

  return {
    ...payload,
    GrossPrice: task.GrossPrice ?? value,
    IsAccounting: protocol.IsAccounting ?? task.IsAccounting,
    NetPrice: task.NetPrice ?? value,
    User: user,
    UserId: task.UserId || user?.Id,
  }
}

function sanitizePersistedTask(
  task: SupplyPaymentTask,
  protocol: SupplyOrderPaymentDeliveryProtocol,
  user: SupplyPaymentTask['User'],
  value: number,
): SupplyPaymentTask {
  const identity = assertPersistedIdentity(task, 'invoice payment task')

  return {
    ...stripEntityGraph(task),
    ...identity,
    GrossPrice: task.GrossPrice ?? value,
    IsAccounting: protocol.IsAccounting ?? task.IsAccounting,
    NetPrice: task.NetPrice ?? value,
    User: user,
    UserId: task.UserId || user?.Id,
  }
}

function assertPersistedIdentity(
  entity: { Id?: number; NetUid?: string },
  label: string,
): { Id: number; NetUid: string } {
  const id = positiveId(entity.Id)
  const netUid = typeof entity.NetUid === 'string' ? entity.NetUid.trim() : ''

  if (!id || !GUID_PATTERN.test(netUid) || netUid.toLowerCase() === EMPTY_GUID) {
    throw new Error(`Persisted ${label} requires a valid Id and NetUid`)
  }

  return {
    Id: id,
    NetUid: netUid,
  }
}

function hasPersistedId(value: number | undefined): boolean {
  return Boolean(positiveId(value))
}

function positiveId(value: number | undefined): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined
}

function stripEntityGraph<T extends object>(entity: T): T {
  const result = { ...entity } as Record<string, unknown>

  delete result.SupplyOrder
  delete result.SupplyInvoice
  delete result.PackingList
  delete result.PackingListPackage

  return result as T
}
