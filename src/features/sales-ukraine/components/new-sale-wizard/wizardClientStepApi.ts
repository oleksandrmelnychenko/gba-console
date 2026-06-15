import { apiRequest } from '../../../../shared/api/apiClient'
import type { Client, ClientAgreement, ClientInDebt } from '../../../clients/types'
import { getSaleClientAgreements } from '../../api/salesUkraineApi'
import type { SalesUkraineSale } from '../../types'

export const WIZARD_SALE_REGISTER_STATUS_ALL = 6
export const WIZARD_SALE_REGISTER_STATUS_NEW = 0
export const WIZARD_SALE_REGISTER_STATUS_PACKAGING = 1

export type WizardSaleRegisterStatistic = {
  Sale?: SalesUkraineSale | null
  LifeCycleLine?: unknown[]
  SaleExchangeRates?: unknown[]
  SaleReturn?: Record<string, unknown> | null
}

export type WizardSaleRegisterItem = {
  SaleStatistic?: WizardSaleRegisterStatistic | null
  SaleReturn?: Record<string, unknown> | null
  TotalRowsQty?: number
}

export type WizardSaleRegisterQuery = {
  clientNetId: string
  from: string
  to: string
  type: number
  value: string
}

export async function searchWizardClients(value: string, limit = 20, offset = 0): Promise<Client[]> {
  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: JSON.stringify({
        Table: 'Client',
        Offset: offset,
        Limit: limit,
        BooleanFilter: '',
        TypeRoleFilter: '',
        SortDescriptors: [],
        Filter: JSON.stringify({
          Value: value.trim(),
          FilterItem: {
            Name: '',
            SQL: 'RegionCode.Value/Client.FullName',
            Description: '',
            FilterOperationItem: {
              Name: '',
              SQL: 'Contains',
            },
          },
        }),
      }),
    },
  })

  return Array.isArray(result) ? (result as Client[]) : []
}

export async function getWizardSalesRegister(query: WizardSaleRegisterQuery): Promise<WizardSaleRegisterItem[]> {
  const result = await apiRequest<unknown>('/sales/all/register', {
    query: {
      clientNetId: query.clientNetId,
      from: query.from,
      limit: 20,
      offset: 0,
      to: query.to,
      type: query.type,
      value: query.value,
    },
  })

  return Array.isArray(result) ? (result as WizardSaleRegisterItem[]) : []
}

export function mapWizardSaleRegisterItems(items: WizardSaleRegisterItem[]): WizardSaleRegisterStatistic[] {
  return items.reduce<WizardSaleRegisterStatistic[]>((acc, item) => {
    if (item.SaleStatistic) {
      acc.push(item.SaleStatistic)
    } else if (item.SaleReturn) {
      acc.push({ LifeCycleLine: [], Sale: null, SaleExchangeRates: [], SaleReturn: item.SaleReturn })
    }

    return acc
  }, [])
}

export async function getWizardClientGroupedDebts(clientNetId: string): Promise<ClientInDebt[]> {
  const result = await apiRequest<unknown>('/clients/get/debt/grouped', {
    query: { netId: clientNetId },
  })

  return Array.isArray(result) ? (result as ClientInDebt[]) : []
}

export async function getWizardClientAgreements(clientNetId: string): Promise<ClientAgreement[]> {
  return (await getSaleClientAgreements(clientNetId)) as unknown as ClientAgreement[]
}
