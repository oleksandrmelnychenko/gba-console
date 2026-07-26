import { formatLocalDate } from '../../../shared/date/dateTime'
import { calculateConsumableOrderItemTotals } from '../consumableOrderCalculations'
import type {
  ConsumablesOrder,
  ConsumablesOrderItem,
  ConsumablesStorage,
  SupplyOrganization,
  SupplyOrganizationAgreement,
  User,
} from '../types'

export type ConsumableOrderFormState = {
  comment: string
  invoiceDate: string
  invoiceNumber: string
  invoiceTime: string
  paymentTaskComment: string
  paymentTaskEnabled: boolean
  paymentTaskPayToDate: string
  responsibleUserValue: string
  selectedAgreementValue: string
  selectedStorageValue: string
  selectedSupplierValue: string
  storageSearch: string
  supplierSearch: string
}

export const EXISTING_ORDER_MUTATION_DISCLOSURE =
  'Для наявної накладної постачальник, договір, склад, платіжний протокол і позиції недоступні для зміни. Можна оновити реквізити, коментар і документи.'

export function getConsumableOrderMutationLocks({
  isEditMode,
  isPaid,
}: {
  isEditMode: boolean
  isPaid: boolean
}) {
  return {
    isEconomicMutationLocked: isEditMode || isPaid,
    isTaskMutationLocked: isEditMode,
  }
}

export function normalizeOrderForForm(order: ConsumablesOrder): ConsumablesOrder {
  return {
    ...order,
    ConsumablesOrderDocuments: Array.isArray(order.ConsumablesOrderDocuments) ? order.ConsumablesOrderDocuments : [],
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems.map((item) =>
          item.Id && item.Id > 0 ? item : normalizeCalculatedItem(item))
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
      : [],
  }
}

export function buildOrderPayload({
  form,
  order,
  selectedAgreement,
  selectedResponsibleUser,
  selectedStorage,
  selectedSupplier,
}: {
  form: ConsumableOrderFormState
  order: ConsumablesOrder
  selectedAgreement: SupplyOrganizationAgreement | null
  selectedResponsibleUser: User | null
  selectedStorage: ConsumablesStorage | null
  selectedSupplier: SupplyOrganization | null
}): ConsumablesOrder {
  const payload: ConsumablesOrder = {
    ...order,
    Comment: form.comment.trim(),
    ConsumableProductOrganization: selectedSupplier,
    ConsumablesStorage: selectedStorage,
    OrganizationFromDate: toIsoDateTime(form.invoiceDate, form.invoiceTime),
    OrganizationNumber: form.invoiceNumber.trim(),
    SupplyOrganizationAgreement: selectedAgreement,
    TotalAmount: order.TotalAmount,
    TotalAmountWithoutVAT: order.TotalAmountWithoutVAT,
  }

  payload.ConsumablesOrderItems = (order.ConsumablesOrderItems || []).map((item) => ({
    ...(item.Id && item.Id > 0 ? item : normalizeCalculatedItem(item)),
    ConsumableProductOrganization: selectedSupplier,
    Id: item.Id === -1 ? 0 : item.Id,
    SupplyOrganizationAgreement: selectedAgreement,
  }))

  if (order.SupplyPaymentTask?.Id) {
    payload.SupplyPaymentTask = order.SupplyPaymentTask
    payload.SupplyPaymentTaskId = order.SupplyPaymentTaskId
  } else if (form.paymentTaskEnabled) {
    payload.SupplyPaymentTask = {
      ...(order.SupplyPaymentTask || {}),
      Comment: form.paymentTaskComment.trim(),
      PayToDate: toIsoDateTime(form.paymentTaskPayToDate, '00:00'),
      User: selectedResponsibleUser,
    }
  } else {
    payload.SupplyPaymentTask = undefined
  }

  return payload
}

export function validateOrderPayload(
  order: ConsumablesOrder,
  t: (value: string) => string,
): string | null {
  if (!order.ConsumableProductOrganization) {
    return t('Оберіть постачальника послуг')
  }
  if (!order.SupplyOrganizationAgreement?.Organization) {
    return t('Оберіть договір з організацією')
  }
  if (!order.ConsumablesStorage) {
    return t('Оберіть склад')
  }
  if (!(order.ConsumablesOrderItems || []).some((item) => !item.Deleted)) {
    return t('Додайте хоча б одну позицію')
  }

  for (const item of order.ConsumablesOrderItems || []) {
    if (item.Deleted) {
      continue
    }

    const itemError = validateItem(item, t)
    if (itemError) {
      return itemError
    }
  }

  if (order.SupplyPaymentTask && !order.SupplyPaymentTask.User) {
    return t('Оберіть відповідального за платіжний протокол')
  }
  return null
}

export function validateItem(
  item: ConsumablesOrderItem,
  t: (value: string) => string,
): string | null {
  if (!item.ConsumableProduct) {
    return t('Оберіть товар або послугу')
  }
  if (!item.ConsumableProductCategory && !item.ConsumableProduct.ConsumableProductCategory) {
    return t('Оберіть товар з категорією')
  }
  if (!item.PaymentCostMovementOperation?.PaymentCostMovement) {
    return t('Оберіть статтю витрат')
  }
  if (!item.Qty || item.Qty <= 0) {
    return t('Вкажіть кількість')
  }
  if (!item.TotalPriceWithVAT || item.TotalPriceWithVAT <= 0) {
    return t('Вкажіть суму')
  }
  return null
}

export function normalizeCalculatedItem(item: ConsumablesOrderItem): ConsumablesOrderItem {
  return {
    ...item,
    ...calculateConsumableOrderItemTotals(item),
  }
}

function toIsoDateTime(dateValue: string, timeValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T${timeValue || '00:00'}`)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
