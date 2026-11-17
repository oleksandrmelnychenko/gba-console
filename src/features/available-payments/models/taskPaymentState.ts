import { TaskStatusValue, type SupplyPaymentTask } from '../types'

export type TaskPaymentState = 'paid' | 'partial' | 'unpaid' | 'closed-without-payment'

/**
 * Payment state of a task as the settlements (Рух коштів) see it.
 *
 * The server closes the placeholder task of a consumable order created
 * without a payment plan as Done although nothing was paid; only the linked
 * outgoing payments say whether the invoice was paid.
 */
export function getTaskPaymentState(task: SupplyPaymentTask): TaskPaymentState {
  const hasPayments = (task.OutcomePaymentOrderSupplyPaymentTasks?.length || 0) > 0

  if (task.TaskStatus === TaskStatusValue.Done) {
    return hasPayments || task.IsPayed ? 'paid' : 'closed-without-payment'
  }

  if (task.TaskStatus === TaskStatusValue.PartiallyDone) {
    return 'partial'
  }

  return 'unpaid'
}
