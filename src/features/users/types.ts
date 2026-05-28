export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type UserRoleTranslation = EntityFields & {
  CultureCode?: string
  Name?: string
  UserRoleId?: number
}

export type UserPermission = EntityFields & {
  ControlId?: string
  DashboardNodeId?: number | string
  Description?: string
  ImageUrl?: string
  Name?: string
}

export type DashboardNode = EntityFields & {
  Children?: DashboardNode[]
  Module?: string
  Permissions?: UserPermission[]
  Route?: string
}

export type DashboardNodeModule = EntityFields & {
  Children?: DashboardNode[]
  Description?: string
  Module?: string
}

export type UserRole = EntityFields & {
  Dashboard?: string
  DashboardNodeModules?: DashboardNodeModule[]
  DashboardNodes?: DashboardNode[]
  Name?: string
  Permissions?: UserPermission[]
  UserRoleTranslations?: UserRoleTranslation[]
  UserRoleType?: number
}

export type UserProfile = EntityFields & {
  Abbreviation?: string
  Clients?: unknown[]
  ConfirmPassword?: string
  Email?: string
  FirstName?: string
  FullName?: string
  IsActive?: boolean
  LastName?: string
  MiddleName?: string
  Name?: string
  Password?: string
  PhoneNumber?: string
  Region?: string
  UserRole?: UserRole
  UserRoleId?: number
}

export type IdentityError = {
  Code?: string
  Description?: string
}

export type IdentityResponse = {
  Errors?: IdentityError[]
  Succeeded?: boolean
}
