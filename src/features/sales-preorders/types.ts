export type PreOrderClient = {
  FullName?: string | null
  LastName?: string | null
  FirstName?: string | null
  MiddleName?: string | null
  MobileNumber?: string | null
}

export type PreOrderProduct = {
  VendorCode?: string | null
  Name?: string | null
  NameUA?: string | null
}

export type PreOrder = {
  Id?: number
  NetUid: string
  Created?: string | null
  Comment?: string | null
  MobileNumber?: string | null
  Qty?: number | null
  Client?: PreOrderClient | null
  Product?: PreOrderProduct | null
}

export type PreOrdersFilters = {
  limit: number
  offset: number
}
