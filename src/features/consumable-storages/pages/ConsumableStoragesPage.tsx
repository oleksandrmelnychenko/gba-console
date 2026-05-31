import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconEye, IconPencil, IconPlus, IconRefresh, IconRestore, IconSearch, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PermissionGate } from '../../auth/components/PermissionGate'
import {
  deleteConsumableStorage,
  getDeprecatedConsumableOrders,
  getConsumableStorages,
  searchConsumableStorages,
} from '../api/consumableStoragesApi'
import {
  CONSUMABLE_STORAGE_CREATE_PERMISSION,
  CONSUMABLE_STORAGE_DELETE_PERMISSION,
  CONSUMABLE_STORAGE_EDIT_PERMISSION,
} from '../permissions'
import type { ConsumableProduct, ConsumablesStorage, DeprecatedConsumableOrder, DeprecatedConsumableOrderItem, NamedEntity } from '../types'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['delete', 'actions'],
  },
  density: 'normal',
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
          backgroundLocation: location,
          nodeTitle: storage.Name,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

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
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder={t('Пошук')}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
              style={{ flex: '1 1 auto', minWidth: 180 }}
            />
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                loading={isLoading}
                style={{ flex: '0 0 auto' }}
                variant="light"
                onClick={reload}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <PermissionGate permissionKey={CONSUMABLE_STORAGE_CREATE_PERMISSION}>
              <Button
                color="violet"
                leftSection={<IconPlus size={16} />}
                style={{ flex: '0 0 auto' }}
                onClick={() =>
                  navigate('/accounting/storages/new', {
                    state: {
                      backgroundLocation: location,
                      returnPath: `${location.pathname}${location.search}`,
                    },
                  })
                }
              >
                {t('Новий склад')}
              </Button>
            </PermissionGate>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Group gap="xs">
            <Badge color="violet" variant="light">
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
            layoutVersion="consumable-storages-1"
            tableId="consumable-storages"
            onRowClick={setSelectedStorage}
          />
        </Stack>
      </Card>

      <ConsumableStorageDetailDrawer storage={selectedStorage} onClose={() => setSelectedStorage(null)} />
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
        minWidth: 240,
        accessor: (storage) => storage.Name,
        cell: (storage) => <Text fw={600}>{displayValue(storage.Name)}</Text>,
      },
      {
        id: 'description',
        header: t('Опис'),
        width: 260,
        minWidth: 180,
        accessor: (storage) => storage.Description,
        cell: (storage) => displayValue(storage.Description),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 190,
        minWidth: 150,
        accessor: (storage) => getEntityName(storage.ResponsibleUser),
        cell: (storage) => displayValue(getEntityName(storage.ResponsibleUser)),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 210,
        minWidth: 160,
        accessor: (storage) => getEntityName(storage.Organization),
        cell: (storage) => displayValue(getEntityName(storage.Organization)),
      },
      {
        id: 'products',
        header: t('Позицій'),
        width: 100,
        minWidth: 90,
        align: 'right',
        accessor: (storage) => storage.ConsumableProducts?.length || 0,
        cell: (storage) => String(storage.ConsumableProducts?.length || 0),
      },
      {
        id: 'delete',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (storage) => (
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
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 96,
        minWidth: 86,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (storage) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
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

function ConsumableStorageDetailDrawer({ storage, onClose }: { storage: ConsumablesStorage | null; onClose: () => void }) {
  const { t } = useI18n()
  const products = storage?.ConsumableProducts || []
  const totals = storage?.PriceTotals || []

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
              <DeprecatedConsumableOrdersPanel storage={storage} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </AppDrawer>
  )
}

function StorageRemnantsPanel({ products, totals }: { products: ConsumableProduct[]; totals: ConsumablesStorage['PriceTotals'] }) {
  const { t } = useI18n()
  const columns = useStorageRemnantColumns()

  return (
    <Stack gap="md">
      <DataTable
        columns={columns}
        data={products}
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
          {totals.map((total, index) => (
            <SimpleGrid key={`${total.Currency?.Code || total.Currency?.Name || 'total'}-${index}`} cols={{ base: 1, sm: 3 }}>
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
        cell: (product) => formatAmount(product.SpecificationQty ?? product.TotalQty),
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
        accessor: (product) => product.WorthPrice ?? product.PricePerItem,
        cell: (product) => formatMoney(product.WorthPrice ?? product.PricePerItem),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 130,
        minWidth: 112,
        accessor: (product) => product.Currency?.Name || product.Currency?.Code,
        cell: (product) => displayValue(product.Currency?.Name || product.Currency?.Code),
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

function DeprecatedConsumableOrdersPanel({ storage }: { storage: ConsumablesStorage }) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [orders, setOrders] = useValueState<DeprecatedConsumableOrder[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, DEPRECATED_SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const requestRef = useRef(0)
  const storageNetId = storage.NetUid || ''
  const rows = useMemo(() => flattenDeprecatedConsumableOrders(orders), [orders])
  const columns = useDeprecatedConsumableOrderColumns()

  useEffect(() => {
    if (!storageNetId) {
      setOrders([])
      setLoading(false)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    async function loadOrders() {
      try {
        const nextOrders = await getDeprecatedConsumableOrders({
          from: fromDate,
          storageNetId,
          to: toDate,
          value: normalizedSearchValue || undefined,
        })

        if (requestRef.current === requestId) {
          setOrders(nextOrders)
        }
      } catch (loadError) {
        if (requestRef.current === requestId) {
          setOrders([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити списані товари'))
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    void loadOrders()
  }, [fromDate, normalizedSearchValue, setError, setLoading, setOrders, storageNetId, t, toDate])

  function resetFilters() {
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
    setSearchValue('')
  }

  return (
    <Stack gap="md">
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
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={DEPRECATED_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Списаних товарів не знайдено')}
        getRowId={(row) => row.id}
        isLoading={isLoading || isSearchSettling}
        layoutVersion="consumable-storage-deprecated-orders-1"
        maxHeight={420}
        minWidth={1180}
        tableId="consumable-storage-deprecated-orders"
      />
    </Stack>
  )
}

function useDeprecatedConsumableOrderColumns(): DataTableColumn<DeprecatedConsumableOrderRow>[] {
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
    ],
    [t],
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

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
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
