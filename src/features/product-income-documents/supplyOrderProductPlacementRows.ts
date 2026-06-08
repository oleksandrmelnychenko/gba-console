import type {
  NamedEntity,
  ProductIncomeItem,
  ProductIncomePlacement,
} from './types'

export type SupplyPlacementRow = {
  actualQty?: number
  customsRate?: number
  customsValue?: number
  index: number
  isImported: boolean
  item: ProductIncomeItem
  measureUnit?: string
  orderedQty?: number
  placements: ProductIncomePlacement[]
  productName?: string
  specificationCode?: string
  total?: number
  totalGrossWeight?: number
  totalNetPrice?: number
  totalNetWeight?: number
  unitPrice?: number
  vatAmount?: number
  vatPercent?: number
  vendorCode?: string
}

export function mapSupplyPlacementRows(items: ProductIncomeItem[]): SupplyPlacementRow[] {
  return items.map((item, index) => {
    const packingItem = item.PackingListPackageOrderItem
    const ukraineItem = item.SupplyOrderUkraineItem
    const product = packingItem?.SupplyInvoiceOrderItem?.Product || ukraineItem?.Product || item.Product || null
    const specification = [...(item.ConsignmentItems || []), ...(packingItem?.ConsignmentItems || [])].find(
      (consignmentItem) => consignmentItem.ProductSpecification,
    )?.ProductSpecification || ukraineItem?.ProductSpecification
    const totalNetPrice = roundMoney(packingItem?.TotalNetPrice ?? ukraineItem?.NetPriceLocal)
    const vatAmount = roundMoney(packingItem?.VatAmount ?? ukraineItem?.VatAmountLocal)
    const totalGrossPrice = roundMoney(ukraineItem?.GrossPriceLocal)

    return {
      actualQty: readFiniteNumber(ukraineItem?.PlacedQty ?? item.Qty),
      customsRate: roundMoney(specification?.DutyPercent),
      customsValue: roundMoney(specification?.CustomsValue),
      index: index + 1,
      isImported: Boolean(packingItem?.ProductIsImported || ukraineItem?.ProductIsImported),
      item,
      measureUnit: getEntityName(product?.MeasureUnit),
      orderedQty: readFiniteNumber(packingItem?.Qty ?? ukraineItem?.Qty),
      placements: packingItem?.ProductPlacements || [],
      productName: product?.NameUA || product?.Name,
      specificationCode: specification?.SpecificationCode,
      total: isFiniteNumber(totalGrossPrice)
        ? totalGrossPrice
        : isFiniteNumber(totalNetPrice) || isFiniteNumber(vatAmount)
          ? (readFiniteNumber(totalNetPrice) ?? 0) + (readFiniteNumber(vatAmount) ?? 0)
          : undefined,
      totalGrossWeight: roundWeight(packingItem?.TotalGrossWeight ?? ukraineItem?.TotalGrossWeight),
      totalNetPrice,
      totalNetWeight: roundWeight(packingItem?.TotalNetWeight ?? ukraineItem?.TotalNetWeight),
      unitPrice: roundMoney(packingItem?.UnitPrice ?? ukraineItem?.UnitPriceLocal),
      vatAmount,
      vatPercent: readFiniteNumber(packingItem?.VatPercent ?? ukraineItem?.VatPercent),
      vendorCode: product?.VendorCode || product?.Code,
    }
  })
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.NameUA || entity?.Name || entity?.LastName || entity?.Number || entity?.Code
}

function roundMoney(value?: number): number | undefined {
  return isFiniteNumber(value) ? Math.round(value * 100) / 100 : undefined
}

function roundWeight(value?: number): number | undefined {
  return isFiniteNumber(value) ? Math.round(value * 1000) / 1000 : undefined
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readFiniteNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined
}
