export type AuthPermission = {
  ControlId?: string
  Name?: string
  Description?: string
  DashboardNodeId?: string
}

export const UserRoleType = {
  SalesAnalytic: 0,
  PurchaseAnalytic: 1,
  Logistic: 2,
  Administrator: 3,
  Accountant: 4,
  HeadPurchaseAnalytic: 5,
  HeadSalesAnalytic: 6,
  FinanceDirector: 7,
  TopManager: 8,
  PolishLogistic: 9,
  HeadPolishLogistic: 10,
  ClientUa: 11,
  GBA: 12,
  Driver: 13,
} as const

export type UserRoleType = (typeof UserRoleType)[keyof typeof UserRoleType]

export type AuthUserRole = {
  Name?: string
  UserRoleType?: UserRoleType
  Permissions?: AuthPermission[]
}

export type AuthUser = {
  Id?: number
  NetUid?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
  FullName?: string
  Email?: string
  PhoneNumber?: string
  Region?: string
  UserRole?: AuthUserRole
}

export type AuthSession = {
  userNetUid?: string
  csrfToken?: string
  user?: AuthUser
}

export type TokenPayload = Record<string, unknown> & {
  exp?: number
  nbf?: number
  role?: string | string[]
  NetId?: string
  netId?: string
  sub?: string
}
