import type { ConsumableProduct, ConsumableProductCategory } from '../types'

export function addProductToCategory(
  categories: ConsumableProductCategory[],
  targetCategory: ConsumableProductCategory,
  product: ConsumableProduct,
): ConsumableProductCategory[] {
  return categories.map((category) => {
    if (!categoriesMatch(category, targetCategory)) {
      return category
    }

    const products = category.ConsumableProducts || []
    const nextProducts = products.filter((item) => !consumableProductsMatch(item, product))

    return {
      ...category,
      ConsumableProducts: [product, ...nextProducts],
    }
  })
}

function categoriesMatch(left: ConsumableProductCategory, right: ConsumableProductCategory): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  return Boolean(left.Name && right.Name && left.Name === right.Name)
}

function consumableProductsMatch(left: ConsumableProduct, right: ConsumableProduct): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  return false
}
