import { apiRequest } from '../../../shared/api/apiClient'
import type { AccountingBank } from '../types'

export async function getAccountingBanks(): Promise<AccountingBank[]> {
  const result = await apiRequest<unknown>('/bank/all')

  return normalizeAccountingBanks(result)
}

export async function saveAccountingBank(bank: AccountingBank): Promise<AccountingBank[]> {
  const result = await apiRequest<unknown>('/bank/update', {
    method: 'POST',
    body: bank,
  })

  return normalizeAccountingBanks(result)
}

function normalizeAccountingBanks(result: unknown): AccountingBank[] {
  if (Array.isArray(result)) {
    return result.filter(isAccountingBank)
  }

  if (result && typeof result === 'object' && 'Items' in result) {
    const items = (result as { Items?: unknown }).Items

    return Array.isArray(items) ? items.filter(isAccountingBank) : []
  }

  return []
}

function isAccountingBank(value: unknown): value is AccountingBank {
  return Boolean(value && typeof value === 'object')
}
