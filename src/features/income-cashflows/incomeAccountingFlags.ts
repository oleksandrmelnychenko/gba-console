export type AccountingFlags = { isAccounting: boolean; isManagementAccounting: boolean }

/** The agreement's own accounting type, when the server sent both flags. */
export function getAgreementAccountingFlags(
  agreement: { IsAccounting?: unknown; IsManagementAccounting?: unknown } | null | undefined,
): AccountingFlags | null {
  if (typeof agreement?.IsAccounting !== 'boolean' || typeof agreement?.IsManagementAccounting !== 'boolean') {
    return null
  }

  return { isAccounting: agreement.IsAccounting, isManagementAccounting: agreement.IsManagementAccounting }
}

/** True when the order is about to be posted in another accounting than its agreement (outgoing#27). */
export function differsFromAgreementAccounting(form: AccountingFlags, agreement: AccountingFlags | null): boolean {
  return Boolean(agreement)
    && (form.isAccounting !== agreement!.isAccounting || form.isManagementAccounting !== agreement!.isManagementAccounting)
}
