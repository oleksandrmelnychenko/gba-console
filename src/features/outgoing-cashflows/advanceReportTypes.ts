import type {
  ConsumablesOrder,
  ConsumablesOrderItem,
  NamedEntity,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
} from './types'

export const PaymentRegisterTypeValue = {
  Bank: 2,
  Card: 1,
  Cash: 0,
} as const

export type PaymentRegisterTypeValue = (typeof PaymentRegisterTypeValue)[keyof typeof PaymentRegisterTypeValue]

export type CompanyCar = NamedEntity & {
  LicensePlate?: string
}

export type CompanyCarFueling = {
  CompanyCar?: CompanyCar | null
  ConsumableProductOrganization?: NamedEntity | null
  FuelAmount?: number
  Id?: number
  PaymentCostMovementOperation?: {
    PaymentCostMovement?: {
      OperationName?: string
    } | null
  } | null
  PricePerLiter?: number
  TotalPrice?: number
  TotalPriceWithVat?: number
  VatAmount?: number
  VatPercent?: number
}

export type AdvanceReportConsumablesOrderItem = ConsumablesOrderItem & {
  ConsumableProductCategory?: NamedEntity | null
  VAT?: number
  VatPercent?: number
}

export type AdvanceReportConsumablesOrder = Omit<ConsumablesOrder, 'ConsumablesOrderItems'> & {
  ConsumablesOrderItems?: AdvanceReportConsumablesOrderItem[]
  IsPayed?: boolean
  OrganizationNumber?: string
  SupplyOrganizationAgreement?: {
    Name?: string
    Organization?: NamedEntity | null
  } | null
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
  category: string
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

export type { ConsumablesOrderItem }
