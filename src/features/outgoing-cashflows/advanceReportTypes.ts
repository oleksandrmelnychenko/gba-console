import type {
  NamedEntity,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
} from './types'
import type {
  ConsumableProduct,
  ConsumableProductCategory,
  ConsumablesOrder,
  ConsumablesOrderDocument,
  ConsumablesOrderItem,
  ConsumablesStorage,
  PaymentCostMovement,
  PaymentCostMovementOperation,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../consumable-orders/types'

export const PaymentRegisterTypeValue = {
  Bank: 2,
  Card: 1,
  Cash: 0,
} as const

export type PaymentRegisterTypeValue = (typeof PaymentRegisterTypeValue)[keyof typeof PaymentRegisterTypeValue]

export type CompanyCar = NamedEntity & {
  CarBrand?: string
  LicensePlate?: string
}

export type CompanyCarFueling = {
  CompanyCar?: CompanyCar | null
  ConsumableProductOrganization?: SupplyOrganization | null
  Deleted?: boolean
  FuelAmount?: number
  Id?: number
  NetUid?: string
  PaymentCostMovementOperation?: PaymentCostMovementOperation | null
  PricePerLiter?: number
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  TotalPrice?: number
  TotalPriceWithVat?: number
  VatAmount?: number
  VatPercent?: number
}

export type AdvanceReportConsumablesOrderItem = ConsumablesOrderItem & {
  ConsumableProductCategory?: ConsumableProductCategory | null
  VAT?: number
  VatPercent?: number
}

export type AdvanceReportConsumablesOrder = Omit<ConsumablesOrder, 'ConsumablesOrderItems'> & {
  ConsumablesOrderItems?: AdvanceReportConsumablesOrderItem[]
  IsPayed?: boolean
  OrganizationNumber?: string
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
}

export type AdvanceReportOutcomePaymentOrderConsumablesOrder = Omit<
  OutcomePaymentOrderConsumablesOrder,
  'ConsumablesOrder'
> & {
  ConsumablesOrder?: AdvanceReportConsumablesOrder | null
}

export type AdvanceReportOrder = Omit<OutcomePaymentOrder, 'OutcomePaymentOrderConsumablesOrders'> & {
  CompanyCarFuelings?: CompanyCarFueling[]
  OutcomePaymentOrderConsumablesOrders?: AdvanceReportOutcomePaymentOrderConsumablesOrder[]
}

export type AdvanceReportConsumableRow = {
  agreementName: string
  amount?: number
  canRemove?: boolean
  category: string
  documentUrls: string[]
  id: string
  name: string
  organization: string
  organizationFromNumber: string
  organizationName: string
  pricePerUnit?: number
  quantity?: number
  storageName: string
  totalAmount?: number
  vatAmount?: number
  vatPercent?: number
  vendorCode: string
}

export type AdvanceReportFuelRow = {
  canRemove?: boolean
  companyCar: string
  fuelAmount?: number
  id: string
  paymentCostMovement: string
  pricePerLiter?: number
  serviceOrganization: string
  totalAmountWithoutVat?: number
  totalPrice?: number
  vatAmount?: number
  vatPercent?: number
}

export type {
  ConsumableProduct,
  ConsumableProductCategory,
  ConsumablesOrderDocument,
  ConsumablesOrderItem,
  ConsumablesStorage,
  PaymentCostMovement,
  PaymentCostMovementOperation,
  SupplyOrganization,
  SupplyOrganizationAgreement,
}
