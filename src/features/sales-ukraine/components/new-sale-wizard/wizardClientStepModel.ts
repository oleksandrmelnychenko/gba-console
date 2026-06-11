import type { Agreement, Client, ClientAgreement, ClientInDebt } from '../../../clients/types'

export type WizardClientCarouselState = {
  dataBottom: Client[]
  dataTop: Client[]
  selected: Client | null
  showDetails: boolean
}

export const WIZARD_CLIENT_CAROUSEL_INITIAL: WizardClientCarouselState = {
  dataBottom: [],
  dataTop: [],
  selected: null,
  showDetails: false,
}

export function buildWizardClientStacks(
  client: Client,
  { includeRootClients = true }: { includeRootClients?: boolean } = {},
): { bottom: Client[]; top: Client[] } {
  const subClients = Array.isArray(client.SubClients) ? client.SubClients : []
  const rootClients = includeRootClients && Array.isArray(client.RootClients) ? client.RootClients : []
  const top: Client[] = []
  const bottom: Client[] = []

  rootClients.forEach((item) => {
    if (item?.RootClient) {
      top.push(item.RootClient)
    }
  })

  subClients.forEach((item) => {
    const subClient = item?.SubClient

    if (!subClient) {
      return
    }

    if (subClient.IsTradePoint) {
      top.push(subClient)
    } else if (subClient.IsSubClient) {
      bottom.push(subClient)
    }
  })

  return { bottom, top }
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

export function getWizardAgreementMaxDaysOwed(agreement: Agreement | undefined): number {
  return (agreement?.ClientInDebts ?? []).reduce((max, item) => Math.max(max, getWizardClientDebtDays(item)), 0)
}

export function getWizardClientDebtTotal(debt: ClientInDebt): number {
  const value = (debt.Debt as { Total?: number } | undefined)?.Total

  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function getWizardClientDebtDays(debt: ClientInDebt): number {
  const value = (debt.Debt as { Days?: number } | undefined)?.Days

  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
