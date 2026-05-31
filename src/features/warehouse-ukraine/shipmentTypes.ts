import type {
  EntityFields,
  Sale,
  WarehouseUkraineTransporter,
  WarehouseUkraineUser,
} from './types'

export type ShipmentTransporterType = EntityFields & {
  Name?: string
}

export type ShipmentTransporter = EntityFields & {
  Name?: string
}

export type ShipmentDeliveryRecipient = EntityFields & {
  FullName?: string
  MobilePhone?: string
  SaleNetId?: string
}

export type ShipmentDeliveryRecipientAddress = EntityFields & {
  City?: string
  Department?: string
  Value?: string
  SaleNetId?: string
}

export type ShipmentWarehousesShipment = EntityFields & {
  FullName?: string
  MobilePhone?: string
  City?: string
  Department?: string
  Comment?: string
  TTN?: string
  TtnPDFPath?: string
  IsCashOnDelivery?: boolean
  CashOnDeliveryAmount?: number
  Transporter?: WarehouseUkraineTransporter | null
  User?: WarehouseUkraineUser | null
}

export type ShipmentCustomersOwnTtn = {
  Number?: string
  TtnPDFPath?: string | null
}

export type ShipmentSale = Sale & {
  DeliveryRecipient?: ShipmentDeliveryRecipient | null
  DeliveryRecipientAddress?: ShipmentDeliveryRecipientAddress | null
  WarehousesShipment?: ShipmentWarehousesShipment | null
  CustomersOwnTtn?: ShipmentCustomersOwnTtn | null
  IsCashOnDelivery?: boolean
  CashOnDeliveryAmount?: number
}

export type ShipmentListItem = EntityFields & {
  QtyPlaces?: number
  IsDirty?: boolean
  IsChangeTransporter?: boolean
  Sale: ShipmentSale
}

export type ShipmentList = EntityFields & {
  Number?: string
  Comment?: string
  FromDate?: Date | string
  IsSent?: boolean
  Transporter?: ShipmentTransporter | null
  Responsible?: WarehouseUkraineUser | null
  ShipmentListItems: ShipmentListItem[]
}
