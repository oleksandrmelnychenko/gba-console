import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEye,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PermissionGate } from '../../auth/components/PermissionGate'
import {
  createDeprecatedConsumableOrder,
  deleteConsumableStorage,
  deleteDeprecatedConsumableOrder,
  getConsumableStorage,
  getDeprecatedConsumableOrders,
  getConsumableStorages,
  searchConsumableStorages,
  searchConsumableStorageUsers,
  updateDeprecatedConsumableOrder,
} from '../api/consumableStoragesApi'
import { searchPaymentCostMovements } from '../../consumable-orders/api/consumableOrdersApi'
import {
  CONSUMABLE_STORAGE_CREATE_PERMISSION,
  CONSUMABLE_STORAGE_DELETE_PERMISSION,
  CONSUMABLE_STORAGE_EDIT_PERMISSION,
} from '../permissions'
import type {
  ConsumableProduct,
  ConsumablesOrder,
  ConsumablesOrderItem,
  ConsumablesStorage,
  DeprecatedConsumableOrder,
  DeprecatedConsumableOrderItem,
  NamedEntity,
  PaymentCostMovement,
  PaymentCostMovementOperation,
  UserProfile,
} from '../types'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['products', 'actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const SEARCH_DEBOUNCE_MS = 350
const DEPRECATED_SEARCH_DEBOUNCE_MS = 350

const DEPRECATED_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['order'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const REMNANTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['article'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function ConsumableStoragesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [storages, setStorages] = useValueState<ConsumablesStorage[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [selectedStorage, setSelectedStorage] = useValueState<ConsumablesStorage | null>(null)
  const [deleteStorageTarget, setDeleteStorageTarget] = useValueState<ConsumablesStorage | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling

  const openEditor = useCallback(
    (storage: ConsumablesStorage) => {
      if (!storage.NetUid) {
        return
      }

      navigate(`/accounting/storages/edit/${storage.NetUid}`, {
        state: {
          nodeTitle: storage.Name,
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const openCreateStorage = useCallback(() => {
    navigate('/accounting/storages/new', {
      state: {
        backgroundLocation: location,
        returnPath: `${location.pathname}${location.search}`,
      },
    })
  }, [location, navigate])

  const columns = useConsumableStorageColumns({
    onDelete: setDeleteStorageTarget,
    onEdit: openEditor,
    onOpen: setSelectedStorage,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadStorages() {
      setLoading(true)
      setError(null)

      try {
        const nextStorages = normalizedSearchValue
          ? await searchConsumableStorages(normalizedSearchValue)
          : await getConsumableStorages()

        if (!controller.signal.aborted) {
          setStorages(nextStorages)
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadStorages()

    return () => controller.abort()
  }, [normalizedSearchValue, reloadKey, setError, setLoading, setStorages, t])

  const toolbarLeft = useMemo(
    () => (
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder={t('Пошук')}
        value={searchValue}
        w={{ base: '100%', sm: 360 }}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />
    ),
    [searchValue, setSearchValue, t],
  )

  async function handleDelete() {
    if (!deleteStorageTarget?.NetUid) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteConsumableStorage(deleteStorageTarget.NetUid)
      setStorages((current) => current.filter((storage) => storage.NetUid !== deleteStorageTarget.NetUid))
      notifications.show({ color: 'green', message: t('Склад видалено') })
      setDeleteStorageTarget(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити склад'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="md">
      <PermissionGate permissionKey={CONSUMABLE_STORAGE_CREATE_PERMISSION}>
        <PageHeaderActions>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              color={CREATE_ACTION_COLOR}
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateStorage}
            >
              {t('Новий склад')}
            </Button>
          </Group>
        </PageHeaderActions>
      </PermissionGate>

      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Group gap="xs">
            <Badge color="blue" variant="light">
              {t('Складів')}: {storages.length}
            </Badge>
            <Badge color="gray" variant="light">
              {t('Позицій')}: {storages.reduce((total, storage) => total + (storage.ConsumableProducts?.length || 0), 0)}
            </Badge>
          </Group>

          <DataTable
            columns={columns}
            data={storages}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Складів не знайдено')}
            getRowId={(storage) => String(storage.NetUid || storage.Id || storage.Name)}
            isLoading={isTableBusy}
            layoutVersion="consumable-storages-compact-2"
            minWidth={960}
            tableId="consumable-storages"
            toolbarLeft={toolbarLeft}
            onRowClick={setSelectedStorage}
          />
        </Stack>
      </Card>

      <ConsumableStorageDetailDrawer
        storage={selectedStorage}
        onChanged={reload}
        onClose={() => setSelectedStorage(null)}
        onStorageLoaded={(nextStorage) => {
          setSelectedStorage(nextStorage)
          setStorages((current) =>
            current.map((storageItem) => (storageItem.NetUid === nextStorage.NetUid ? nextStorage : storageItem)),
          )
        }}
      />
      <DeleteStorageModal
        isSaving={isDeleting}
        storage={deleteStorageTarget}
        onClose={() => setDeleteStorageTarget(null)}
        onDelete={handleDelete}
      />
    </Stack>
  )
}

function useConsumableStorageColumns({
  onDelete,
  onEdit,
  onOpen,
}: {
  onDelete: (storage: ConsumablesStorage) => void
  onEdit: (storage: ConsumablesStorage) => void
  onOpen: (storage: ConsumablesStorage) => void
}): DataTableColumn<ConsumablesStorage>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ConsumablesStorage>[]>(
    () => [
      {
        id: 'name',
        header: t('Назва'),
        width: 180,
        minWidth: 160,
        maxWidth: 220,
        accessor: (storage) => storage.Name,
        cell: (storage) => <TruncatedCell fw={600} value={storage.Name} />,
      },
      {
        id: 'description',
        header: t('Опис'),
        width: 230,
        minWidth: 180,
        maxWidth: 300,
        accessor: (storage) => storage.Description,
        cell: (storage) => <TruncatedCell value={storage.Description} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 170,
        minWidth: 140,
        maxWidth: 220,
        accessor: (storage) => getEntityName(storage.ResponsibleUser),
        cell: (storage) => <TruncatedCell value={getEntityName(storage.ResponsibleUser)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 300,
        minWidth: 220,
        accessor: (storage) => getEntityName(storage.Organization),
        cell: (storage) => <TruncatedCell value={getEntityName(storage.Organization)} />,
      },
      {
        id: 'products',
        header: t('Позицій'),
        width: 82,
        minWidth: 72,
        maxWidth: 90,
        align: 'right',
        accessor: (storage) => storage.ConsumableProducts?.length || 0,
        cell: (storage) => String(storage.ConsumableProducts?.length || 0),
      },
      {
        id: 'actions',
        header: '',
        width: 104,
        minWidth: 104,
        maxWidth: 112,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (storage) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <PermissionGate permissionKey={CONSUMABLE_STORAGE_DELETE_PERMISSION}>
              <Tooltip label={t('Видалити')}>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  disabled={!storage.NetUid}
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(storage)
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
            <Tooltip label={t('Деталі')}>
              <ActionIcon
                aria-label={t('Деталі')}
                color="gray"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(storage)
                }}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
            <PermissionGate permissionKey={CONSUMABLE_STORAGE_EDIT_PERMISSION}>
              <Tooltip label={t('Редагувати')}>
                <ActionIcon
                  aria-label={t('Редагувати')}
                  color="violet"
                  disabled={!storage.NetUid}
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(storage)
                  }}
                >
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
          </Group>
        ),
      },
    ],
    [onDelete, onEdit, onOpen, t],
  )
}

function TruncatedCell({ fw, value }: { fw?: number; value?: number | string | null }) {
  const text = displayValue(value)
  const hasTooltip = text && text !== '-'

  return (
    <Tooltip
      disabled={!hasTooltip}
      label={text}
      maw={420}
      multiline
      openDelay={350}
      position="top-start"
      styles={{
        tooltip: {
          background: '#ffffff',
          border: '1px solid var(--mantine-color-gray-2)',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
          color: '#111827',
          opacity: 1,
        },
      }}
      withArrow
    >
      <Text
        component="span"
        fw={fw}
        style={{
          display: 'block',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {text}
      </Text>
    </Tooltip>
  )
}

function ConsumableStorageDetailDrawer({
  storage,
  onChanged,
  onClose,
  onStorageLoaded,
}: {
  storage: ConsumablesStorage | null
  onChanged: () => void
  onClose: () => void
  onStorageLoaded: (storage: ConsumablesStorage) => void
}) {
  const { t } = useI18n()
  const products = storage?.ConsumableProducts || []
  const totals = storage?.PriceTotals || []

  const handleChanged = useCallback(() => {
    onChanged()

    if (storage?.NetUid) {
      void getConsumableStorage(storage.NetUid).then((nextStorage) => {
        if (nextStorage) {
          onStorageLoaded(nextStorage)
        }
      }).catch(() => undefined)
    }
  }, [onChanged, onStorageLoaded, storage])

  return (
    <AppDrawer opened={Boolean(storage)} padding="md" size="xl" title={t('Склад')} onClose={onClose}>
      {storage && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Назва')} value={displayValue(storage.Name)} />
            <DetailItem label={t('Опис')} value={displayValue(storage.Description)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(getEntityName(storage.ResponsibleUser))} />
            <DetailItem label={t('Організація')} value={displayValue(getEntityName(storage.Organization))} />
          </SimpleGrid>

          <Divider />

          <Tabs defaultValue="remnants" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="remnants">{t('Залишки')}</Tabs.Tab>
              <Tabs.Tab value="writtenGoods">{t('Списані товари')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel pt="md" value="remnants">
              <StorageRemnantsPanel products={products} totals={totals} />
            </Tabs.Panel>

            <Tabs.Panel pt="md" value="writtenGoods">
              <DeprecatedConsumableOrdersPanel storage={storage} onChanged={handleChanged} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </AppDrawer>
  )
}

function StorageRemnantsPanel({ products, totals }: { products: ConsumableProduct[]; totals: ConsumablesStorage['PriceTotals'] }) {
  const { t } = useI18n()
  const [searchValue, setSearchValue] = useValueState('')
  const columns = useStorageRemnantColumns()
  const filteredProducts = useMemo(
    () => filterStorageRemnants(products, searchValue),
    [products, searchValue],
  )

  return (
    <Stack gap="md">
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder={t('Назва або артикул')}
        value={searchValue}
        w={{ base: '100%', sm: 320 }}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />

      <DataTable
        columns={columns}
        data={filteredProducts}
        defaultLayout={REMNANTS_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Залишків не знайдено')}
        getRowId={(product, index) => String(product.NetUid || product.Id || product.VendorCode || index)}
        layoutVersion="consumable-storage-remnants-1"
        maxHeight={360}
        minWidth={820}
        tableId="consumable-storage-remnants"
      />

      {totals && totals.length > 0 && (
        <Stack gap="xs">
          <Text fw={700}>{t('Підсумки')}</Text>
          {totals.map((total) => (
            <SimpleGrid key={getPriceTotalKey(total)} cols={{ base: 1, sm: 3 }}>
              <DetailItem label={t('Валюта')} value={displayValue(total.Currency?.Code || total.Currency?.Name)} />
              <DetailItem label={t('Кількість')} value={formatAmount(total.Qty)} />
              <DetailItem label={t('Сума')} value={formatMoney(total.TotalPrice ?? total.Amount)} />
            </SimpleGrid>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function filterStorageRemnants(products: ConsumableProduct[], value: string): ConsumableProduct[] {
  const normalizedValue = value.trim().toLowerCase()

  if (!normalizedValue) {
    return products
  }

  return products.filter((product) => [
    product.Name,
    product.VendorCode,
    product.Article,
  ].some((field) => field?.toLowerCase().includes(normalizedValue)))
}

function getPriceTotalKey(total: NonNullable<ConsumablesStorage['PriceTotals']>[number]): string {
  const currencyKey =
    total.Currency?.NetUid ||
    total.Currency?.Code ||
    total.Currency?.Name ||
    total.Currency?.Id ||
    'without-currency'

  return `${currencyKey}-${total.Qty ?? 0}-${total.TotalPrice ?? total.Amount ?? 0}`
}

function formatStorageRemnantQuantity(product: ConsumableProduct): string {
  const quantity = formatAmount(product.SpecificationQty ?? product.TotalQty)
  const unit = product.MeasureUnit && (product.MeasureUnit.Id ?? 0) > 0 ? product.MeasureUnit.Name : undefined

  return unit ? `${quantity} ${unit}` : quantity
}

function getStorageRemnantWorthPrice(product: ConsumableProduct): number | undefined {
  const priceTotals = product.PriceTotals

  if (!priceTotals || priceTotals.length === 0) {
    return product.WorthPrice ?? product.PricePerItem
  }

  return priceTotals.reduce((sum, total) => sum + (total.TotalPrice ?? total.Amount ?? 0), 0)
}

function getStorageRemnantCurrency(product: ConsumableProduct): string | undefined {
  const priceTotals = product.PriceTotals

  if (!priceTotals || priceTotals.length === 0) {
    return product.Currency?.Name || product.Currency?.Code
  }

  const codes = new Set<string>()

  for (const total of priceTotals) {
    const code = total.Currency?.Code || total.Currency?.Name

    if (code) {
      codes.add(code)
    }
  }

  return codes.size > 0 ? Array.from(codes).join(' ') : undefined
}

function useStorageRemnantColumns(): DataTableColumn<ConsumableProduct>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ConsumableProduct>[]>(
    () => [
      {
        id: 'article',
        header: t('Артикул'),
        width: 150,
        minWidth: 120,
        accessor: (product) => product.Article || product.VendorCode,
        cell: (product) => displayValue(product.Article || product.VendorCode),
      },
      {
        id: 'quantity',
        header: t('Кількість'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (product) => product.SpecificationQty ?? product.TotalQty,
        cell: (product) => formatStorageRemnantQuantity(product),
      },
      {
        id: 'name',
        header: t('Назва'),
        minWidth: 220,
        accessor: (product) => product.Name,
        cell: (product) => <Text fw={600}>{displayValue(product.Name)}</Text>,
      },
      {
        id: 'worthPrice',
        header: t('Вартість'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (product) => getStorageRemnantWorthPrice(product),
        cell: (product) => formatMoney(getStorageRemnantWorthPrice(product)),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 130,
        minWidth: 112,
        accessor: (product) => getStorageRemnantCurrency(product),
        cell: (product) => displayValue(getStorageRemnantCurrency(product)),
      },
    ],
    [t],
  )
}

type DeprecatedConsumableOrderRow = {
  id: string
  item?: DeprecatedConsumableOrderItem
  order: DeprecatedConsumableOrder
}

type DeprecatedConsumableOrdersState = {
  error: string | null
  isLoading: boolean
  orders: DeprecatedConsumableOrder[]
}

const EMPTY_DEPRECATED_CONSUMABLE_ORDERS_STATE: DeprecatedConsumableOrdersState = {
  error: null,
  isLoading: false,
  orders: [],
}

function DeprecatedConsumableOrdersPanel({
  storage,
  onChanged,
}: {
  storage: ConsumablesStorage
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [ordersState, setOrdersState] = useValueState<DeprecatedConsumableOrdersState>(
    EMPTY_DEPRECATED_CONSUMABLE_ORDERS_STATE,
  )
  const [editorOrder, setEditorOrder] = useValueState<DeprecatedConsumableOrder | null>(null)
  const [deleteOrderTarget, setDeleteOrderTarget] = useValueState<DeprecatedConsumableOrder | null>(null)
  const [isDeletingOrder, setDeletingOrder] = useValueState(false)
  const [reloadKey, reloadOrders] = useReducer((key: number) => key + 1, 0)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, DEPRECATED_SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const requestRef = useRef(0)
  const storageNetId = storage.NetUid || ''
  const { error, isLoading, orders } = ordersState
  const filterError = getDateRangeError(fromDate, toDate)
  const rows = useMemo(() => flattenDeprecatedConsumableOrders(orders), [orders])
  const { density, toggleDensity } = useDataTableDensity(
    'consumable-storage-deprecated-orders',
    DEPRECATED_TABLE_DEFAULT_LAYOUT.density,
  )
  const columns = useDeprecatedConsumableOrderColumns({
    onDelete: setDeleteOrderTarget,
    onEdit: setEditorOrder,
  })

  useEffect(() => {
    if (!storageNetId || filterError) {
      requestRef.current += 1
      setOrdersState(EMPTY_DEPRECATED_CONSUMABLE_ORDERS_STATE)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setOrdersState((current) => ({
      ...current,
      error: null,
      isLoading: true,
    }))

    async function loadOrders() {
      try {
        const nextOrders = await getDeprecatedConsumableOrders({
          from: fromDate,
          storageNetId,
          to: toDate,
          value: normalizedSearchValue || undefined,
        })

        if (requestRef.current === requestId) {
          setOrdersState({
            error: null,
            isLoading: false,
            orders: nextOrders,
          })
        }
      } catch (loadError) {
        if (requestRef.current === requestId) {
          setOrdersState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити списані товари'),
            isLoading: false,
            orders: [],
          })
        }
      }
    }

    void loadOrders()
  }, [filterError, fromDate, normalizedSearchValue, reloadKey, setOrdersState, storageNetId, t, toDate])

  function resetFilters() {
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
    setSearchValue('')
  }

  async function handleDeleteOrder() {
    if (!deleteOrderTarget?.NetUid || isDeletingOrder) {
      return
    }

    setDeletingOrder(true)
    setOrdersState((current) => ({ ...current, error: null }))

    try {
      await deleteDeprecatedConsumableOrder(deleteOrderTarget.NetUid)
      notifications.show({ color: 'green', message: t('Списання видалено') })
      setDeleteOrderTarget(null)
      reloadOrders()
      onChanged()
    } catch (deleteError) {
      setOrdersState((current) => ({
        ...current,
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити списання'),
      }))
    } finally {
      setDeletingOrder(false)
    }
  }

  return (
    <Stack gap="md">
      <Group align="end" justify="space-between" gap="sm" wrap="wrap">
        <Group align="end" gap="sm" wrap="wrap">
          <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
          <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, артикул, товар або отримувач')}
            value={searchValue}
            w={{ base: '100%', sm: 320 }}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
          <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
        </Group>

        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditorOrder(createDeprecatedConsumableOrderDraft(storage))}>
          {t('Списати')}
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {filterError && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {filterError}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={DEPRECATED_TABLE_DEFAULT_LAYOUT}
        density={density}
        emptyText={t('Списаних товарів не знайдено')}
        getRowId={(row) => row.id}
        isLoading={isLoading || isSearchSettling}
        layoutVersion="consumable-storage-deprecated-orders-1"
        maxHeight={420}
        minWidth={1180}
        tableId="consumable-storage-deprecated-orders"
      />

      {editorOrder && (
        <DeprecatedConsumableOrderEditorModal
          key={getDeprecatedOrderEditorKey(editorOrder)}
          order={editorOrder}
          storage={storage}
          onChanged={() => {
            setEditorOrder(null)
            reloadOrders()
            onChanged()
          }}
          onClose={() => setEditorOrder(null)}
        />
      )}

      <DeleteDeprecatedConsumableOrderModal
        isSaving={isDeletingOrder}
        order={deleteOrderTarget}
        onClose={() => setDeleteOrderTarget(null)}
        onDelete={handleDeleteOrder}
      />
    </Stack>
  )
}

function useDeprecatedConsumableOrderColumns({
  onDelete,
  onEdit,
}: {
  onDelete: (order: DeprecatedConsumableOrder) => void
  onEdit: (order: DeprecatedConsumableOrder) => void
}): DataTableColumn<DeprecatedConsumableOrderRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DeprecatedConsumableOrderRow>[]>(
    () => [
      {
        id: 'order',
        header: t('Номер'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.order.Number,
        cell: (row) => displayValue(row.order.Number),
      },
      {
        id: 'created',
        header: t('Дата'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.order.Created,
        cell: (row) => formatDateTime(row.order.Created),
      },
      {
        id: 'createdBy',
        header: t('Видав'),
        width: 170,
        minWidth: 140,
        accessor: (row) => getEntityName(row.order.CreatedBy),
        cell: (row) => displayValue(getEntityName(row.order.CreatedBy)),
      },
      {
        id: 'article',
        header: t('Артикул'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.item?.ConsumablesOrderItem?.ConsumableProduct?.VendorCode,
        cell: (row) => displayValue(row.item?.ConsumablesOrderItem?.ConsumableProduct?.VendorCode),
      },
      {
        id: 'name',
        header: t('Назва'),
        minWidth: 220,
        accessor: (row) => row.item?.ConsumablesOrderItem?.ConsumableProduct?.Name,
        cell: (row) => <Text fw={600}>{displayValue(row.item?.ConsumablesOrderItem?.ConsumableProduct?.Name)}</Text>,
      },
      {
        id: 'depreciatedTo',
        header: t('Кому'),
        width: 170,
        minWidth: 140,
        accessor: (row) => getEntityName(row.order.DepreciatedTo),
        cell: (row) => displayValue(getEntityName(row.order.DepreciatedTo)),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.item?.Qty,
        cell: (row) => formatAmount(row.item?.Qty),
      },
      {
        id: 'price',
        header: t('Ціна'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.item?.ConsumablesOrderItem?.PricePerItem,
        cell: (row) => formatMoney(row.item?.ConsumablesOrderItem?.PricePerItem),
      },
      {
        id: 'total',
        header: t('Сума'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.item?.TotalPrice,
        cell: (row) => formatMoney(row.item?.TotalPrice),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 120,
        minWidth: 104,
        accessor: (row) => row.item?.Currency?.Name || row.item?.Currency?.Code,
        cell: (row) => displayValue(row.item?.Currency?.Name || row.item?.Currency?.Code),
      },
      {
        id: 'costMovement',
        header: t('Стаття витрат'),
        width: 220,
        minWidth: 180,
        accessor: (row) => getPaymentCostMovementName(row.item),
        cell: (row) => displayValue(getPaymentCostMovementName(row.item)),
      },
      {
        id: 'actions',
        header: '',
        width: 92,
        minWidth: 84,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="violet"
                disabled={!row.order.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit(row.order)
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={!row.order.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(row.order)
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [onDelete, onEdit, t],
  )
}

function DeprecatedConsumableOrderEditorModal({
  order,
  storage,
  onChanged,
  onClose,
}: {
  order: DeprecatedConsumableOrder
  storage: ConsumablesStorage
  onChanged: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const initialDraft = useMemo(() => normalizeDeprecatedOrderForEditing(order, storage), [order, storage])
  const [draft, setDraft] = useValueState<DeprecatedConsumableOrder>(() => initialDraft)
  const [users, setUsers] = useValueState<UserProfile[]>(() => collectDeprecatedOrderUsers(initialDraft))
  const [movements, setMovements] = useValueState<PaymentCostMovement[]>(() => collectDeprecatedOrderMovements(initialDraft))
  const [headSearch, setHeadSearch] = useValueState(() => getEntityName(initialDraft.CommissionHead) || '')
  const [depreciatedToSearch, setDepreciatedToSearch] = useValueState(() => getEntityName(initialDraft.DepreciatedTo) || '')
  const [entryMode, setEntryMode] = useValueState<'products' | 'orders'>('products')
  const [productValue, setProductValue] = useValueState('')
  const [expensiveFirst, setExpensiveFirst] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const isEditMode = Boolean(order?.Id || order?.NetUid)
  const products = useMemo(() => storage.ConsumableProducts || [], [storage.ConsumableProducts])
  const consumableOrders = useMemo(() => storage.ConsumablesOrders || [], [storage.ConsumablesOrders])
  const productOptions = useMemo(
    () =>
      products.reduce<Array<{ label: string; value: string }>>((acc, product) => {
        const option = {
          label: getProductLabel(product),
          value: getEntityValue(product),
        }

        if (option.value) {
          acc.push(option)
        }

        return acc
      }, []),
    [products],
  )

  function updateDraft(patch: Partial<DeprecatedConsumableOrder>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleUserSearch(value: string, setter: (value: string) => void) {
    setter(value)

    void searchConsumableStorageUsers(value.trim())
      .then((nextUsers) => setUsers((current) => mergeEntities(current, nextUsers)))
      .catch(() => undefined)
  }

  function handleMovementSearch(value: string) {
    void searchPaymentCostMovements(value.trim())
      .then((nextMovements) => setMovements((current) => mergeEntities(current, nextMovements)))
      .catch(() => undefined)
  }

  function addSelectedProduct() {
    const product = products.find((item) => getEntityValue(item) === productValue)

    if (!product) {
      return
    }

    const productKey = getEntityValue(product)
    const hasProduct = (draft.DepreciatedConsumableOrderItems || []).some(
      (item) => getEntityValue(item.ConsumablesOrderItem?.ConsumableProduct) === productKey,
    )

    if (hasProduct) {
      setError(t('Товар вже додано до списання'))
      return
    }

    setDraft((current) => ({
      ...current,
      DepreciatedConsumableOrderItems: [
        ...(current.DepreciatedConsumableOrderItems || []),
        createDeprecatedConsumableOrderItemDraft(product),
      ],
    }))
    setProductValue('')
    setError(null)
  }

  function addConsumablesOrderItem(consumablesOrder: ConsumablesOrder, orderItem: ConsumablesOrderItem) {
    if (hasDeprecatedConsumableOrderItem(draft, orderItem)) {
      setError(t('Позицію вже додано до списання'))
      return
    }

    setDraft((current) => ({
      ...current,
      DepreciatedConsumableOrderItems: [
        ...(current.DepreciatedConsumableOrderItems || []),
        createDeprecatedConsumableOrderItemFromConsumablesOrderItem(orderItem, consumablesOrder),
      ],
    }))
    setError(null)
  }

  function updateItem(index: number, patch: Partial<DeprecatedConsumableOrderItem>) {
    setDraft((current) => ({
      ...current,
      DepreciatedConsumableOrderItems: (current.DepreciatedConsumableOrderItems || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }))
  }

  function updateItemMovement(index: number, movementNetUid: string | null) {
    const movement = movements.find((item) => getEntityValue(item) === movementNetUid) || null

    updateItem(index, {
      PaymentCostMovementOperation: createPaymentCostMovementOperation(movement),
    })
  }

  function removeItem(index: number) {
    setDraft((current) => ({
      ...current,
      DepreciatedConsumableOrderItems: (current.DepreciatedConsumableOrderItems || []).filter(
        (_item, itemIndex) => itemIndex !== index,
      ),
    }))
  }

  async function handleSave() {
    if (isSaving) {
      return
    }

    const validationError = validateDeprecatedConsumableOrderDraft(draft, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = normalizeDeprecatedConsumableOrderPayload(draft, storage)

      if (isEditMode) {
        await updateDeprecatedConsumableOrder(payload, expensiveFirst)
      } else {
        await createDeprecatedConsumableOrder(payload, expensiveFirst)
      }

      notifications.show({
        color: 'green',
        message: isEditMode ? t('Списання оновлено') : t('Списання створено'),
      })
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти списання'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened size="80vw" title={isEditMode ? t('Редагувати списання') : t('Списати зі складу')} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Select
            clearable
            data={toEntityOptions(users, draft.CommissionHead)}
            disabled={isSaving}
            label={t('Голова комісії')}
            searchable
            searchValue={headSearch}
            value={getEntityValue(draft.CommissionHead) || null}
            onChange={(value) => {
              const selectedUser = findEntityByValue(users, draft.CommissionHead, value)
              updateDraft({ CommissionHead: selectedUser })
              setHeadSearch(getEntityName(selectedUser) || '')
            }}
            onSearchChange={(value) => handleUserSearch(value, setHeadSearch)}
          />
          <Select
            clearable
            data={toEntityOptions(users, draft.DepreciatedTo)}
            disabled={isSaving}
            label={t('Кому списано')}
            searchable
            searchValue={depreciatedToSearch}
            value={getEntityValue(draft.DepreciatedTo) || null}
            onChange={(value) => {
              const selectedUser = findEntityByValue(users, draft.DepreciatedTo, value)
              updateDraft({ DepreciatedTo: selectedUser })
              setDepreciatedToSearch(getEntityName(selectedUser) || '')
            }}
            onSearchChange={(value) => handleUserSearch(value, setDepreciatedToSearch)}
          />
        </SimpleGrid>

        <Textarea
          autosize
          disabled={isSaving}
          label={t('Коментар')}
          minRows={2}
          value={draft.Comment || ''}
          onChange={(event) => updateDraft({ Comment: event.currentTarget.value })}
        />

        {!isEditMode && (
          <Stack gap="sm">
            <Checkbox
              checked={expensiveFirst}
              disabled={isSaving}
              label={t('Спочатку дорожчі партії')}
              onChange={(event) => setExpensiveFirst(event.currentTarget.checked)}
            />
            <Tabs value={entryMode} onChange={(value) => setEntryMode(value === 'orders' ? 'orders' : 'products')}>
              <Tabs.List>
                <Tabs.Tab value="products">{t('По товару')}</Tabs.Tab>
                <Tabs.Tab value="orders">{t('По накладних')}</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel pt="md" value="products">
                <Group align="end" gap="sm" wrap="wrap">
                  <Select
                    clearable
                    data={productOptions}
                    disabled={isSaving}
                    label={t('Товар')}
                    placeholder={t('Оберіть товар із залишків')}
                    searchable
                    value={productValue || null}
                    w={{ base: '100%', md: 520 }}
                    onChange={(value) => setProductValue(value || '')}
                  />
                  <Button
                    disabled={!productValue || isSaving}
                    leftSection={<IconPlus size={16} />}
                    variant="light"
                    onClick={addSelectedProduct}
                  >
                    {t('Додати')}
                  </Button>
                </Group>
              </Tabs.Panel>

              <Tabs.Panel pt="md" value="orders">
                <ConsumablesOrderItemsPicker
                  isSaving={isSaving}
                  orders={consumableOrders}
                  selectedItems={draft.DepreciatedConsumableOrderItems || []}
                  onAdd={addConsumablesOrderItem}
                />
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}

        <DeprecatedConsumableOrderItemsTable
          isSaving={isSaving}
          items={draft.DepreciatedConsumableOrderItems || []}
          movements={movements}
          onMovementSearch={handleMovementSearch}
          onRemove={removeItem}
          onUpdate={updateItem}
          onUpdateMovement={updateItemMovement}
        />

        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} leftSection={<IconX size={16} />} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={handleSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function ConsumablesOrderItemsPicker({
  isSaving,
  orders,
  selectedItems,
  onAdd,
}: {
  isSaving: boolean
  orders: ConsumablesOrder[]
  selectedItems: DeprecatedConsumableOrderItem[]
  onAdd: (order: ConsumablesOrder, item: ConsumablesOrderItem) => void
}) {
  const { t } = useI18n()
  const rows = useMemo(
    () =>
      orders.flatMap((order, orderIndex) =>
        (order.ConsumablesOrderItems || []).map((item, itemIndex) => ({
          id: `${order.NetUid || order.Id || orderIndex}-${getConsumablesOrderItemKey(item, itemIndex)}`,
          item,
          order,
        })),
      ),
    [orders],
  )

  if (rows.length === 0) {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
        {t('Приходних накладних з позиціями на цьому складі не знайдено')}
      </Alert>
    )
  }

  return (
    <Table.ScrollContainer minWidth={980}>
      <Table highlightOnHover withColumnBorders withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Накладна')}</Table.Th>
            <Table.Th>{t('Дата')}</Table.Th>
            <Table.Th>{t('Артикул')}</Table.Th>
            <Table.Th>{t('Назва')}</Table.Th>
            <Table.Th>{t('Кількість')}</Table.Th>
            <Table.Th>{t('Ціна')}</Table.Th>
            <Table.Th>{t('Сума')}</Table.Th>
            <Table.Th>{t('Валюта')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ id, item, order }) => {
            const product = item.ConsumableProduct
            const selected = hasDeprecatedConsumableOrderItem({ DepreciatedConsumableOrderItems: selectedItems }, item)

            return (
              <Table.Tr key={id}>
                <Table.Td>{displayValue(order.OrganizationNumber || order.Number)}</Table.Td>
                <Table.Td>{formatDateTime(order.OrganizationFromDate || order.Created)}</Table.Td>
                <Table.Td>{displayValue(product?.VendorCode || product?.Article)}</Table.Td>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {displayValue(product?.Name)}
                  </Text>
                </Table.Td>
                <Table.Td>{formatAmount(item.Qty)}</Table.Td>
                <Table.Td>{formatMoney(item.PricePerItem)}</Table.Td>
                <Table.Td>{formatMoney(item.TotalPrice)}</Table.Td>
                <Table.Td>{displayValue(getConsumablesOrderItemCurrency(item, order)?.Name || getConsumablesOrderItemCurrency(item, order)?.Code)}</Table.Td>
                <Table.Td>
                  <Button
                    disabled={isSaving || selected}
                    leftSection={<IconPlus size={14} />}
                    size="xs"
                    variant="light"
                    onClick={() => onAdd(order, item)}
                  >
                    {selected ? t('Додано') : t('Додати')}
                  </Button>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function DeprecatedConsumableOrderItemsTable({
  isSaving,
  items,
  movements,
  onMovementSearch,
  onRemove,
  onUpdate,
  onUpdateMovement,
}: {
  isSaving: boolean
  items: DeprecatedConsumableOrderItem[]
  movements: PaymentCostMovement[]
  onMovementSearch: (value: string) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, patch: Partial<DeprecatedConsumableOrderItem>) => void
  onUpdateMovement: (index: number, movementNetUid: string | null) => void
}) {
  const { t } = useI18n()

  if (items.length === 0) {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
        {t('Додайте хоча б одну позицію для списання')}
      </Alert>
    )
  }

  return (
    <Table.ScrollContainer minWidth={980}>
      <Table highlightOnHover withColumnBorders withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Артикул')}</Table.Th>
            <Table.Th>{t('Назва')}</Table.Th>
            <Table.Th>{t('Доступно')}</Table.Th>
            <Table.Th>{t('Кількість')}</Table.Th>
            <Table.Th>{t('Ціна')}</Table.Th>
            <Table.Th>{t('Сума')}</Table.Th>
            <Table.Th>{t('Валюта')}</Table.Th>
            <Table.Th>{t('Стаття витрат')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, index) => {
            const product = item.ConsumablesOrderItem?.ConsumableProduct
            const movement = getDeprecatedItemPaymentCostMovement(item)

            return (
              <Table.Tr key={getDeprecatedOrderItemKey(item, index)}>
                <Table.Td>{displayValue(product?.VendorCode || product?.Article)}</Table.Td>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {displayValue(product?.Name)}
                  </Text>
                </Table.Td>
                <Table.Td>{formatAmount(getDeprecatedItemAvailableQty(item))}</Table.Td>
                <Table.Td>
                  <NumberInput
                    allowNegative={false}
                    decimalScale={3}
                    disabled={isSaving}
                    min={0}
                    value={item.Qty || 0}
                    w={120}
                    onChange={(value) => onUpdate(index, { Qty: toNumber(value) })}
                  />
                </Table.Td>
                <Table.Td>{formatMoney(getDeprecatedItemPrice(item))}</Table.Td>
                <Table.Td>{formatMoney(getDeprecatedItemTotal(item))}</Table.Td>
                <Table.Td>{displayValue(getDeprecatedItemCurrency(item)?.Name || getDeprecatedItemCurrency(item)?.Code)}</Table.Td>
                <Table.Td>
                  <Select
                    clearable
                    data={toPaymentCostMovementOptions(movements, movement)}
                    disabled={isSaving}
                    searchable
                    value={getEntityValue(movement) || null}
                    w={260}
                    onChange={(value) => onUpdateMovement(index, value)}
                    onSearchChange={onMovementSearch}
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip label={t('Видалити')}>
                    <ActionIcon
                      aria-label={t('Видалити')}
                      color="red"
                      disabled={isSaving}
                      size="sm"
                      variant="subtle"
                      onClick={() => onRemove(index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function DeleteDeprecatedConsumableOrderModal({
  isSaving,
  onClose,
  onDelete,
  order,
}: {
  isSaving: boolean
  onClose: () => void
  onDelete: () => void
  order: DeprecatedConsumableOrder | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(order)} title={t('Видалити списання')} onClose={onClose}>
      <Stack gap="md">
        <Text>{order ? t('Списання "{number}" буде видалено.', { number: displayValue(order.Number) }) : ''}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={onDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function DeleteStorageModal({
  isSaving,
  onClose,
  onDelete,
  storage,
}: {
  isSaving: boolean
  onClose: () => void
  onDelete: () => void
  storage: ConsumablesStorage | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(storage)} title={t('Видалити склад')} onClose={onClose}>
      <Stack gap="md">
        <Text>{storage ? t('Склад "{name}" буде видалено.', { name: displayValue(storage.Name) }) : ''}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={onDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.LastName || entity?.FullName || entity?.Name || entity?.Code
}

function flattenDeprecatedConsumableOrders(orders: DeprecatedConsumableOrder[]): DeprecatedConsumableOrderRow[] {
  return orders.flatMap((order, orderIndex) => {
    const items = order.DepreciatedConsumableOrderItems || []

    if (items.length === 0) {
      return [
        {
          id: String(order.NetUid || order.Id || orderIndex),
          order,
        },
      ]
    }

    return items.map((item, itemIndex) => ({
      id: `${order.NetUid || order.Id || orderIndex}-${item.NetUid || item.Id || itemIndex}`,
      item,
      order,
    }))
  })
}

function getPaymentCostMovementName(item?: DeprecatedConsumableOrderItem): string | undefined {
  const operation = item?.PaymentCostMovementOperation

  return (
    operation?.PaymentCostMovement?.OperationName ||
    operation?.DepreciatedConsumableOrderItem?.PaymentCostMovementOperation?.PaymentCostMovement?.OperationName
  )
}

function createDeprecatedConsumableOrderDraft(storage: ConsumablesStorage): DeprecatedConsumableOrder {
  return {
    Comment: '',
    ConsumablesStorage: storage,
    DepreciatedConsumableOrderItems: [],
  }
}

function normalizeDeprecatedOrderForEditing(
  order: DeprecatedConsumableOrder,
  storage: ConsumablesStorage,
): DeprecatedConsumableOrder {
  return {
    ...order,
    ConsumablesStorage: order.ConsumablesStorage || storage,
    DepreciatedConsumableOrderItems: (order.DepreciatedConsumableOrderItems || []).map((item) => ({
      ...item,
      PaymentCostMovementOperation: normalizePaymentCostMovementOperation(item.PaymentCostMovementOperation),
    })),
  }
}

function normalizeDeprecatedConsumableOrderPayload(
  draft: DeprecatedConsumableOrder,
  storage: ConsumablesStorage,
): DeprecatedConsumableOrder {
  return {
    ...draft,
    Comment: draft.Comment?.trim(),
    ConsumablesStorage: storage,
    DepreciatedConsumableOrderItems: (draft.DepreciatedConsumableOrderItems || []).map((item) => {
      const movement = getDeprecatedItemPaymentCostMovement(item)
      const qty = item.Qty || 0

      return {
        ...item,
        Currency: getDeprecatedItemCurrency(item),
        PaymentCostMovementOperation: createPaymentCostMovementOperation(movement),
        Qty: qty,
        TotalPrice: getDeprecatedItemTotal({ ...item, Qty: qty }),
      }
    }),
  }
}

function createDeprecatedConsumableOrderItemDraft(product: ConsumableProduct): DeprecatedConsumableOrderItem {
  const availableQty = getProductAvailableQty(product)
  const qty = availableQty && availableQty > 0 ? 1 : 0
  const consumablesOrderItem: ConsumablesOrderItem = {
    ConsumableProduct: product,
    Currency: product.Currency,
    PaymentCostMovementOperation: null,
    PricePerItem: product.PricePerItem || product.WorthPrice || 0,
    Qty: availableQty || undefined,
    TotalPrice: product.WorthPrice,
  }

  return {
    ConsumablesOrderItem: consumablesOrderItem,
    Currency: product.Currency,
    PaymentCostMovementOperation: createPaymentCostMovementOperation(null),
    Qty: qty,
    TotalPrice: roundMoney((product.PricePerItem || product.WorthPrice || 0) * qty),
  }
}

function createDeprecatedConsumableOrderItemFromConsumablesOrderItem(
  orderItem: ConsumablesOrderItem,
  order: ConsumablesOrder,
): DeprecatedConsumableOrderItem {
  const qty = orderItem.Qty && orderItem.Qty > 0 ? orderItem.Qty : 0
  const currency = getConsumablesOrderItemCurrency(orderItem, order)

  return {
    ConsumablesOrderItem: {
      ...orderItem,
      Currency: orderItem.Currency || currency,
      SupplyOrganizationAgreement: orderItem.SupplyOrganizationAgreement || order.SupplyOrganizationAgreement || null,
    },
    Currency: currency,
    PaymentCostMovementOperation: createPaymentCostMovementOperation(
      orderItem.PaymentCostMovementOperation?.PaymentCostMovement || null,
    ),
    Qty: qty,
    TotalPrice: roundMoney((orderItem.PricePerItem || 0) * qty),
  }
}

function hasDeprecatedConsumableOrderItem(
  order: Pick<DeprecatedConsumableOrder, 'DepreciatedConsumableOrderItems'>,
  orderItem: ConsumablesOrderItem,
): boolean {
  const orderItemKey = getEntityValue(orderItem)
  const productKey = getEntityValue(orderItem.ConsumableProduct)

  return (order.DepreciatedConsumableOrderItems || []).some((item) => {
    const selectedOrderItem = item.ConsumablesOrderItem

    if (orderItemKey && getEntityValue(selectedOrderItem) === orderItemKey) {
      return true
    }

    return Boolean(productKey && getEntityValue(selectedOrderItem?.ConsumableProduct) === productKey)
  })
}

function validateDeprecatedConsumableOrderDraft(
  draft: DeprecatedConsumableOrder,
  t: (value: string) => string,
): string | null {
  const items = draft.DepreciatedConsumableOrderItems || []

  if (items.length === 0) {
    return t('Додайте хоча б одну позицію для списання')
  }

  if (!draft.DepreciatedTo) {
    return t('Оберіть отримувача списання')
  }

  for (const item of items) {
    if (!item.ConsumablesOrderItem?.ConsumableProduct) {
      return t('У списанні є позиція без товару')
    }

    if (!item.Qty || item.Qty <= 0) {
      return t('Вкажіть кількість для кожної позиції')
    }

    if (!getDeprecatedItemPaymentCostMovement(item)) {
      return t('Оберіть статтю витрат для кожної позиції')
    }
  }

  return null
}

function collectDeprecatedOrderUsers(order: DeprecatedConsumableOrder): UserProfile[] {
  return [order.CommissionHead, order.DepreciatedTo, order.CreatedBy].filter(
    (user): user is UserProfile => Boolean(user),
  )
}

function collectDeprecatedOrderMovements(order: DeprecatedConsumableOrder): PaymentCostMovement[] {
  return (order.DepreciatedConsumableOrderItems || [])
    .map(getDeprecatedItemPaymentCostMovement)
    .filter((movement): movement is PaymentCostMovement => Boolean(movement))
}

function getDeprecatedItemPaymentCostMovement(
  item: DeprecatedConsumableOrderItem,
): PaymentCostMovement | null {
  return (
    item.PaymentCostMovementOperation?.PaymentCostMovement ||
    item.PaymentCostMovementOperation?.DepreciatedConsumableOrderItem?.PaymentCostMovementOperation?.PaymentCostMovement ||
    item.ConsumablesOrderItem?.PaymentCostMovementOperation?.PaymentCostMovement ||
    null
  )
}

function createPaymentCostMovementOperation(
  movement: PaymentCostMovement | null,
): PaymentCostMovementOperation {
  return {
    PaymentCostMovement: movement,
  }
}

function normalizePaymentCostMovementOperation(
  operation: PaymentCostMovementOperation | null | undefined,
): PaymentCostMovementOperation | null {
  if (!operation) {
    return createPaymentCostMovementOperation(null)
  }

  return {
    ...operation,
    PaymentCostMovement:
      operation.PaymentCostMovement ||
      operation.DepreciatedConsumableOrderItem?.PaymentCostMovementOperation?.PaymentCostMovement ||
      null,
  }
}

function getDeprecatedOrderItemKey(item: DeprecatedConsumableOrderItem, index: number): string {
  return String(
    item.NetUid ||
      item.Id ||
      item.ConsumablesOrderItem?.NetUid ||
      item.ConsumablesOrderItem?.ConsumableProduct?.NetUid ||
      index,
  )
}

function getDeprecatedOrderEditorKey(order: DeprecatedConsumableOrder): string {
  return String(order.NetUid || order.Id || 'new')
}

function getDeprecatedItemPrice(item: DeprecatedConsumableOrderItem): number | undefined {
  return item.ConsumablesOrderItem?.PricePerItem || item.ConsumablesOrderItem?.ConsumableProduct?.PricePerItem
}

function getDeprecatedItemCurrency(item: DeprecatedConsumableOrderItem): NamedEntity | null | undefined {
  return (
    item.Currency ||
    item.ConsumablesOrderItem?.Currency ||
    item.ConsumablesOrderItem?.SupplyOrganizationAgreement?.Currency ||
    item.ConsumablesOrderItem?.ConsumableProduct?.Currency
  )
}

function getDeprecatedItemTotal(item: DeprecatedConsumableOrderItem): number | undefined {
  const price = getDeprecatedItemPrice(item)

  if (price && item.Qty) {
    return roundMoney(price * item.Qty)
  }

  return item.TotalPrice
}

function getProductAvailableQty(product: ConsumableProduct | null | undefined): number | undefined {
  return product?.SpecificationQty ?? product?.TotalQty
}

function getDeprecatedItemAvailableQty(item: DeprecatedConsumableOrderItem): number | undefined {
  return item.ConsumablesOrderItem?.Qty ?? getProductAvailableQty(item.ConsumablesOrderItem?.ConsumableProduct)
}

function getConsumablesOrderItemCurrency(
  item: ConsumablesOrderItem,
  order: ConsumablesOrder,
): NamedEntity | null | undefined {
  return item.Currency || item.SupplyOrganizationAgreement?.Currency || order.SupplyOrganizationAgreement?.Currency || item.ConsumableProduct?.Currency
}

function getConsumablesOrderItemKey(item: ConsumablesOrderItem, index: number): string {
  return String(item.NetUid || item.Id || item.ConsumableProduct?.NetUid || item.ConsumableProduct?.Id || index)
}

function getProductLabel(product: ConsumableProduct): string {
  const article = product.VendorCode || product.Article

  return [article, product.Name].filter(Boolean).join(' - ') || getEntityValue(product)
}

function toEntityOptions<T extends NamedEntity>(
  entities: T[],
  selectedEntity?: T | null,
): Array<{ label: string; value: string }> {
  return mergeEntities(selectedEntity ? [...entities, selectedEntity] : entities, []).reduce<
    Array<{ label: string; value: string }>
  >((acc, entity) => {
    const option = {
      label: getEntityName(entity) || getEntityValue(entity),
      value: getEntityValue(entity),
    }

    if (option.value) {
      acc.push(option)
    }

    return acc
  }, [])
}

function toPaymentCostMovementOptions(
  movements: PaymentCostMovement[],
  selectedMovement?: PaymentCostMovement | null,
): Array<{ label: string; value: string }> {
  return mergeEntities(selectedMovement ? [...movements, selectedMovement] : movements, []).reduce<
    Array<{ label: string; value: string }>
  >((acc, movement) => {
    const option = {
      label: movement.OperationName || getEntityValue(movement),
      value: getEntityValue(movement),
    }

    if (option.value) {
      acc.push(option)
    }

    return acc
  }, [])
}

function findEntityByValue<T extends NamedEntity>(
  entities: T[],
  selectedEntity: T | null | undefined,
  value: string | null,
): T | null {
  if (!value) {
    return null
  }

  return mergeEntities(selectedEntity ? [...entities, selectedEntity] : entities, []).find(
    (entity) => getEntityValue(entity) === value,
  ) || null
}

function mergeEntities<T extends NamedEntity>(current: T[], next: T[]): T[] {
  const entitiesByKey = new Map<string, T>()

  current.forEach((entity) => {
    const value = getEntityValue(entity)

    if (value) {
      entitiesByKey.set(value, entity)
    }
  })
  next.forEach((entity) => {
    const value = getEntityValue(entity)

    if (value) {
      entitiesByKey.set(value, entity)
    }
  })

  return Array.from(entitiesByKey.values())
}

function getEntityValue(entity?: NamedEntity | null): string {
  if (!entity) {
    return ''
  }

  return entity.NetUid || (entity.Id ? String(entity.Id) : '') || entity.Code || entity.Name || ''
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
