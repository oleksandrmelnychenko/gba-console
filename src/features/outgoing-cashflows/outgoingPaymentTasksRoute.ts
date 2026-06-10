const AVAILABLE_PAYMENTS_PATH = '/accounting/available-payments'
const OUTCOME_PAYMENT_TASKS_OPERATION_TYPE = '4'
const DEFAULT_PAYMENT_TASK_REGISTER_TYPE = '2'
const VALID_PAYMENT_TASK_REGISTER_TYPES = new Set(['0', '2'])

export function buildAvailablePaymentsPaymentTasksPath(search = '', hash = ''): string {
  const searchParams = new URLSearchParams(stripSearchPrefix(search))
  const registerType = searchParams.get('type')

  if (!registerType || !VALID_PAYMENT_TASK_REGISTER_TYPES.has(registerType)) {
    searchParams.set('type', DEFAULT_PAYMENT_TASK_REGISTER_TYPE)
  }

  searchParams.set('operationType', OUTCOME_PAYMENT_TASKS_OPERATION_TYPE)

  return `${AVAILABLE_PAYMENTS_PATH}?${searchParams.toString()}${normalizeHash(hash)}`
}

function stripSearchPrefix(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search
}

function normalizeHash(hash: string): string {
  if (!hash || hash === '#') {
    return ''
  }

  return hash.startsWith('#') ? hash : `#${hash}`
}
