import type { ConsumableProduct } from './advanceReportTypes'

type ProductOption = { label: string; value: string }

/**
 * The item editor has two pickers over the same product list: by name and by
 * vendor code. Each picker shows its field text as the selected option, so the
 * text stored for a picked product has to be exactly that picker's option
 * label — otherwise the picker finds no option for it and drops the product.
 */
export function getProductPickerValue(product?: ConsumableProduct | null): string {
  return String(product?.NetUid || product?.Id || '')
}

export function getProductNameLabel(product?: ConsumableProduct | null): string {
  if (!product) {
    return ''
  }

  return [product.VendorCode, product.Name].filter(Boolean).join(' - ') || getProductPickerValue(product)
}

export function getProductArticleLabel(product?: ConsumableProduct | null): string {
  return product?.VendorCode || ''
}

export function toProductNameOptions(
  products: ConsumableProduct[],
  pickedProduct?: ConsumableProduct | null,
): ProductOption[] {
  return toOptions(products, pickedProduct, getProductNameLabel)
}

export function toProductArticleOptions(
  products: ConsumableProduct[],
  pickedProduct?: ConsumableProduct | null,
): ProductOption[] {
  return toOptions(products, pickedProduct, getProductArticleLabel)
}

/** True while the field text is still the text of the picked product. */
export function isPickedProductText(
  product: ConsumableProduct | null | undefined,
  text: string,
  field: 'name' | 'article',
): boolean {
  if (!product) {
    return false
  }

  return text === (field === 'name' ? getProductNameLabel(product) : getProductArticleLabel(product))
}

function toOptions(
  products: ConsumableProduct[],
  pickedProduct: ConsumableProduct | null | undefined,
  getLabel: (product: ConsumableProduct) => string,
): ProductOption[] {
  const pickedValue = getProductPickerValue(pickedProduct)
  // A refreshed search answer may not contain the picked product; it stays
  // in the list so the picker keeps showing it.
  const source =
    pickedProduct && pickedValue && !products.some((product) => getProductPickerValue(product) === pickedValue)
      ? [pickedProduct, ...products]
      : products
  const seen = new Set<string>()

  return source.reduce<ProductOption[]>((options, product) => {
    const value = getProductPickerValue(product)
    const label = getLabel(product)

    if (!value || !label || seen.has(value)) {
      return options
    }

    seen.add(value)
    options.push({ label, value })

    return options
  }, [])
}
