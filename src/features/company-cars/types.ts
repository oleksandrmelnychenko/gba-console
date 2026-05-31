export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type Organization = NamedEntity

export type UserProfile = NamedEntity & {
  Email?: string
  PhoneNumber?: string
}

export const FuelConsumptionMode = {
  InCity: 0,
  Mixed: 2,
  OutsideCity: 1,
} as const

export type FuelConsumptionMode = (typeof FuelConsumptionMode)[keyof typeof FuelConsumptionMode]

export type CompanyCar = EntityFields & {
  CarBrand?: string
  CompanyCarFuelings?: unknown[]
  CompanyCarRoadLists?: CompanyCarRoadList[]
  CreatedBy?: UserProfile | null
  FuelAmount?: number
  InCityConsumption?: number
  InitialMileage?: number
  IsSelected?: boolean
  LicensePlate?: string
  Mileage?: number
  MixedModeConsumption?: number
  Organization?: Organization | null
  OutsideCityConsumption?: number
  TankCapacity?: number
  UpdatedBy?: UserProfile | null
}

export type CompanyCarPayload = CompanyCar

export type OutcomePaymentOrder = EntityFields & {
  AdvanceNumber?: string
  CustomNumber?: string
  IsSelected?: boolean
  Number?: string
}

export type CompanyCarRoadListDriver = EntityFields & {
  CompanyCarRoadList?: CompanyCarRoadList | null
  User?: UserProfile | null
}

export type CompanyCarRoadList = EntityFields & {
  Comment?: string
  CompanyCar?: CompanyCar | null
  CompanyCarRoadListDrivers?: CompanyCarRoadListDriver[]
  CreatedBy?: UserProfile | null
  FuelAmount?: number
  InCityKilometers?: number
  Mileage?: number
  MixedModeKilometers?: number
  OutcomePaymentOrder?: OutcomePaymentOrder | null
  OutsideCityKilometers?: number
  Responsible?: UserProfile | null
  TotalKilometers?: number
  UpdatedBy?: UserProfile | null
}

export type CompanyCarRoadListPayload = CompanyCarRoadList

export type CompanyCarRoadListFilter = {
  companyCarNetId: string
  from: string
  to: string
}
