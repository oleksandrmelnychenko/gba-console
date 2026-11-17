import type { Product } from '../types'

export type ProductEditForm = {
  NativeIsService: boolean | null
  Description: string
  IsForSale: boolean
  IsForZeroSale: boolean
  Notes: string
  OrderStandard: string
  PackingStandard: string
  Size: string
  SynonymsUA: string
  Top: string
  Volume: string
  /** As typed; parsed and checked by parseProductWeight on save. */
  Weight: number | string | null
}

/** One description and one notes field: in the uk console the localized (UA) value is the one shown and saved. */
export function createProductEditForm(product: Product): ProductEditForm {
  return {
    NativeIsService: typeof product.NativeIsService === 'boolean' ? product.NativeIsService : null,
    Description: product.DescriptionUA || product.Description || '',
    IsForSale: Boolean(product.IsForSale),
    IsForZeroSale: Boolean(product.IsForZeroSale),
    Notes: product.NotesUA || product.Notes || '',
    OrderStandard: product.OrderStandard || '',
    PackingStandard: product.PackingStandard || '',
    Size: product.Size || '',
    SynonymsUA: product.SynonymsUA || '',
    Top: product.Top || '',
    Volume: product.Volume || '',
    Weight: typeof product.Weight === 'number' ? product.Weight : null,
  }
}

export const PRODUCT_WEIGHT_MAX = 100_000

/**
 * «Вага» as typed: empty → null; otherwise a finite number 0..100 000 (comma accepted).
 * Anything else is reported instead of being silently turned into 0 or dropped.
 */
export function parseProductWeight(
  value: number | string | null,
  t: (value: string) => string,
): { error: string | null; value: number | null } {
  if (value === null || (typeof value === 'string' && !value.trim())) {
    return { error: null, value: null }
  }

  const weight = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'))

  if (!Number.isFinite(weight)) {
    return { error: t('Вага має бути числом, наприклад 7,5'), value: null }
  }
  if (weight < 0) {
    return { error: t('Вага не може бути відʼємною'), value: null }
  }
  if (weight > PRODUCT_WEIGHT_MAX) {
    return { error: t('Вага не може перевищувати 100 000'), value: null }
  }

  return { error: null, value: weight }
}
