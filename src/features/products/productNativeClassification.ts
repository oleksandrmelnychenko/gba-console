import type { Product } from './types'

// Presence in the detail DTO is the capability signal. Missing means an older server.
export function canEditNativeProductClassification(product: Product): boolean {
  const raw = product as Record<string, unknown>
  return Object.hasOwn(product, 'NativeIsService')
    && (product.NativeIsService === null || typeof product.NativeIsService === 'boolean')
    && ['SourceAmgId', 'SourceFenixId', 'SourceAmgID', 'SourceFenixID', 'SourceAmgCode', 'SourceFenixCode']
      .every((key) => raw[key] == null)
}
