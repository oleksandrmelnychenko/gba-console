import type { Product } from './types'

export const NATIVE_PRODUCT_CLASSIFICATION_REQUIRED = 'Оберіть тип позиції: товар або послуга'

function isSourceOwnedProduct(product: Product): boolean {
  const raw = product as Record<string, unknown>
  return ['SourceAmgId', 'SourceFenixId', 'SourceAmgID', 'SourceFenixID', 'SourceAmgCode', 'SourceFenixCode']
    .some((key) => raw[key] != null)
}

// Presence in the detail DTO is the capability signal. Missing means an older server.
export function canEditNativeProductClassification(product: Product): boolean {
  return Object.hasOwn(product, 'NativeIsService')
    && (product.NativeIsService === null || typeof product.NativeIsService === 'boolean')
    && !isSourceOwnedProduct(product)
}

export function hasNativeProductClassificationChoice(product: Product): boolean {
  return isSourceOwnedProduct(product) || typeof product.NativeIsService === 'boolean'
}
