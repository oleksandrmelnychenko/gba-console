export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type TaxFreeCarrierCar = EntityFields & {
  Number?: string
  Volume?: number
}

export type TaxFreeCarrierPassport = EntityFields & {
  City?: string
  HouseNumber?: string
  PassportCloseDate?: Date | string
  PassportIssuedBy?: string
  PassportIssuedDate?: Date | string
  PassportNumber?: string
  PassportSeria?: string
  StathamId?: number
  Street?: string
  TempId?: string
}

export type TaxFreeCarrier = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  StathamCars?: TaxFreeCarrierCar[]
  StathamPassports?: TaxFreeCarrierPassport[]
}

export type TaxFreeCarrierPayload = TaxFreeCarrier

export type TaxFreeCarrierExportColumn = {
  ColumnName: string
  Number: number
  TableName: string
  Translate: string
}

export type TaxFreeCarrierExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
