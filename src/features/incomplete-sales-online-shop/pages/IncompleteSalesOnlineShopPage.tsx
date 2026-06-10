import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconCircleCheck,
  IconEye,
  IconReceipt,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconUserPlus,
} from '@tabler/icons-react'
import { type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getIncompleteSales, updateIncompleteSale } from '../../clients/api/onlineShopClientsApi'
import { IncompleteSaleItemsList } from '../../clients/components/IncompleteSaleItemsList'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout, DataTableDensity } from '../../../shared/ui/data-table/types'
import type { RetailCartItem } from '../../clients/onlineShopTypes'
import type { SaleOrderItem } from '../../clients/salesTypes'
import type {
  IncompleteSalesOnlineShopFilter,
  IncompleteSalesOnlineShopItem,
  IncompleteSalesOnlineShopStatus,
} from '../types'
import {
  displayValue,
  formatIncompleteSaleDate,
  getIncompleteSaleCreatedTime,
  getIncompleteSaleKey,
  getIncompleteSaleProductCount,
  getIncompleteSaleResponsibleName,
  getIncompleteSaleStatus,
  getIncompleteSaleStatusLabel,
  getRetailClientName,
  getRetailClientNetUid,
  getRetailClientPhone,
} from '../utils'

type FilterDraft = {
  from: string
  isAccepted: boolean
  number: string
  to: string
}

type PendingStatusAction = {
  sale: IncompleteSalesOnlineShopItem
  status: 1 | 2
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function createDefaultFilterDraft(): FilterDraft {
  const today = toDateInputValue(new Date())

  return {
    from: today,
    isAccepted: false,
    number: '',
    to: today,
  }
}

function toIncompleteSalesFilter(draft: FilterDraft): IncompleteSalesOnlineShopFilter {
  const number = draft.number.trim()

  return {
    from: draft.from || undefined,
    isAccepted: draft.isAccepted,
    number: number.length > 6 ? number : undefined,
    to: draft.to || undefined,
  }
}

const INCOMPLETE_SALES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'client'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const STATUS_COLORS: Record<IncompleteSalesOnlineShopStatus, string> = {
  0: 'gray',
  1: 'yellow',
  2: 'green',
}

function useIncompleteSalesOnlineShopPageModel() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [sales, setSales] = useValueState<IncompleteSalesOnlineShopItem[]>([])
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(createDefaultFilterDraft)
  const [activeFilters, setActiveFilters] = useValueState<IncompleteSalesOnlineShopFilter>(() => toIncompleteSalesFilter(createDefaultFilterDraft()))
  const [error, setError] = useValueState<string | null>(null)
  const [detailError, setDetailError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [selectedSale, setSelectedSale] = useValueState<IncompleteSalesOnlineShopItem | null>(null)
  const [pendingStatusAction, setPendingStatusAction] = useValueState<PendingStatusAction | null>(null)
  const [updatingId, setUpdatingId] = useValueState<string | null>(null)
  const { density, toggleDensity } = useDataTableDensity('incomplete-sales-online-shop', 'normal')

  useEffect(() => {
    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const nextSales = await getIncompleteSales(activeFilters)

        if (!cancelled) {
          setSales(nextSales as IncompleteSalesOnlineShopItem[])
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSales()

    return () => {
      cancelled = true
    }
  }, [activeFilters, reloadKey, setError, setLoading, setSales, t])

  const openDetail = useCallback((sale: IncompleteSalesOnlineShopItem) => {
    setSelectedSale(sale)
    setDetailError(null)
  }, [setDetailError, setSelectedSale])

  const closeDetail = useCallback(() => {
    setSelectedSale(null)
    setDetailError(null)
  }, [setDetailError, setSelectedSale])

  const openClientSales = useCallback((sale: IncompleteSalesOnlineShopItem) => {
    const netUid = getRetailClientNetUid(sale.RetailClient)

    if (netUid) {
      window.open(`/clients-online-shop/client/${netUid}`, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const columns = useIncompleteSalesOnlineShopColumns({
    onOpenClientSales: openClientSales,
    onOpenDetail: openDetail,
    onStatusAction: setPendingStatusAction,
    updatingId,
    user,
  })

  const activeFilterText = useMemo(() => {
    const parts = [
      activeFilters.from ? `${t('з')} ${activeFilters.from}` : '',
      activeFilters.to ? `${t('по')} ${activeFilters.to}` : '',
      activeFilters.number ? `${t('номер')}: ${activeFilters.number}` : '',
      activeFilters.isAccepted ? t('тільки мої') : '',
    ].filter(Boolean)

    return parts.join(', ')
  }, [activeFilters, t])

  const toolbarLeft = useMemo(
    () =>
      activeFilterText ? (
        <Text size="xs" c="dimmed">
          {activeFilterText}
        </Text>
      ) : null,
    [activeFilterText],
  )

  const isConfirming = Boolean(
    pendingStatusAction && updatingId === getIncompleteSaleKey(pendingStatusAction.sale),
  )

  function applyFilters(nextDraft: FilterDraft) {
    setFilterDraft(nextDraft)

    const number = nextDraft.number.trim()

    if (number.length > 0 && number.length <= 6) {
      return
    }

    if (nextDraft.from && nextDraft.to && nextDraft.from > nextDraft.to) {
      return
    }

    setSelectedSale(null)
    setActiveFilters(toIncompleteSalesFilter(nextDraft))
  }

  function resetFilters() {
    const defaultDraft = createDefaultFilterDraft()

    closeDetail()
    setFilterDraft(defaultDraft)
    setActiveFilters(toIncompleteSalesFilter(defaultDraft))
    reload()
  }

  function reloadSales() {
    reload()
  }

  async function confirmStatusAction() {
    if (!pendingStatusAction) {
      return
    }

    const { sale, status } = pendingStatusAction
    let nextSale: IncompleteSalesOnlineShopItem

    if (status === 1) {
      if (!user || user.Id == null) {
        notifications.show({ color: 'red', message: t('Користувача не визначено') })
        setPendingStatusAction(null)
        return
      }

      nextSale = {
        ...sale,
        MisplacedSaleStatus: 1,
        User: user,
        UserId: user.Id,
      }
    } else {
      nextSale = {
        ...sale,
        MisplacedSaleStatus: 2,
      }
    }

    const rowKey = getIncompleteSaleKey(sale)

    setUpdatingId(rowKey)

    try {
      const updatedSales = (await updateIncompleteSale(nextSale)) as IncompleteSalesOnlineShopItem[]
      const updatedSale = findSaleByKey(updatedSales, rowKey) || nextSale

      if (updatedSales.length > 0) {
        setSales((currentSales) => replaceSaleByKey(currentSales, rowKey, updatedSale))
        setSelectedSale((currentSale) => syncSelectedSale(currentSale, updatedSales, rowKey, updatedSale))
      } else {
        setSales((currentSales) => replaceSaleByKey(currentSales, rowKey, nextSale))
        setSelectedSale((currentSale) =>
          currentSale && getIncompleteSaleKey(currentSale) === rowKey ? nextSale : currentSale,
        )
      }

      notifications.show({
        color: 'green',
        message: status === 1 ? t('Продаж закріплено') : t('Продаж виконано'),
      })
      setPendingStatusAction(null)
    } catch (updateError) {
      notifications.show({
        color: 'red',
        message: updateError instanceof Error ? updateError.message : t('Не вдалося оновити продаж'),
      })
    } finally {
      setUpdatingId(null)
    }
  }

  return {
    columns,
    density,
    detailError,
    error,
    filterDraft,
    isConfirming,
    isLoading,
    pendingStatusAction,
    sales,
    selectedSale,
    toolbarLeft,
    toggleDensity,
    closeDetail,
    confirmStatusAction,
    openClientSales,
    openDetail,
    reloadSales,
    resetFilters,
    applyFilters,
    setPendingStatusAction,
  }
}

export function IncompleteSalesOnlineShopPage() {
  const model = useIncompleteSalesOnlineShopPageModel()

  return <IncompleteSalesOnlineShopPageView model={model} />
}

function IncompleteSalesOnlineShopPageView({
  model,
}: {
  model: ReturnType<typeof useIncompleteSalesOnlineShopPageModel>
}) {
  const {
    columns,
    density,
    detailError,
    error,
    filterDraft,
    isConfirming,
    isLoading,
    pendingStatusAction,
    sales,
    selectedSale,
    toolbarLeft,
    toggleDensity,
    closeDetail,
    confirmStatusAction,
    openClientSales,
    openDetail,
    reloadSales,
    resetFilters,
    applyFilters,
    setPendingStatusAction,
  } = model

  return (
    <Stack gap="lg">
      <IncompleteSalesTableCard
        columns={columns}
        density={density}
        error={error}
        filterDraft={filterDraft}
        isLoading={isLoading}
        sales={sales}
        toolbarLeft={toolbarLeft}
        onFromChange={(from) => applyFilters({ ...filterDraft, from })}
        onNumberChange={(number) => applyFilters({ ...filterDraft, number })}
        onOpenDetail={openDetail}
        onReload={reloadSales}
        onReset={resetFilters}
        onToChange={(to) => applyFilters({ ...filterDraft, to })}
        onToggleAccepted={(isAccepted) => applyFilters({ ...filterDraft, isAccepted })}
        onToggleDensity={toggleDensity}
      />

      <IncompleteSaleDetailDrawer
        detailError={detailError}
        sale={selectedSale}
        onClose={closeDetail}
        onOpenClientSales={openClientSales}
      />

      <IncompleteSaleStatusModal
        isConfirming={isConfirming}
        pendingStatusAction={pendingStatusAction}
        onClose={() => setPendingStatusAction(null)}
        onConfirm={confirmStatusAction}
      />
    </Stack>
  )
}

function IncompleteSalesTableCard({
  columns,
  density,
  error,
  filterDraft,
  isLoading,
  sales,
  toolbarLeft,
  onFromChange,
  onNumberChange,
  onOpenDetail,
  onReload,
  onReset,
  onToChange,
  onToggleAccepted,
  onToggleDensity,
}: {
  columns: DataTableColumn<IncompleteSalesOnlineShopItem>[]
  density: DataTableDensity
  error: string | null
  filterDraft: FilterDraft
  isLoading: boolean
  sales: IncompleteSalesOnlineShopItem[]
  toolbarLeft: ReactNode
  onFromChange: (from: string) => void
  onNumberChange: (number: string) => void
  onOpenDetail: (sale: IncompleteSalesOnlineShopItem) => void
  onReload: () => void
  onReset: () => void
  onToChange: (to: string) => void
  onToggleAccepted: (isAccepted: boolean) => void
  onToggleDensity: () => void
}) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('З')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => onFromChange(event.currentTarget.value)}
          />
          <TextInput
            label={t('По')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => onToChange(event.currentTarget.value)}
          />
          <TextInput
            flex={1}
            label={t('Номер')}
            leftSection={<IconSearch size={16} />}
            placeholder={t('Телефон')}
            value={filterDraft.number}
            onChange={(event) => onNumberChange(event.currentTarget.value)}
          />
          <Checkbox
            checked={filterDraft.isAccepted}
            label={t('Тільки мої продажі')}
            mb={8}
            onChange={(event) => onToggleAccepted(event.currentTarget.checked)}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon variant="light" color="gray" size={36} aria-label={t('Скинути')} onClick={onReset}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon variant="light" color="gray" size={36} aria-label={t('Оновити')} onClick={onReload}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <DataTableDensityToggle density={density} onToggle={onToggleDensity} size={36} />
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={sales}
          defaultLayout={INCOMPLETE_SALES_TABLE_DEFAULT_LAYOUT}
          density={density}
          emptyText={t('Продажів не знайдено')}
          getRowId={(sale, index) => getIncompleteSaleKey(sale, index)}
          isLoading={isLoading}
          layoutVersion="incomplete-sales-online-shop-table-1"
          loadingText={t('Завантаження продажів')}
          maxHeight="calc(100vh - 310px)"
          minWidth={1260}
          tableId="incomplete-sales-online-shop"
          toolbarLeft={toolbarLeft}
          onRowClick={onOpenDetail}
        />
      </Stack>
    </Card>
  )
}

function IncompleteSaleDetailDrawer({
  detailError,
  sale,
  onClose,
  onOpenClientSales,
}: {
  detailError: string | null
  sale: IncompleteSalesOnlineShopItem | null
  onClose: () => void
  onOpenClientSales: (sale: IncompleteSalesOnlineShopItem) => void
}) {
  const { t } = useI18n()

  return (
    <AppDrawer opened={Boolean(sale)} position="right" size="min(760px, 100vw)" title={t('Деталі продажу')} onClose={onClose}>
      {sale && (
        <IncompleteSaleDetail
          error={detailError}
          isLoading={false}
          sale={sale}
          onOpenClientSales={onOpenClientSales}
        />
      )}
    </AppDrawer>
  )
}

function IncompleteSaleStatusModal({
  isConfirming,
  pendingStatusAction,
  onClose,
  onConfirm,
}: {
  isConfirming: boolean
  pendingStatusAction: PendingStatusAction | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      closeOnClickOutside={!isConfirming}
      closeOnEscape={!isConfirming}
      opened={Boolean(pendingStatusAction)}
      title={pendingStatusAction?.status === 1 ? t('Закріпити продаж') : t('Позначити виконаним')}
      onClose={() => {
        if (!isConfirming) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <Text size="sm">
          {pendingStatusAction?.status === 1
            ? t('Закріпити цей продаж за поточним користувачем?')
            : t('Позначити цей продаж виконаним?')}
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" disabled={isConfirming} onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" leftSection={<IconCheck size={16} />} loading={isConfirming} onClick={onConfirm}>
            {t('Підтвердити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function useIncompleteSalesOnlineShopColumns({
  onOpenClientSales,
  onOpenDetail,
  onStatusAction,
  updatingId,
  user,
}: {
  onOpenClientSales: (sale: IncompleteSalesOnlineShopItem) => void
  onOpenDetail: (sale: IncompleteSalesOnlineShopItem) => void
  onStatusAction: (action: PendingStatusAction) => void
  updatingId: string | null
  user: ReturnType<typeof useAuth>['user']
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<IncompleteSalesOnlineShopItem>[]>(
    () => [
      {
        id: 'created',
        header: 'Дата',
        width: 160,
        minWidth: 140,
        accessor: getIncompleteSaleCreatedTime,
        cell: (sale) => <Text fw={600}>{formatIncompleteSaleDate(sale)}</Text>,
      },
      {
        id: 'client',
        header: 'Клієнт',
        width: 300,
        minWidth: 240,
        accessor: (sale) => getRetailClientName(sale.RetailClient),
        cell: (sale) => (
          <>
            <Text fw={600}>{displayValue(getRetailClientName(sale.RetailClient))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(getRetailClientPhone(sale.RetailClient))}
            </Text>
          </>
        ),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 130,
        minWidth: 120,
        accessor: (sale) => getIncompleteSaleStatus(sale) ?? -1,
        cell: (sale) => {
          const status = getIncompleteSaleStatus(sale)

          return (
            <Badge color={status === null ? 'gray' : STATUS_COLORS[status]} variant="light">
              {getIncompleteSaleStatusLabel(sale)}
            </Badge>
          )
        },
      },
      {
        id: 'products',
        header: 'Товари',
        width: 100,
        minWidth: 88,
        align: 'right',
        accessor: getIncompleteSaleProductCount,
        cell: (sale) => displayValue(getIncompleteSaleProductCount(sale)),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 190,
        minWidth: 160,
        accessor: getIncompleteSaleResponsibleName,
        cell: (sale) => displayValue(getIncompleteSaleResponsibleName(sale)),
      },
      {
        id: 'actions',
        header: '',
        width: 164,
        minWidth: 164,
        maxWidth: 164,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (sale) => {
          const rowKey = getIncompleteSaleKey(sale)
          const status = getIncompleteSaleStatus(sale)
          const hasResponsible = Boolean(getIncompleteSaleResponsibleName(sale) || sale.UserId)
          const isUpdating = updatingId === rowKey
          const hasClientSales = Boolean(sale.WithSales && getRetailClientNetUid(sale.RetailClient))

          return (
            <Box onClick={(event) => event.stopPropagation()}>
              <Group gap={4} justify="center" wrap="nowrap">
                <Tooltip label={t('Деталі')}>
                  <ActionIcon color="gray" variant="subtle" aria-label={t('Деталі')} onClick={() => onOpenDetail(sale)}>
                    <IconEye size={18} />
                  </ActionIcon>
                </Tooltip>

                {hasClientSales && (
                  <Tooltip label={t('Продажі клієнта')}>
                    <ActionIcon
                      color="violet"
                      variant="subtle"
                      aria-label={t('Продажі клієнта')}
                      onClick={() => onOpenClientSales(sale)}
                    >
                      <IconReceipt size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}

                {!hasResponsible && status !== 2 && (
                  <Tooltip label={user ? t('Закріпити за собою') : t('Користувача не визначено')}>
                    <ActionIcon
                      color="violet"
                      disabled={!user || isUpdating}
                      variant="subtle"
                      aria-label={t('Закріпити за собою')}
                      onClick={() => onStatusAction({ sale, status: 1 })}
                    >
                      <IconUserPlus size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}

                {hasResponsible && status !== 2 && (
                  <Tooltip label={t('Позначити виконаним')}>
                    <ActionIcon
                      color="green"
                      disabled={isUpdating}
                      variant="subtle"
                      aria-label={t('Позначити виконаним')}
                      onClick={() => onStatusAction({ sale, status: 2 })}
                    >
                      <IconCircleCheck size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Box>
          )
        },
      },
    ],
    [onOpenClientSales, onOpenDetail, onStatusAction, t, updatingId, user],
  )
}

type IncompleteSaleDetailProps = {
  error: string | null
  isLoading: boolean
  sale: IncompleteSalesOnlineShopItem
  onOpenClientSales: (sale: IncompleteSalesOnlineShopItem) => void
}

function IncompleteSaleDetail({ error, isLoading, sale, onOpenClientSales }: IncompleteSaleDetailProps) {
  const { t } = useI18n()
  const status = getIncompleteSaleStatus(sale)
  const responsibleName = getIncompleteSaleResponsibleName(sale)
  const hasClientSales = Boolean(sale.WithSales && getRetailClientNetUid(sale.RetailClient))

  return (
    <Stack gap="md">
      {isLoading && (
        <Group justify="center" py="sm">
          <Loader color="violet" size="sm" />
          <Text size="sm" c="dimmed">
            {t('Завантаження деталей')}
          </Text>
        </Group>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <Box>
              <Text fw={700}>{displayValue(getRetailClientName(sale.RetailClient))}</Text>
              <Text size="sm" c="dimmed">
                {displayValue(getRetailClientPhone(sale.RetailClient))}
              </Text>
            </Box>
            <Badge color={status === null ? 'gray' : STATUS_COLORS[status]} variant="light">
              {getIncompleteSaleStatusLabel(sale)}
            </Badge>
          </Group>

          <Group gap="xl" wrap="wrap">
            <Box>
              <Text size="xs" c="dimmed">
                {t('Дата')}
              </Text>
              <Text size="sm">{formatIncompleteSaleDate(sale)}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                {t('Товари')}
              </Text>
              <Text size="sm">{getIncompleteSaleProductCount(sale)}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                {t('Відповідальний')}
              </Text>
              <Text size="sm">{displayValue(responsibleName)}</Text>
            </Box>
          </Group>

          {hasClientSales && (
            <Button
              mt="xs"
              variant="light"
              leftSection={<IconReceipt size={16} />}
              onClick={() => onOpenClientSales(sale)}
            >
              {t('Продажі клієнта')}
            </Button>
          )}
        </Stack>
      </Card>

      <IncompleteSaleItemsList
        emptyText={t('Товарів не знайдено')}
        items={(sale.OrderItems || []).reduce<SaleOrderItem[]>((items, item) => {
          if (item.Product) {
            items.push(toSaleOrderItem(item))
          }

          return items
        }, [])}
      />
    </Stack>
  )
}

function toSaleOrderItem(item: RetailCartItem): SaleOrderItem {
  const product = item.Product
  const user = item.User as SaleOrderItem['User']

  return {
    Id: item.Id,
    NetUid: item.NetUid,
    Created: item.Created as SaleOrderItem['Created'],
    Product: product
      ? {
          Id: product.Id,
          NetUid: product.NetUid,
          Name: product.Name,
          VendorCode: product.VendorCode,
          MainOriginalNumber: product.MainOriginalNumber,
        }
      : undefined,
    Qty: toNumber(item.Qty),
    TotalAmount: toNumber(item.TotalAmount),
    TotalAmountLocal: toNumber(item.TotalAmountLocal),
    TotalWeight: toNumber(item.TotalWeight),
    User: user,
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function findSaleByKey(sales: IncompleteSalesOnlineShopItem[], rowKey: string) {
  return sales.find((sale, index) => getIncompleteSaleKey(sale, index) === rowKey)
}

function replaceSaleByKey(
  sales: IncompleteSalesOnlineShopItem[],
  rowKey: string,
  nextSale: IncompleteSalesOnlineShopItem,
) {
  return sales.map((sale, index) => (getIncompleteSaleKey(sale, index) === rowKey ? nextSale : sale))
}

function syncSelectedSale(
  currentSale: IncompleteSalesOnlineShopItem | null,
  updatedSales: IncompleteSalesOnlineShopItem[],
  rowKey: string,
  nextSale: IncompleteSalesOnlineShopItem,
): IncompleteSalesOnlineShopItem | null {
  if (!currentSale) {
    return currentSale
  }

  const currentKey = getIncompleteSaleKey(currentSale)

  if (currentKey !== rowKey) {
    return updatedSales.find((sale, index) => getIncompleteSaleKey(sale, index) === currentKey) || currentSale
  }

  return updatedSales.find((sale, index) => getIncompleteSaleKey(sale, index) === rowKey) || nextSale
}
