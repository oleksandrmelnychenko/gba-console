import type { Agreement, Client, ClientAgreement, ClientInDebt } from '../../../clients/types'
import { getClientFolderChildren, isClientFolder } from '../../../clients/clientFolder'

export type WizardClientCarouselState = {
  dataBottom: Client[]
  dataTop: Client[]
  selected: Client | null
  showDetails: boolean
}

export type WizardAgreementDebtPresentation = {
  availableAdvance: number
  creditLimit: number | null
  debtAgeDays: number
  isOverdue: boolean
  outstandingDebt: number
  overdueDays: number
}

export const WIZARD_CLIENT_CAROUSEL_INITIAL: WizardClientCarouselState = {
  dataBottom: [],
  dataTop: [],
  selected: null,
  showDetails: false,
}

export function buildWizardClientStacks(
  client: Client,
): { bottom: Client[]; top: Client[] } {
  return isClientFolder(client)
    ? { bottom: getClientFolderChildren(client), top: [] }
    : { bottom: [], top: [] }
}

export function isWizardSaleClientSelectable(client: Client): boolean {
  return !isClientFolder(client)
}

export function getWizardAgreementKey(agreement: ClientAgreement | null | undefined): string {
  return agreement ? String(agreement.NetUid || agreement.Id || '') : ''
}

export function getWizardAgreementOverdueDebtTotal(agreement: Agreement | undefined): number {
  if (!agreement) {
    return 0
  }

  const overdueLimitDays = agreement.NumberDaysDebt ?? 0
  const total = (agreement.ClientInDebts ?? [])
    .filter((item) => getWizardClientDebtDays(item) - overdueLimitDays > 0)
    .reduce((sum, item) => sum + getWizardClientDebtTotal(item), 0)

  return Math.round(total * 100) / 100
}

export function getWizardAgreementDebtPresentation(
  clientAgreement: ClientAgreement,
): WizardAgreementDebtPresentation {
  const agreement = clientAgreement.Agreement
  const availableAdvance = normalizeNonNegativeNumber(clientAgreement.CurrentAmount)
  const outstandingDebt = roundAgreementAmount(
    (agreement?.ClientInDebts ?? []).reduce(
      (sum, item) => sum + Math.max(getWizardClientDebtTotal(item), 0),
      0,
    ),
  )
  const debtAgeDays = getWizardAgreementDebtAgeDays(agreement)
  const overdueDays = getWizardAgreementOverdueDays(agreement)
  const configuredLimit = normalizeNonNegativeNumber(agreement?.AmountDebt)
  const creditLimit =
    agreement?.IsControlAmountDebt === true && configuredLimit > 0
      ? configuredLimit
      : null

  return {
    availableAdvance,
    creditLimit,
    debtAgeDays,
    isOverdue: agreement?.IsOverdue ?? overdueDays > 0,
    outstandingDebt,
    overdueDays,
  }
}

export function getWizardAgreementDebtAgeDays(agreement: Agreement | undefined): number {
  if (isFiniteNumber(agreement?.DebtAgeDays)) {
    return normalizeNonNegativeNumber(agreement.DebtAgeDays)
  }

  return getWizardAgreementMaxDaysOwed(agreement)
}

export function getWizardAgreementOverdueDays(agreement: Agreement | undefined): number {
  if (isFiniteNumber(agreement?.OverdueDays)) {
    return normalizeNonNegativeNumber(agreement.OverdueDays)
  }

  const allowedDays = normalizeNonNegativeNumber(agreement?.NumberDaysDebt)

  return (agreement?.ClientInDebts ?? []).reduce(
    (max, item) => Math.max(max, getWizardClientDebtDays(item) - allowedDays, 0),
    0,
  )
}

export function getWizardAgreementMaxDaysOwed(agreement: Agreement | undefined): number {
  return (agreement?.ClientInDebts ?? []).reduce((max, item) => Math.max(max, getWizardClientDebtDays(item)), 0)
}

export function getWizardClientDebtTotal(debt: ClientInDebt): number {
  const value = debt.Debt?.Total

  return isFiniteNumber(value) ? value : 0
}

export function getWizardClientDebtDays(debt: ClientInDebt): number {
  const value = debt.Debt?.Days

  return isFiniteNumber(value) ? normalizeNonNegativeNumber(value) : 0
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeNonNegativeNumber(value: number | null | undefined): number {
  return isFiniteNumber(value) ? Math.max(value, 0) : 0
}

function roundAgreementAmount(value: number): number {
  return Math.round(value * 100) / 100
}
