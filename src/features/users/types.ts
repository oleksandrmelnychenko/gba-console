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

export type UserRole = EntityFields & {
  Dashboard?: string
  Name?: string
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
