import type { ProductIncomeDocument, ProductIncomeItem } from './types'

export function getActiveProductIncomeItems(document: ProductIncomeDocument | null | undefined): ProductIncomeItem[] {
  return getActiveProductIncomeItemsFromList(document?.ProductIncomeItems)
}

export function getActiveProductIncomeItemsFromList(items: ProductIncomeItem[] | undefined): ProductIncomeItem[] {
  return (items || []).filter((item) => !item.Deleted)
}
