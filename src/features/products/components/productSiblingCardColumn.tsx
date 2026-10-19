import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getProductSiblingCardLabel } from '../productSiblings'
import type { ProductSiblingCardRef } from '../types'
import { ProductSiblingCardCell } from './ProductSiblingCards'

export const PRODUCT_SIBLING_CARD_COLUMN_ID = 'card'

export function createProductSiblingCardColumn<TRow extends { Card?: ProductSiblingCardRef | null }>(
  header: string,
): DataTableColumn<TRow> {
  return {
    id: PRODUCT_SIBLING_CARD_COLUMN_ID,
    header,
    width: 260,
    minWidth: 200,
    numeric: false,
    accessor: (row) => (row.Card ? getProductSiblingCardLabel(row.Card) : ''),
    cell: (row) => <ProductSiblingCardCell card={row.Card} />,
  }
}
