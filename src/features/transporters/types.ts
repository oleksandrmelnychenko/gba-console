export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type TransporterTypeTranslation = EntityFields & {
  CultureCode?: string
  Name?: string
  TransporterTypeId?: number
}

export type TransporterType = EntityFields & {
  IsSelected?: boolean
  Name?: string
  TransporterTypeTranslations?: TransporterTypeTranslation[]
  Transporters?: Transporter[]
}

export type Transporter = EntityFields & {
  CssClass?: string
  ImageUrl?: string | null
  IsSelected?: boolean
  Name?: string
  Priority?: number
  TransporterType?: TransporterType | null
  TransporterTypeId?: number | null
}
