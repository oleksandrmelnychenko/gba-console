import type { AuthUser } from '../../shared/auth/types'
import type { IncompleteSale, RetailCartItem, RetailClient } from '../clients/onlineShopTypes'

export type IncompleteSalesOnlineShopStatus = 0 | 1 | 2

export type IncompleteSalesResponsibleUser = AuthUser & {
  Name?: string
}

export type IncompleteSalesOnlineShopItem = Omit<
  IncompleteSale,
  'MisplacedSaleStatus' | 'OrderItems' | 'RetailClient' | 'User'
> & {
  Created?: Date | string
  Id?: number
  MisplacedSaleStatus?: IncompleteSalesOnlineShopStatus | number | string | null
  NetUid?: string
  OrderItems?: RetailCartItem[]
  RetailClient?: RetailClient
  User?: IncompleteSalesResponsibleUser | null
  UserId?: number | string
}

export type IncompleteSalesOnlineShopFilter = {
  from?: string
  isAccepted?: boolean
  number?: string
  to?: string
}
