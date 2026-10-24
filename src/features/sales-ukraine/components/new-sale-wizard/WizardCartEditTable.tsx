import { Box, Group, Text } from '@mantine/core'
import { memo, useMemo } from 'react'
import { TableChip } from '../../../../shared/ui/TableChip'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { DataTable } from '../../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../../shared/ui/data-table/types'
import { getWizardCartEditTotals, type WizardCartEditRow } from './wizardCartEditModel'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

const CART_EDIT_TABLE_MIN_WIDTH = 1480
const CART_EDIT_TABLE_LAYOUT: DataTableDefaultLayout = {
  columnSizing: {
    addedBy: 132,
    amountLocal: 132,
    comment: 136,
    discount: 136,
    index: 42,
    localPrice: 118,
    name: 300,
    originalNumber: 160,
    price: 108,
    qty: 92,
    totalAmount: 132,
    vendorCode: 132,
  },
  density: 'normal',
}

export const WizardCartEditTable = memo(function WizardCartEditTable({
  discountHeader,
  list,
  rows,
  selectedIndex,
  title,
}: {
  discountHeader: string
  list: 'current' | 'split'
  rows: WizardCartEditRow[]
  selectedIndex: number | null
  title: string
}) {
  const { t } = useI18n()
  const { totalQty, totalAmount, totalAmountLocal } = useMemo(() => getWizardCartEditTotals(rows), [rows])
  const columns: DataTableColumn<WizardCartEditRow>[] = useMemo(() => [
    {
      id: 'index',
      header: '#',
      accessor: (row) => row.index,
      cell: (row) => <Text className="new-sale-cart__index">{row.index + 1}</Text>,
      width: 42,
      minWidth: 42,
      enableSorting: false,
    },
    {
      id: 'vendorCode',
      header: t('Код товару'),
      accessor: (row) => row.vendorCode,
      cell: (row) => <TableChip tone="product" value={displayValue(row.vendorCode)} />,
      width: 132,
      minWidth: 112,
    },
    {
      id: 'name',
      header: t('Назва'),
      accessor: (row) => row.name,
      cell: (row) => <CartTextCell className="new-sale-cart-edit__name" strong value={displayValue(row.name)} />,
      width: 300,
      minWidth: 230,
      fill: true,
    },
    {
      id: 'comment',
      header: t('Коментар'),
      accessor: (row) => row.comment,
      cell: (row) => <CartTextCell value={displayValue(row.comment)} />,
      width: 136,
      minWidth: 108,
    },
    {
      id: 'originalNumber',
      header: t('Ориг. номер'),
      accessor: (row) => row.originalNumber,
      cell: (row) => <TableChip tone="neutral" value={displayValue(row.originalNumber)} />,
      width: 160,
      minWidth: 128,
    },
    {
      id: 'addedBy',
      header: t('Додав'),
      accessor: (row) => row.user,
      cell: (row) => <TableChip tone="warning" value={row.user} />,
      width: 132,
      minWidth: 110,
    },
    {
      id: 'qty',
      header: t('К-сть'),
      accessor: (row) => row.qty,
      cell: (row) => <CartValueCell value={qtyFormatter.format(row.qty)} />,
      width: 92,
      minWidth: 76,
    },
    {
      id: 'price',
      header: 'EUR',
      accessor: (row) => row.price,
      cell: (row) => <CartValueCell value={priceFormatter.format(row.price)} />,
      width: 108,
      minWidth: 92,
    },
    {
      id: 'localPrice',
      header: 'UAH',
      accessor: (row) => row.localPrice,
      cell: (row) => <CartValueCell value={priceFormatter.format(row.localPrice)} />,
      width: 118,
      minWidth: 98,
    },
    {
      id: 'totalAmount',
      header: t('Сума в EUR'),
      accessor: (row) => row.totalAmount,
      cell: (row) => <CartValueCell value={priceFormatter.format(row.totalAmount)} />,
      width: 132,
      minWidth: 112,
    },
    {
      id: 'discount',
      header: discountHeader,
      accessor: (row) => (list === 'current' ? row.oneTimeDiscount : row.discount),
      cell: (row) => <CartValueCell muted value={priceFormatter.format(list === 'current' ? row.oneTimeDiscount : row.discount)} />,
      width: 136,
      minWidth: 116,
    },
    {
      id: 'amountLocal',
      header: `${t('Сума в')} UAH`,
      accessor: (row) => row.amountLocal,
      cell: (row) => <CartValueCell value={priceFormatter.format(row.amountLocal)} />,
      width: 132,
      minWidth: 112,
    },
  ], [discountHeader, list, t])

  return (
    <Box className="new-sale-cart new-sale-cart-edit">
      {title && (
        <Group className="new-sale-cart-edit__title" gap={8} wrap="nowrap">
          <span />
          <Text>{title}</Text>
        </Group>
      )}

      <Box className="new-sale-cart__table new-sale-cart-edit__table">
        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={CART_EDIT_TABLE_LAYOUT}
          distributeAvailableWidth
          emptyText={t('Немає позицій')}
          getRowId={(row, index) => `${list}-${index}-${row.vendorCode}-${row.originalNumber}`}
          height="100%"
          layoutVersion="new-sale-cart-edit-1"
          minWidth={CART_EDIT_TABLE_MIN_WIDTH}
          rowClassName={(row) => (row.index === selectedIndex ? 'is-selected' : undefined)}
          showDensityToggle={false}
          showLayoutControls
          showToolbar={false}
          tableId={`new-sale-cart-edit-${list}`}
        />
      </Box>

      <div className="new-sale-cart__totals new-sale-cart-edit__totals">
        <div className="new-sale-cart__total">
          <span>{t('К-сть')}</span>
          <strong>{qtyFormatter.format(totalQty)}</strong>
        </div>
        <div className="new-sale-cart__total">
          <span>{t('Вся сума')}</span>
          <strong>{priceFormatter.format(totalAmount)}</strong>
        </div>
        <div className="new-sale-cart__total is-strong">
          <span>{`${t('Сума в')} UAH`}</span>
          <strong>{priceFormatter.format(totalAmountLocal)}</strong>
        </div>
      </div>
    </Box>
  )
})

function displayValue(value: unknown): string {
  const text = value == null ? '' : String(value).trim()

  return text || '-'
}

function CartTextCell({
  className = '',
  strong = false,
  value,
}: {
  className?: string
  strong?: boolean
  value: string
}) {
  return (
    <Text className={`new-sale-cart__text-cell ${strong ? 'is-strong' : ''} ${className}`} title={value} truncate>
      {value}
    </Text>
  )
}

function CartValueCell({ muted = false, value }: { muted?: boolean; value: string }) {
  return (
    <Box className={`new-sale-cart__value-cell is-inline ${muted ? 'is-muted' : ''}`}>
      <Text>{value}</Text>
    </Box>
  )
}
