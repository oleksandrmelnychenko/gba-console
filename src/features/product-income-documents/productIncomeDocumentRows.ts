import { translate } from '../../shared/i18n/translate'
import { getActiveProductIncomeItems } from './productIncomeDocumentItems'
import type { NamedEntity, ProductIncomeDocument, ProductIncomeItem } from './types'

export type DocumentRow = {
  amount?: number
  client?: string
  comment?: string
  currency?: string
  document: ProductIncomeDocument
  docState?: string
  invDate?: string
  invNumber?: string
  organization?: string
  qty?: number
  specificationDate?: string
  type?: string
}

export function getOverviewKind(
  document: ProductIncomeDocument,
): 'actReconciliation' | 'capitalization' | 'saleReturn' | 'document' {
  const items = getActiveProductIncomeItems(document)

  if (items.some((item) => item.ProductCapitalizationItem?.ProductCapitalization)) {
    return 'capitalization'
  }

  if (items.some((item) => item.SaleReturnItem?.SaleReturn)) {
    return 'saleReturn'
  }

  if (items.some((item) => item.ActReconciliationItem)) {
    return 'actReconciliation'
  }

  return 'document'
}

export function getIncomeItemProduct(item: ProductIncomeItem): NamedEntity | null | undefined {
  return item.PackingListPackageOrderItem?.SupplyInvoiceOrderItem?.Product
    || item.SaleReturnItem?.OrderItem?.Product
    || item.ActReconciliationItem?.Product
    || item.Product
}

export function getItemProductCode(item: ProductIncomeItem): string | undefined {
  const product = getIncomeItemProduct(item)

  return product?.VendorCode || product?.Code
}

export function getItemProductName(item: ProductIncomeItem): string | undefined {
  const product = getIncomeItemProduct(item)

  return product?.NameUA || product?.Name
}

export function mapDocumentRow(document: ProductIncomeDocument): DocumentRow {
  const items = getActiveProductIncomeItems(document)
  const amount = getDocumentAmount(document)
  const documentIsActive = !document.Deleted
  const baseRow = {
    amount,
    comment: document.Comment,
    currency: document.Currency?.Code || document.Currency?.Name,
    document,
  }
  const saleReturnItem = items.find((item) => item.SaleReturnItem)?.SaleReturnItem

  if (saleReturnItem?.SaleReturn) {
    return {
      ...baseRow,
      client: getEntityName(saleReturnItem.SaleReturn.Client),
      comment: saleReturnItem.Comment || document.Comment,
      docState: getDocumentState(documentIsActive && !items.some((item) => item.SaleReturnItem?.SaleReturn?.IsCanceled)),
      invDate: saleReturnItem.SaleReturn.FromDate,
      invNumber: saleReturnItem.SaleReturn.Number,
      organization: getEntityName(saleReturnItem.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement?.Organization),
      qty: document.TotalQty,
      specificationDate: saleReturnItem.SaleReturn.FromDate,
      type: translate('Повернення продажу'),
    }
  }

  const packingItem = items.find((item) => item.PackingListPackageOrderItem)?.PackingListPackageOrderItem
  const packingInvoice = packingItem?.PackingList?.SupplyInvoice

  if (packingInvoice) {
    return {
      ...baseRow,
      amount: packingInvoice.SupplyOrder?.Client?.IsNotResident ? document.TotalNetPrice : document.TotalNetWithVat || 0,
      client: getEntityName(packingInvoice.SupplyOrder?.Client),
      comment: packingInvoice.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: packingInvoice.DateFrom,
      invNumber: packingInvoice.Number,
      organization: getEntityName(packingInvoice.SupplyOrder?.Organization),
      qty: sumItems(items, (item) => item.PackingListPackageOrderItem?.Qty),
      specificationDate: packingInvoice.DateCustomDeclaration || packingInvoice.Created,
      type: translate('Інвойс від постачальника'),
    }
  }

  const ukraineItem = items.find((item) => item.SupplyOrderUkraineItem)?.SupplyOrderUkraineItem
  const ukraineOrder = ukraineItem?.SupplyOrderUkraine

  if (ukraineOrder) {
    return {
      ...baseRow,
      client: getEntityName(ukraineOrder.Supplier),
      comment: ukraineOrder.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: ukraineOrder.FromDate,
      invNumber: ukraineOrder.InvNumber,
      organization: getEntityName(ukraineOrder.Organization),
      qty: sumItems(items, (item) => item.Qty),
      specificationDate: ukraineOrder.InvDate,
      type: translate('Прихідний інвойс в Україну'),
    }
  }

  const reconciliationItem = items.find((item) => item.ActReconciliationItem)?.ActReconciliationItem

  if (reconciliationItem) {
    const reconciliation = reconciliationItem.ActReconciliation
    const sourceOrder = reconciliation?.SupplyOrderUkraine
    const sourceInvoice = reconciliation?.SupplyInvoice

    return {
      ...baseRow,
      client: sourceOrder ? getEntityName(sourceOrder.Supplier) : getEntityName(sourceInvoice?.SupplyOrder?.Client),
      comment: reconciliationItem.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: sourceOrder?.FromDate || reconciliation?.FromDate || document.FromDate,
      invNumber: sourceOrder?.InvNumber || reconciliation?.InvNumber || document.Number,
      organization: sourceOrder
        ? getEntityName(sourceOrder.Organization)
        : getEntityName(sourceInvoice?.SupplyOrder?.Organization || document.Storage?.Organization),
      qty: sumItems(items, (item) => item.Qty),
      specificationDate: sourceOrder?.InvDate || reconciliation?.InvDate || document.FromDate,
      type: sourceOrder
        ? translate('Прихідний інвойс в Україну')
        : sourceInvoice
          ? translate('Інвойс від постачальника')
          : translate('Акт звірки'),
    }
  }

  const capitalizationItem = items.find((item) => item.ProductCapitalizationItem)?.ProductCapitalizationItem
  const capitalization = capitalizationItem?.ProductCapitalization

  if (capitalization) {
    return {
      ...baseRow,
      client: '',
      comment: capitalization.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: capitalization.FromDate,
      invNumber: capitalization.Number,
      organization: getEntityName(capitalization.Organization),
      qty: sumItems(items, (item) => item.Qty),
      specificationDate: capitalization.FromDate,
      type: translate('Оприбуткування товару'),
    }
  }

  return {
    ...baseRow,
    docState: getDocumentState(documentIsActive),
    qty: document.TotalQty,
    type: translate('Документ приходу'),
  }
}

function getDocumentAmount(document: ProductIncomeDocument): number | undefined {
  if (isFiniteNumber(document.TotalNetPrice) && document.TotalNetPrice !== 0) {
    return document.TotalNetPrice
  }

  if (isFiniteNumber(document.TotalNetWithVat)) {
    return document.TotalNetWithVat
  }

  return undefined
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.NameUA || entity?.Name || entity?.LastName || entity?.Number || entity?.VendorCode
}

function getDocumentState(isActive: boolean): string {
  return isActive ? translate('Проведено') : translate('Видалено')
}

function sumItems(items: ProductIncomeItem[], getValue: (item: ProductIncomeItem) => number | undefined): number {
  return items.reduce((total, item) => total + readFiniteNumber(getValue(item)), 0)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readFiniteNumber(value: unknown): number {
  return isFiniteNumber(value) ? value : 0
}
