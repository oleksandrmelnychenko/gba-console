import { apiRequest } from '../../../shared/api/apiClient'
import type {
  BasketSale,
  BasketSupplySalesFilters,
  CartItemsParseConfiguration,
  CartItemsTotals,
  PreviewCartItem,
  Sad,
  SupplyOrderUkraineCartItem,
  TaxFreePackList,
} from '../types'

export async function getUkraineCartItems(): Promise<SupplyOrderUkraineCartItem[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/all')

  return normalizeArray<SupplyOrderUkraineCartItem>(result).map(ensureCartItem)
}

export async function updateUkraineCartItem(
  cartItem: SupplyOrderUkraineCartItem,
): Promise<SupplyOrderUkraineCartItem | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/update', {
    method: 'POST',
    body: cartItem,
  })

  return normalizeItem<SupplyOrderUkraineCartItem>(result, ensureCartItem)
}

export async function uploadUkraineCartItemsFromFile(
  file: File,
  parseConfiguration: CartItemsParseConfiguration,
): Promise<SupplyOrderUkraineCartItem[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/file/upload', {
    method: 'POST',
    body: createCartItemsFormData(file, parseConfiguration),
  })

  return normalizeArray<SupplyOrderUkraineCartItem>(result).map(ensureCartItem)
}

export async function uploadPreviewUkraineCartItemsFromFile(
  file: File,
  parseConfiguration: CartItemsParseConfiguration,
): Promise<PreviewCartItem[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/file/select/preview', {
    method: 'POST',
    body: createCartItemsFormData(file, parseConfiguration),
  })

  return normalizeArray<PreviewCartItem>(result)
}

export async function calculateTotalsByCartItems(
  cartItems: SupplyOrderUkraineCartItem[],
): Promise<CartItemsTotals> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/totals/calculate', {
    method: 'POST',
    body: cartItems,
  })

  return normalizeTotals(result)
}

export async function calculateTotalsBySales(sales: BasketSale[]): Promise<CartItemsTotals> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/sale/totals/calculate', {
    method: 'POST',
    body: sales,
  })

  return normalizeTotals(result)
}

export async function getNotSentTaxFreePackLists(): Promise<TaxFreePackList[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/all/notsent')

  return normalizeArray<TaxFreePackList>(result)
}

export async function getNotSentSaleTaxFreePackLists(): Promise<TaxFreePackList[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/all/notsent/sale')

  return normalizeArray<TaxFreePackList>(result)
}

export async function addOrUpdateTaxFreePackList(packList: TaxFreePackList): Promise<TaxFreePackList | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/update', {
    method: 'POST',
    body: packList,
  })

  return normalizeItem<TaxFreePackList>(result)
}

export async function addOrUpdateSaleTaxFreePackList(packList: TaxFreePackList): Promise<TaxFreePackList | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/update/sale', {
    method: 'POST',
    body: packList,
  })

  return normalizeItem<TaxFreePackList>(result)
}

export async function getNotSentSads(): Promise<Sad[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/all/notsent')

  return normalizeArray<Sad>(result)
}

export async function getNotSentSaleSads(): Promise<Sad[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/all/notsent/sale')

  return normalizeArray<Sad>(result)
}

export async function addOrUpdateSad(sad: Sad): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/update', {
    method: 'POST',
    body: sad,
  })

  return normalizeItem<Sad>(result)
}

export async function addOrUpdateSaleSad(sad: Sad): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/update/sale', {
    method: 'POST',
    body: sad,
  })

  return normalizeItem<Sad>(result)
}

export async function getSalesForMovingToUkraine(filters: BasketSupplySalesFilters): Promise<BasketSale[]> {
  const result = await apiRequest<unknown>('/sales/all/filtered/pl-uk', {
    query: {
      from: filters.from,
      to: filters.to,
      value: filters.value.trim(),
    },
  })

  return normalizeArray<BasketSale>(result).map(ensureSale)
}

export async function getCartItemRecommendations(): Promise<SupplyOrderUkraineCartItem[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/recommendations')

  return normalizeArray<SupplyOrderUkraineCartItem>(result).map(ensureCartItem)
}

function createCartItemsFormData(file: File, parseConfiguration: CartItemsParseConfiguration) {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('parseConfiguration', JSON.stringify(parseConfiguration))

  return formData
}

function normalizeArray<TItem>(result: unknown): TItem[] {
  const parsedResult = parseJsonPayload(result)

  if (Array.isArray(parsedResult)) {
    return parsedResult as TItem[]
  }

  if (!parsedResult || typeof parsedResult !== 'object') {
    return []
  }

  const payload = parsedResult as Record<string, unknown>
  const items = payload.Body ?? payload.Items ?? payload.Data ?? payload.Collection ?? payload.items ?? payload.data

  if (Array.isArray(items)) {
    return items as TItem[]
  }

  return []
}

function normalizeItem<TItem>(result: unknown, ensure?: (item: TItem) => TItem): TItem | null {
  const parsedResult = parseJsonPayload(result)

  if (!parsedResult || typeof parsedResult !== 'object') {
    return null
  }

  const payload = parsedResult as Record<string, unknown>
  const item = (payload.Body && typeof payload.Body === 'object' ? payload.Body : parsedResult) as TItem

  return ensure ? ensure(item) : item
}

function normalizeTotals(result: unknown): CartItemsTotals {
  const parsedResult = parseJsonPayload(result)
  const payload =
    parsedResult && typeof parsedResult === 'object' && 'Body' in parsedResult
      ? (parsedResult as { Body?: unknown }).Body
      : parsedResult

  if (!payload || typeof payload !== 'object') {
    return emptyTotals()
  }

  const totals = payload as Partial<CartItemsTotals>

  return {
    TotalEuroAmount: toNumber(totals.TotalEuroAmount),
    TotalPlnAmount: toNumber(totals.TotalPlnAmount),
    TotalQty: toNumber(totals.TotalQty),
    TotalWeight: toNumber(totals.TotalWeight),
  }
}

function ensureCartItem(cartItem: SupplyOrderUkraineCartItem): SupplyOrderUkraineCartItem {
  return {
    ...cartItem,
    AvailableQty: toNumber(cartItem.AvailableQty),
    ChangedQty: cartItem.ChangedQty === undefined ? undefined : toNumber(cartItem.ChangedQty),
    IsDirty: Boolean(cartItem.IsDirty),
    IsError: Boolean(cartItem.IsError),
    IsFromFile: Boolean(cartItem.IsFromFile),
    IsSelected: Boolean(cartItem.IsSelected),
    ReservedQty: toNumber(cartItem.ReservedQty),
    UploadedQty: toNumber(cartItem.UploadedQty),
  }
}

function ensureSale(sale: BasketSale): BasketSale {
  return {
    ...sale,
    IsSelected: Boolean(sale.IsSelected),
    Order: {
      ...sale.Order,
      OrderItems: Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : [],
    },
    TotalAmount: toNumber(sale.TotalAmount),
    TotalAmountLocal: toNumber(sale.TotalAmountLocal),
  }
}

function parseJsonPayload(result: unknown): unknown {
  if (typeof result !== 'string') {
    return result
  }

  const normalized = result.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}

function emptyTotals(): CartItemsTotals {
  return {
    TotalEuroAmount: 0,
    TotalPlnAmount: 0,
    TotalQty: 0,
    TotalWeight: 0,
  }
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value || 0)
}
