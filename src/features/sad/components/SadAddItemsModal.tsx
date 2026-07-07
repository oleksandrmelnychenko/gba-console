import { Alert, Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core'
import { CircleAlert, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { AppModal } from '../../../shared/ui/AppModal'
import { getAllUkraineCartItemsForSad } from '../api/sadApi'
import type { Sad, SadItem, SadSupplyOrderUkraineCartItem } from '../types'

const ADD_ITEMS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['select', 'vendorCode'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

type SadAddItemsModalProps = {
  opened: boolean
  sad: Sad | null
  onAdd: (items: SadItem[]) => void
  onClose: () => void
}

export function SadAddItemsModal({ onAdd, onClose, opened, sad }: SadAddItemsModalProps) {
  const { t } = useI18n()
  const [cartItems, setCartItems] = useState<SadSupplyOrderUkraineCartItem[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)

  const existingCartItemKeys = useMemo(() => new Set(
    (sad?.SadItems || [])
      .flatMap((item) => {
        const key = getCartItemKey(item.SupplyOrderUkraineCartItem)

        return key ? [key] : []
      }),
  ), [sad?.SadItems])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return cartItems
    }

    return cartItems.filter((item) => {
      const product = item.Product

      return [
        product?.VendorCode,
        product?.Name,
        product?.NameUA,
        product?.MainOriginalNumber,
        getClientName(item.Supplier),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch))
    })
  }, [cartItems, search])

  const selectableItems = useMemo(
    () => filteredItems.filter((item) => canSelectItem(item, existingCartItemKeys)),
    [existingCartItemKeys, filteredItems],
  )
  const isAllSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedKeys.has(getCartItemKey(item)))

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    async function loadCartItems() {
      setLoading(true)
      setError(null)
      setSearch('')
      setSelectedKeys(new Set())

      try {
        const loadedItems = await getAllUkraineCartItemsForSad()

        if (!cancelled) {
          setCartItems(loadedItems)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити корзину постачання'))
          setCartItems([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCartItems()

    return () => {
      cancelled = true
    }
  }, [opened, t])

  const columns = useMemo<DataTableColumn<SadSupplyOrderUkraineCartItem>[]>(
    () => [
      {
        id: 'select',
        header: (
          <Checkbox
            aria-label={t('Вибрати всі')}
            checked={isAllSelected}
            disabled={selectableItems.length === 0}
            onChange={() => {
              setSelectedKeys((currentKeys) => {
                const nextKeys = new Set(currentKeys)

                selectableItems.forEach((item) => {
                  const key = getCartItemKey(item)

                  if (isAllSelected) {
                    nextKeys.delete(key)
                  } else {
                    nextKeys.add(key)
                  }
                })

                return nextKeys
              })
            }}
          />
        ),
        cell: (item) => {
          const key = getCartItemKey(item)
          const disabled = !canSelectItem(item, existingCartItemKeys)

          return (
            <Checkbox
              aria-label={t('Вибрати')}
              checked={selectedKeys.has(key)}
              disabled={disabled}
              onChange={() => {
                setSelectedKeys((currentKeys) => {
                  const nextKeys = new Set(currentKeys)

                  if (nextKeys.has(key)) {
                    nextKeys.delete(key)
                  } else {
                    nextKeys.add(key)
                  }

                  return nextKeys
                })
              }}
            />
          )
        },
        enableSorting: false,
        width: 54,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => item.Product?.VendorCode,
        width: 160,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.Product?.Name,
        minWidth: 260,
      },
      {
        id: 'reserved',
        header: t('Резерв'),
        accessor: (item) => item.ReservedQty,
        align: 'right',
        cell: (item) => formatQty(item.ReservedQty),
        width: 120,
      },
      {
        id: 'available',
        header: t('Доступно'),
        accessor: (item) => item.AvailableQty,
        align: 'right',
        cell: (item) => formatQty(item.AvailableQty),
        width: 120,
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        accessor: (item) => item.UnitPrice,
        align: 'right',
        cell: (item) => formatMoney(item.UnitPrice),
        width: 120,
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        accessor: (item) => getClientName(item.Supplier),
        minWidth: 180,
      },
      {
        id: 'state',
        header: t('Стан'),
        cell: (item) => existingCartItemKeys.has(getCartItemKey(item)) ? t('Вже в SAD') : '',
        width: 120,
      },
    ],
    [existingCartItemKeys, isAllSelected, selectableItems, selectedKeys, t],
  )

  function addSelectedItems() {
    const selectedItems = cartItems.filter((item) => selectedKeys.has(getCartItemKey(item)) && canSelectItem(item, existingCartItemKeys))

    if (selectedItems.length === 0) {
      setError(t('Оберіть позиції для додавання'))
      return
    }

    onAdd(selectedItems.map(createSadItemFromCartItem))
    onClose()
  }

  return (
    <AppModal centered opened={opened} size="xl" title={t('Додати товари з корзини постачання')} onClose={onClose}>
      <Stack>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <TextInput
          leftSection={<Search size={16} />}
          placeholder={t('Артикул, назва, оригінальний номер або постачальник')}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        <DataTable
          columns={columns}
          data={filteredItems}
          defaultLayout={ADD_ITEMS_TABLE_LAYOUT}
          emptyText={t('Позицій з резервом немає')}
          getRowId={(item, index) => getCartItemKey(item) || String(index)}
          isLoading={isLoading}
          minWidth={1180}
          tableId="sad-add-cart-items"
          toolbarLeft={
            <Text c="dimmed" size="xs">
              {t('Вибрано')} {selectedKeys.size}
            </Text>
          }
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isLoading || selectedKeys.size === 0} onClick={addSelectedItems}>
            {t('Додати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createSadItemFromCartItem(item: SadSupplyOrderUkraineCartItem): SadItem {
  return {
    Qty: item.ReservedQty || 0,
    Supplier: item.Supplier,
    SupplierId: item.SupplierId,
    SupplyOrderUkraineCartItem: item,
    SupplyOrderUkraineCartItemId: item.Id,
  }
}

function canSelectItem(item: SadSupplyOrderUkraineCartItem, existingCartItemKeys: Set<string>): boolean {
  return (item.ReservedQty || 0) > 0 && !existingCartItemKeys.has(getCartItemKey(item))
}

function getCartItemKey(item?: SadSupplyOrderUkraineCartItem | null): string {
  return String(item?.NetUid || item?.Id || '')
}

function getClientName(client?: { Abbreviation?: string; FullName?: string; Name?: string } | null): string {
  return client?.FullName || client?.Name || client?.Abbreviation || ''
}

function formatQty(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? qtyFormatter.format(value) : ''
}

function formatMoney(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}
