import type {
  ActProvidingService,
  BillOfLadingService,
  DeliveryExpense,
  MergedService,
  NamedEntity,
} from './types'

const TYPE_BILL_OF_LADING_CONTAINER = 0

export type ActProvidingServiceDisplayModel = {
  accountingMarker: string
  agreement?: string
  amount?: number
  amountVat?: number
  comment?: string
  currency?: string
  date?: string
  invDate?: string
  invNumber?: string
  managementMarker: string
  name?: string
  netId?: string
  number?: string
  organization?: string
  percentVat?: number
  protocolNetId?: string
  responsible?: string
  serviceOrganization?: string
  sourceKind: 'billOfLading' | 'deliveryExpense' | 'mergedService' | 'unknown'
  supplyOrderUkraineNetUid?: string
  totalWithVat?: number
}

export function toActProvidingServiceDisplayModel(
  act: ActProvidingService,
  t: (key: string) => string,
): ActProvidingServiceDisplayModel {
  const source = getActSource(act)
  const baseModel: ActProvidingServiceDisplayModel = {
    accountingMarker: act.IsAccounting ? '+' : '',
    comment: act.Comment,
    date: act.FromDate,
    managementMarker: act.IsAccounting ? '' : '+',
    netId: act.NetUid,
    number: act.Number,
    sourceKind: source.kind,
  }

  if (source.kind === 'deliveryExpense') {
    return {
      ...baseModel,
      agreement: source.value.SupplyOrganizationAgreement?.Name,
      amount: source.value.AccountingGrossAmount,
      amountVat: source.value.VatAmount,
      currency: getCurrencyCode(source.value.SupplyOrganizationAgreement?.Currency),
      invDate: source.value.FromDate,
      invNumber: source.value.InvoiceNumber,
      name: source.value.ConsumableProduct?.Name,
      number: source.value.InvoiceNumber || baseModel.number,
      organization: getEntityName(source.value.SupplyOrderUkraine?.Organization),
      percentVat: source.value.AccountingVatPercent,
      responsible: getEntityName(source.value.User),
      serviceOrganization: getEntityName(source.value.SupplyOrganization),
      supplyOrderUkraineNetUid: source.value.SupplyOrderUkraine?.NetUid,
      totalWithVat: source.value.AccountingGrossAmount,
    }
  }

  if (source.kind === 'mergedService') {
    return {
      ...baseModel,
      agreement: source.value.SupplyOrganizationAgreement?.Name,
      amount: source.isAccounting ? source.value.AccountingNetPrice : source.value.NetPrice,
      amountVat: source.isAccounting ? source.value.AccountingVat : source.value.Vat,
      currency: getCurrencyCode(source.value.SupplyOrganizationAgreement?.Currency),
      invDate: source.value.FromDate,
      invNumber: source.value.Number,
      name: source.value.ConsumableProduct?.Name,
      number: source.value.ServiceNumber || baseModel.number,
      organization: getEntityName(source.value.SupplyOrganizationAgreement?.Organization),
      percentVat: source.isAccounting ? source.value.AccountingVatPercent : source.value.VatPercent,
      protocolNetId: source.value.DeliveryProductProtocol?.NetUid,
      responsible: getEntityName(source.value.User || act.User),
      serviceOrganization: getEntityName(source.value.SupplyOrganization),
      supplyOrderUkraineNetUid: source.value.SupplyOrderUkraine?.NetUid,
      totalWithVat: source.isAccounting ? source.value.AccountingGrossPrice : source.value.GrossPrice,
    }
  }

  if (source.kind === 'billOfLading') {
    const amount = source.isAccounting ? source.value.AccountingNetPrice : source.value.NetPrice

    return {
      ...baseModel,
      agreement: source.value.SupplyOrganizationAgreement?.Name,
      amount,
      currency: getCurrencyCode(source.value.SupplyOrganizationAgreement?.Currency),
      invDate: source.value.FromDate,
      invNumber: source.value.Number,
      name: source.value.TypeBillOfLadingService === TYPE_BILL_OF_LADING_CONTAINER ? t('Контейнер') : t('Авто'),
      number: source.value.ServiceNumber || baseModel.number,
      organization: getEntityName(source.value.SupplyOrganizationAgreement?.Organization),
      protocolNetId: source.value.DeliveryProductProtocol?.NetUid,
      responsible: getEntityName(source.value.User || act.User),
      serviceOrganization: getEntityName(source.value.SupplyOrganization),
      totalWithVat: amount,
    }
  }

  return {
    ...baseModel,
    amount: act.Price,
    responsible: getEntityName(act.User),
  }
}

function getActSource(
  act: ActProvidingService,
):
  | { kind: 'billOfLading'; isAccounting: boolean; value: BillOfLadingService }
  | { kind: 'deliveryExpense'; value: DeliveryExpense }
  | { kind: 'mergedService'; isAccounting: boolean; value: MergedService }
  | { kind: 'unknown' } {
  if (act.BillOfLadingService) {
    return { kind: 'billOfLading', isAccounting: false, value: act.BillOfLadingService }
  }

  if (act.AccountingBillOfLadingService) {
    return { kind: 'billOfLading', isAccounting: true, value: act.AccountingBillOfLadingService }
  }

  if (act.MergedService) {
    return { kind: 'mergedService', isAccounting: false, value: act.MergedService }
  }

  if (act.AccountingMergedService) {
    return { kind: 'mergedService', isAccounting: true, value: act.AccountingMergedService }
  }

  if (act.DeliveryExpense) {
    return { kind: 'deliveryExpense', value: act.DeliveryExpense }
  }

  return { kind: 'unknown' }
}

function getCurrencyCode(currency?: NamedEntity | null): string | undefined {
  return currency?.Code || currency?.Name
}

export function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName
    || entity?.NameUA
    || entity?.Name
    || [entity?.LastName, entity?.FirstName, entity?.MiddleName].filter(Boolean).join(' ')
    || entity?.Number
    || entity?.Code
}
