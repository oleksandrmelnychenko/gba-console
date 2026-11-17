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
  Weight: number | null
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
