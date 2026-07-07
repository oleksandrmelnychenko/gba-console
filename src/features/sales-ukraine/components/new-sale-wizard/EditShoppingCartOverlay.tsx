import { ActionIcon, Box, Group, Text } from '@mantine/core'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { DataTable } from '../../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../../shared/ui/data-table/types'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem, SalesUkraineUser } from '../../types'
import { getOrderItemDiscount, getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'

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
  density: 'compact',
}

export type WizardSplitOrderItem = {
  Comment?: string
  Product: WizardSaleProduct
  Qty: number
  TotalAmount: number
  TotalAmountEurToUah: number
  TotalAmountLocal: number
  User?: SalesUkraineUser
}

export type WizardCartSelection = {
  index: number
  list: 'current' | 'split'
}

export function EditShoppingCartOverlay({
  currentItems,
  isSplit,
  onClose,
  selected,
  splitItems,
}: {
  currentItems: SalesUkraineOrderItem[]
  isSplit: boolean
  onClose: () => void
  selected: WizardCartSelection | null
  splitItems: WizardSplitOrderItem[]
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selected) {
      return
    }

    const row = rootRef.current?.querySelector('.data-table-row.is-selected')
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const currentRows = currentItems.map((item) => ({
    amountLocal: getWizardProductNumber(item.TotalAmountEurToUah) ?? 0,
    comment: item.Comment || '',
    discount: getOrderItemDiscount(item),
    localPrice: getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPriceEurToUah) ?? 0,
    name: item.Product?.NameUA || item.Product?.Name || '',
    oneTimeDiscount: getWizardProductNumber(item.OneTimeDiscount) ?? 0,
    originalNumber: item.Product?.MainOriginalNumber || '',
    price: getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPrice) ?? 0,
    qty: getWizardProductNumber(item.Qty) ?? 0,
    totalAmount: getWizardProductNumber(item.TotalAmount) ?? 0,
    user: item.User?.LastName || '',
    vendorCode: item.Product?.VendorCode || item.Product?.Articul || '',
  })) satisfies CartTableRow[]

  const splitRows = splitItems.map((item) => ({
    amountLocal: item.TotalAmountEurToUah,
    comment: item.Comment || '',
    discount: 0,
    localPrice: getWizardProductNumber(item.Product.CurrentPriceEurToUah) ?? 0,
    name: item.Product.NameUA || item.Product.Name || '',
    oneTimeDiscount: 0,
    originalNumber: item.Product.MainOriginalNumber || '',
    price: getWizardProductNumber(item.Product.CurrentPrice) ?? 0,
    qty: item.Qty,
    totalAmount: item.TotalAmount,
    user: item.User?.LastName || '',
    vendorCode: item.Product.VendorCode || item.Product.Articul || '',
  })) satisfies CartTableRow[]

  return (
    <Box
      className="new-sale-cart-edit-overlay"
      ref={rootRef}
      aria-modal="true"
      role="dialog"
    >
      <Box className="new-sale-cart-edit-overlay__frame">
        <ActionIcon
          aria-label={t('Закрити')}
          className="new-sale-cart-edit-overlay__close"
          size="lg"
          variant="subtle"
          onClick={onClose}
        >
          <X size={18} />
        </ActionIcon>
        <Box className="new-sale-cart-edit-overlay__content">
      <CartTable
        discountHeader={t('Ручна знижка')}
        list="current"
        rows={currentRows}
        selectedIndex={selected?.list === 'current' ? selected.index : null}
        title=""
      />
      {isSplit && (
        <CartTable
          discountHeader={t('Знижка')}
          list="split"
          rows={splitRows}
          selectedIndex={selected?.list === 'split' ? selected.index : null}
          title={t('Нова накладна з рахунку')}
        />
      )}
        </Box>
      </Box>
    </Box>
  )
}

type CartTableRow = {
  amountLocal: number
  comment: string
  discount: number
  localPrice: number
  name: string
  oneTimeDiscount: number
  originalNumber: string
  price: number
  qty: number
  totalAmount: number
  user: string
  vendorCode: string
}

function CartTable({
  discountHeader,
  list,
  rows,
  selectedIndex,
  title,
}: {
  discountHeader: string
  list: 'current' | 'split'
  rows: CartTableRow[]
  selectedIndex: number | null
  title: string
}) {
  const { t } = useI18n()
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.totalAmount, 0))
  const totalAmountLocal = roundMoney(rows.reduce((sum, row) => sum + row.amountLocal, 0))
  const columns: DataTableColumn<CartTableRow>[] = [
    {
      id: 'index',
      header: '#',
      accessor: (row) => rows.indexOf(row),
      cell: (row) => <Text className="new-sale-cart__index">{rows.indexOf(row) + 1}</Text>,
      width: 42,
      minWidth: 42,
      enableSorting: false,
    },
    {
      id: 'vendorCode',
      header: t('Код товару'),
      accessor: (row) => row.vendorCode,
      cell: (row) => <CartTextCell strong value={displayValue(row.vendorCode)} />,
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
      cell: (row) => <CartTextCell value={displayValue(row.originalNumber)} />,
      width: 160,
      minWidth: 128,
    },
    {
      id: 'addedBy',
      header: t('Додав'),
      accessor: (row) => row.user,
      cell: (row) => <CartTextCell value={displayValue(row.user)} />,
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
  ]

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
          rowClassName={(row) => (rows.indexOf(row) === selectedIndex ? 'is-selected' : undefined)}
          showDensityToggle={false}
          showLayoutControls={false}
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
}

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
