import { apiRequest } from '../../../../shared/api/apiClient'
import type { Client } from '../../../clients/types'

export type WizardClientStructureDebtTotal = {
  TotalEuro?: number
  TotalLocal?: number
  TotalSubClientDebt?: number
}

export async function getWizardHeaderClient(clientNetId: string): Promise<Client | null> {
  const result = await apiRequest<unknown>('/clients/get', {
    query: { netId: clientNetId },
  })

  return result && typeof result === 'object' ? (result as Client) : null
}

export async function getWizardClientStructure(clientNetId: string): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/all/subclients/client', {
    query: { netId: clientNetId },
  })

  return Array.isArray(result) ? (result as Client[]) : []
}

export async function getWizardClientStructureDebtTotal(clientNetId: string): Promise<WizardClientStructureDebtTotal | null> {
  const result = await apiRequest<unknown>('/clients/get/debt/total/structure', {
    query: { netId: clientNetId },
  })

  return result && typeof result === 'object' ? (result as WizardClientStructureDebtTotal) : null
}
