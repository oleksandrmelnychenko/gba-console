import { ActionIcon, Box, Group, Text, Tooltip } from '@mantine/core'
import { Package, Trash2 } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { DataTable } from '../../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../../shared/ui/data-table/types'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem } from '../../types'
import {
  getOrderItemDiscount,
  getOrderItemLocalPrice,
  getOrderItemLocalTotal,
  getWizardProductNumber,
  type WizardSaleProduct,
} from './wizardSaleProduct'
import '../../../../shared/ui/data-table/data-table.css'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

const WIZARD_CART_TABLE_MIN_WIDTH = 1280
const WIZARD_CART_TABLE_LAYOUT: DataTableDefaultLayout = {
  columnPinning: {
    right: ['actions'],
  },
  columnSizing: {
    actions: 48,
    addedBy: 112,
    comment: 128,
    discount: 124,
    index: 42,
    originalNumber: 138,
    price: 132,
    product: 260,
    qty: 78,
    specificationCode: 116,
    total: 132,
  },
  density: 'compact',
}

function displayValue(value: unknown): string {
  const text = value == null ? '' : String(value).trim()

  return text || '-'
}

export const WizardShoppingCartGrid = memo(function WizardShoppingCartGrid({
  busy = false,
  items,
  localCurrencyCode,
  useEurToUah,
  onRemove,
  onRowClick,
}: {
  busy?: boolean
  items: SalesUkraineOrderItem[]
  localCurrencyCode: string
  useEurToUah: boolean
  onRemove?: (item: SalesUkraineOrderItem) => void
  onRowClick?: (item: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const totals = useMemo(() => {
    let qty = 0
    let amount = 0
    let amountLocal = 0

    for (const item of items) {
      qty += getWizardProductNumber(item.Qty) ?? 0
      amount += getWizardProductNumber(item.TotalAmount) ?? 0
      amountLocal += getOrderItemLocalTotal(item, useEurToUah)
    }

    return { amount: roundMoney(amount), amountLocal: roundMoney(amountLocal), qty }
  }, [items, useEurToUah])

  const indexByItem = useMemo(() => new Map(items.map((item, index) => [item, index])), [items])

  const columns = useMemo<DataTableColumn<SalesUkraineOrderItem>[]>(() => {
    const result: DataTableColumn<SalesUkraineOrderItem>[] = [
      {
        id: 'index',
        header: '#',
        accessor: (item) => indexByItem.get(item) ?? 0,
        cell: (item) => <Text className="new-sale-cart__index">{(indexByItem.get(item) ?? 0) + 1}</Text>,
        width: 42,
        minWidth: 42,
        enableSorting: false,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.Product?.VendorCode || item.Product?.Articul || item.Product?.NameUA || item.Product?.Name || '',
        cell: (item) => <WizardCartProductCell item={item} />,
        width: 260,
        minWidth: 230,
        fill: true,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        accessor: (item) => item.Comment || '',
        cell: (item) => <WizardCartTextCell value={displayValue(item.Comment)} />,
        width: 128,
        minWidth: 104,
      },
      {
        id: 'originalNumber',
        header: t('Ориг. номер'),
        accessor: (item) => item.Product?.MainOriginalNumber || '',
        cell: (item) => <WizardCartTextCell value={displayValue(item.Product?.MainOriginalNumber)} />,
        width: 138,
        minWidth: 118,
      },
      {
        id: 'specificationCode',
        header: t('Митний код'),
        accessor: (item) => item.AssignedSpecification?.SpecificationCode || '',
        cell: (item) => <WizardCartTextCell value={displayValue(item.AssignedSpecification?.SpecificationCode)} />,
        width: 116,
        minWidth: 100,
      },
      {
        id: 'addedBy',
        header: t('Додав'),
        accessor: (item) => item.User?.LastName || '',
        cell: (item) => <WizardCartTextCell value={displayValue(item.User?.LastName)} />,
        width: 112,
        minWidth: 96,
      },
      {
        id: 'qty',
        header: t('К-сть'),
        accessor: (item) => getWizardProductNumber(item.Qty) ?? 0,
        cell: (item) => <WizardCartValueCell unit={t('шт')} value={qtyFormatter.format(getWizardProductNumber(item.Qty) ?? 0)} />,
        width: 78,
        minWidth: 72,
      },
      {
        id: 'price',
        header: t('Ціна'),
        accessor: (item) => getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPrice) ?? 0,
        cell: (item) => {
          const product = item.Product as WizardSaleProduct | undefined

          return (
            <WizardCartStackValueCell
              primaryUnit="EUR"
              primaryValue={priceFormatter.format(getWizardProductNumber(product?.CurrentPrice) ?? 0)}
              secondaryUnit={localCurrencyCode}
              secondaryValue={priceFormatter.format(getOrderItemLocalPrice(item, useEurToUah))}
            />
          )
        },
        width: 132,
        minWidth: 118,
      },
      {
        id: 'total',
        header: t('Сума'),
        accessor: (item) => getWizardProductNumber(item.TotalAmount) ?? 0,
        cell: (item) => (
          <WizardCartStackValueCell
            primaryUnit="EUR"
            primaryValue={priceFormatter.format(getWizardProductNumber(item.TotalAmount) ?? 0)}
            secondaryUnit={localCurrencyCode}
            secondaryValue={priceFormatter.format(getOrderItemLocalTotal(item, useEurToUah))}
          />
        ),
        width: 132,
        minWidth: 118,
      },
      {
        id: 'discount',
        header: t('Знижка / ручні'),
        accessor: (item) => getOrderItemDiscount(item),
        cell: (item) => (
          <WizardCartDiscountCell
            discount={priceFormatter.format(getOrderItemDiscount(item))}
            manualDiscount={priceFormatter.format(getWizardProductNumber(item.OneTimeDiscount) ?? 0)}
          />
        ),
        width: 124,
        minWidth: 112,
      },
    ]

    if (onRemove) {
      result.push({
        id: 'actions',
        header: '',
        cell: (item) => (
          <Group className="new-sale-cart__actions" gap={2} justify="flex-start" wrap="nowrap">
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={busy}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onRemove(item)
                }}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
        width: 48,
        minWidth: 44,
        enableSorting: false,
      })
    }

    return result
  }, [busy, indexByItem, localCurrencyCode, onRemove, t, useEurToUah])

  return (
    <div className="new-sale-cart">
      <Box className="new-sale-cart__table">
        <DataTable
          columns={columns}
          data={items}
          defaultLayout={WIZARD_CART_TABLE_LAYOUT}
          distributeAvailableWidth
          emptyText={t('Кошик порожній')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          isLoading={busy && items.length === 0}
          layoutVersion="new-sale-wizard-cart-1"
          maxHeight={280}
          minWidth={WIZARD_CART_TABLE_MIN_WIDTH}
          showDensityToggle={false}
          showLayoutControls={false}
          tableId="new-sale-wizard-cart"
          onRowClick={onRowClick}
        />
      </Box>

      {items.length > 0 && (
        <div className="new-sale-cart__totals">
          <div className="new-sale-cart__total">
            <span>{t('К-сть')}</span>
            <strong>{qtyFormatter.format(totals.qty)}</strong>
          </div>
          <div className="new-sale-cart__total">
            <span>EUR</span>
            <strong>{priceFormatter.format(totals.amount)}</strong>
          </div>
          <div className="new-sale-cart__total is-strong">
            <span>{localCurrencyCode}</span>
            <strong>{priceFormatter.format(totals.amountLocal)}</strong>
          </div>
        </div>
      )}
    </div>
  )
})

function WizardCartProductCell({ item }: { item: SalesUkraineOrderItem }) {
  const code = displayValue(item.Product?.VendorCode || item.Product?.Articul)
  const name = displayValue(item.Product?.NameUA || item.Product?.Name)

  return (
    <Group className="new-sale-cart__product-cell" gap={9} wrap="nowrap">
      <Box className="new-sale-cart__product-icon">
        <Package size={15} />
      </Box>
      <Box className="new-sale-cart__product-copy">
        <Text className="new-sale-cart__product-code" title={code} truncate>
          {code}
        </Text>
        <Text className="new-sale-cart__product-name" title={name} truncate>
          {name}
        </Text>
      </Box>
    </Group>
  )
}

function WizardCartTextCell({ value }: { value: string }) {
  return (
    <Text className="new-sale-cart__text-cell" title={value} truncate>
      {value}
    </Text>
  )
}

function WizardCartValueCell({ unit, value }: { unit?: string; value: string }) {
  return (
    <Box className="new-sale-cart__value-cell is-inline">
      <Text>{value}</Text>
      {unit && <Text>{unit}</Text>}
    </Box>
  )
}

function WizardCartStackValueCell({
  primaryUnit,
  primaryValue,
  secondaryUnit,
  secondaryValue,
}: {
  primaryUnit: string
  primaryValue: string
  secondaryUnit: string
  secondaryValue: string
}) {
  return (
    <Box className="new-sale-cart__value-cell">
      <Group gap={4} wrap="nowrap">
        <Text>{primaryValue}</Text>
        <Text>{primaryUnit}</Text>
      </Group>
      <Group gap={4} wrap="nowrap">
        <Text>{secondaryValue}</Text>
        <Text>{secondaryUnit}</Text>
      </Group>
    </Box>
  )
}

function WizardCartDiscountCell({
  discount,
  manualDiscount,
}: {
  discount: string
  manualDiscount: string
}) {
  return (
    <Box className="new-sale-cart__discount-cell">
      <Text>{discount}</Text>
      <Text>{manualDiscount}</Text>
    </Box>
  )
}
