import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconListDetails, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getAvailablePaymentsOrganizations,
  getGroupedPaymentTasks,
} from '../api/availablePaymentsApi'
import { AvailablePaymentsDetailDrawer } from '../components/AvailablePaymentsDetailDrawer'
import {
  AccountingTypeValue,
  TaskStatusValue,
  type AvailablePaymentTaskModel,
  type AvailablePaymentsOrganization,
  type GroupedPaymentTask,
  type PriceTotal,
} from '../types'

type FilterDraft = {
  from: string
  organizationNetId: string
  to: string
  type: AccountingTypeValue
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = ['10', '20', '40', '60']
const OUTCOME_PAYMENT_TASKS_OPERATION_TYPE = '4'

const CURRENCY_CODES = ['EUR', 'USD', 'PLN', 'UAH'] as const

const AVAILABLE_PAYMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'date', 'tasks'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

function useAvailablePaymentsPageModel() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const isOutcomePaymentTasksMode = searchParams.get('operationType') === OUTCOME_PAYMENT_TASKS_OPERATION_TYPE
  const initialAccountingType = parseAccountingType(searchParams.get('type'))
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-30),
      organizationNetId: '',
      to: getDateShiftedByDays(30),
      type: initialAccountingType,
    }),
    [initialAccountingType],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [groups, setGroups] = useValueState<GroupedPaymentTask[]>([])
  const [priceTotals, setPriceTotals] = useValueState<PriceTotal[]>([])
  const [totalGrossPrice, setTotalGrossPrice] = useValueState(0)
  const [totalNotDoneTasks, setTotalNotDoneTasks] = useValueState(0)
  const [organizations, setOrganizations] = useValueState<AvailablePaymentsOrganization[]>([])
  const [organizationsError, setOrganizationsError] = useValueState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useValueState<GroupedPaymentTask | null>(null)
  const [pendingDetailGroup, setPendingDetailGroup] = useValueState<GroupedPaymentTask | null>(null)
  const [markedModels, setMarkedModels] = useValueState<AvailablePaymentTaskModel[]>([])
  const [filesByTaskId, setFilesByTaskId] = useValueState<Record<string, File[]>>({})
  const [confirmCloseDetailOpen, setConfirmCloseDetailOpen] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${activeFilters.organizationNetId}|${activeFilters.type}|${pageSize}|${isOutcomePaymentTasksMode}`
  const listRequestKeyRef = useRef(listRequestKey)
  const groupsRef = useRef(groups)
  const groupIndexMap = useMemo(() => buildIndexMap(groups), [groups])
  const hasPendingFiles = useMemo(() => Object.values(filesByTaskId).some((files) => files.length > 0), [filesByTaskId])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    groupsRef.current = groups
  }, [groups])

  const resetGroups = useCallback(() => {
    setGroups([])
    setPriceTotals([])
    setTotalGrossPrice(0)
    setTotalNotDoneTasks(0)
    setHasMore(false)
    setLoading(false)
    setSelectedGroup(null)
    setFilesByTaskId({})
    setMarkedModels([])
  }, [
    setFilesByTaskId,
    setGroups,
    setHasMore,
    setLoading,
    setMarkedModels,
    setPriceTotals,
    setSelectedGroup,
    setTotalGrossPrice,
    setTotalNotDoneTasks,
  ])

  useAvailablePaymentsOrganizationsLoader({ setOrganizations, setOrganizationsError })

  useAvailablePaymentsLoader({
    activeFilters,
    filterError,
    isOutcomePaymentTasksMode,
    pageSize,
    reloadKey,
    resetGroups,
    setError,
    setGroups,
    setHasMore,
    setLoading,
    setPriceTotals,
    setTotalGrossPrice,
    setTotalNotDoneTasks,
  })

  const handleRealtimePaymentTask = useCallback(() => {
    reload()
  }, [reload])

  useRealtimeEvent(realtimeEvents.supplyPaymentTaskNotification, handleRealtimePaymentTask)

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  async function loadMoreGroups() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = groupsRef.current.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getGroupedPaymentTasks({
        from: toQueryDate(activeFilters.from),
        limit: pageSize,
        offset: requestOffset,
        onlyAvailableForPayment: isOutcomePaymentTasksMode,
        organizationNetId: activeFilters.organizationNetId || undefined,
        to: toQueryDate(activeFilters.to),
        typePaymentTask: activeFilters.type,
      })

      if (listRequestKeyRef.current === requestKey) {
        const currentGroups = groupsRef.current

        if (currentGroups.length === requestOffset) {
          const nextGroups = [...currentGroups, ...result.GroupedPaymentTasks]
          setGroups(nextGroups)
          setPriceTotals(result.PriceTotals)
          setTotalGrossPrice(result.TotalGrossPrice)
          setTotalNotDoneTasks(countNotDoneTasks(nextGroups))
          setHasMore(result.GroupedPaymentTasks.length === pageSize)
        }
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити платіжні задачі'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  const openDetail = useCallback(
    (group: GroupedPaymentTask) => {
      if (hasPendingFiles && selectedGroup && getPaymentGroupKey(selectedGroup) !== getPaymentGroupKey(group)) {
        setPendingDetailGroup(group)
        setConfirmCloseDetailOpen(true)
        return
      }

      setSelectedGroup(group)
    },
    [hasPendingFiles, selectedGroup, setConfirmCloseDetailOpen, setPendingDetailGroup, setSelectedGroup],
  )
  const closeDetail = useCallback(() => {
    if (hasPendingFiles) {
      setPendingDetailGroup(null)
      setConfirmCloseDetailOpen(true)
      return
    }

    setSelectedGroup(null)
  }, [hasPendingFiles, setConfirmCloseDetailOpen, setPendingDetailGroup, setSelectedGroup])
  const cancelCloseDetail = useCallback(() => {
    setConfirmCloseDetailOpen(false)
    setPendingDetailGroup(null)
  }, [setConfirmCloseDetailOpen, setPendingDetailGroup])
  const confirmCloseDetail = useCallback(() => {
    const nextGroup = pendingDetailGroup

    setConfirmCloseDetailOpen(false)
    setFilesByTaskId({})
    setPendingDetailGroup(null)
    setSelectedGroup(nextGroup)
  }, [pendingDetailGroup, setConfirmCloseDetailOpen, setFilesByTaskId, setPendingDetailGroup, setSelectedGroup])
  const clearMarked = useCallback(() => {
    setMarkedModels([])
    setFilesByTaskId({})
  }, [setFilesByTaskId, setMarkedModels])
  const toggleMarked = useCallback(
    (model: AvailablePaymentTaskModel) => {
      setMarkedModels((current) => {
        if (current.some((item) => item.id === model.id)) {
          return current.filter((item) => item.id !== model.id)
        }

        const currentOrganizationNetUid = current[0]?.organizationNetUid

        if (currentOrganizationNetUid && currentOrganizationNetUid !== model.organizationNetUid) {
          setError(t('Можна обрати платіжні задачі тільки одного контрагента'))
          return current
        }

        const currentCurrencyCode = current[0]?.currencyCode

        if (currentCurrencyCode && currentCurrencyCode !== model.currencyCode) {
          setError(t('Можна обрати платіжні задачі тільки в одній валюті'))
          return current
        }

        const currentAgreementNetId = current[0]?.serviceAgreementNetId

        if (currentAgreementNetId && model.serviceAgreementNetId && currentAgreementNetId !== model.serviceAgreementNetId) {
          setError(t('Можна обрати платіжні задачі тільки однієї угоди'))
          return current
        }

        const currentIsAccounting = Boolean(current[0]?.task.IsAccounting)

        if (current.length > 0 && currentIsAccounting !== Boolean(model.task.IsAccounting)) {
          setError(t('Можна обрати платіжні задачі тільки одного типу обліку'))
          return current
        }

        return [...current, model]
      })
    },
    [setError, setMarkedModels, t],
  )
  const handlePaymentChanged = useCallback(() => {
    setSelectedGroup(null)
    setMarkedModels([])
    setFilesByTaskId({})
    reload()
  }, [reload, setFilesByTaskId, setMarkedModels, setSelectedGroup])
  const handleFilesChanged = useCallback(
    (taskId: string, files: File[]) => {
      setFilesByTaskId((current) => ({ ...current, [taskId]: files }))
    },
    [setFilesByTaskId],
  )

  const columns = useAvailablePaymentsColumns(groupIndexMap, openDetail)

  const totalsByCurrency = useMemo(() => buildCurrencyTotals(priceTotals), [priceTotals])

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Завантажених')} {groups.length}
        {hasMore ? '+' : ''}
      </Text>
    ),
    [groups.length, hasMore, t],
  )

  return {
    activeFilters,
    cancelCloseDetail,
    closeDetail,
    columns,
    confirmCloseDetail,
    confirmCloseDetailOpen,
    error,
    filterDraft,
    filterError,
    filesByTaskId,
    groups,
    hasMore,
    isOutcomePaymentTasksMode,
    isLoading,
    isLoadingMore,
    loadMoreGroups,
    markedModels,
    markedTaskIds: markedModels.map((model) => model.id),
    openDetail,
    organizations,
    organizationsError,
    pageSize,
    selectedGroup,
    toolbarLeft,
    totalGrossPrice,
    totalNotDoneTasks,
    totalsByCurrency,
    applyFilters,
    clearMarked,
    handlePaymentChanged,
    handleFilesChanged,
    reload,
    resetFilters,
    setPageSize,
    toggleMarked,
  }
}

function useAvailablePaymentsOrganizationsLoader({
  setOrganizations,
  setOrganizationsError,
}: {
  setOrganizations: (value: AvailablePaymentsOrganization[]) => void
  setOrganizationsError: (value: string | null) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      setOrganizationsError(null)

      try {
        const nextOrganizations = await getAvailablePaymentsOrganizations()

        if (!cancelled) {
          setOrganizations(nextOrganizations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrganizations([])
          setOrganizationsError(
            loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організації'),
          )
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [setOrganizations, setOrganizationsError, t])
}

function useAvailablePaymentsLoader({
  activeFilters,
  filterError,
  isOutcomePaymentTasksMode,
  pageSize,
  reloadKey,
  resetGroups,
  setError,
  setGroups,
  setHasMore,
  setLoading,
  setPriceTotals,
  setTotalGrossPrice,
  setTotalNotDoneTasks,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  isOutcomePaymentTasksMode: boolean
  pageSize: number
  reloadKey: number
  resetGroups: () => void
  setError: (value: string | null) => void
  setGroups: (value: GroupedPaymentTask[]) => void
  setHasMore: (value: boolean) => void
  setLoading: (value: boolean) => void
  setPriceTotals: (value: PriceTotal[]) => void
  setTotalGrossPrice: (value: number) => void
  setTotalNotDoneTasks: (value: number) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetGroups()
      return
    }

    let cancelled = false

    async function loadGroups() {
      setLoading(true)
      setError(null)

      try {
        const result = await getGroupedPaymentTasks({
          from: toQueryDate(activeFilters.from),
          limit: pageSize,
          offset: 0,
          onlyAvailableForPayment: isOutcomePaymentTasksMode,
          organizationNetId: activeFilters.organizationNetId || undefined,
          to: toQueryDate(activeFilters.to),
          typePaymentTask: activeFilters.type,
        })

        if (!cancelled) {
          setGroups(result.GroupedPaymentTasks)
          setPriceTotals(result.PriceTotals)
          setTotalGrossPrice(result.TotalGrossPrice)
          setTotalNotDoneTasks(countNotDoneTasks(result.GroupedPaymentTasks))
          setHasMore(result.GroupedPaymentTasks.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setGroups([])
          setPriceTotals([])
          setTotalGrossPrice(0)
          setTotalNotDoneTasks(0)
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити платіжні задачі'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadGroups()

    return () => {
      cancelled = true
    }
  }, [
    activeFilters,
    filterError,
    isOutcomePaymentTasksMode,
    pageSize,
    reloadKey,
    resetGroups,
    setError,
    setGroups,
    setHasMore,
    setLoading,
    setPriceTotals,
    setTotalGrossPrice,
    setTotalNotDoneTasks,
    t,
  ])
}

export function AvailablePaymentsPage() {
  const model = useAvailablePaymentsPageModel()

  return (
    <Stack gap="lg">
      <AvailablePaymentsHeader model={model} />
      <AvailablePaymentsTableCard model={model} />
      <AvailablePaymentsDetailDrawer
        key={String(model.selectedGroup?.NetUid || model.selectedGroup?.Id || 'closed')}
        group={model.selectedGroup}
        filesByTaskId={model.filesByTaskId}
        markedModels={model.markedModels}
        markedTaskIds={model.markedTaskIds}
        typePaymentTask={model.activeFilters.type}
        onChanged={model.handlePaymentChanged}
        onClearMarked={model.clearMarked}
        onClose={model.closeDetail}
        onFilesChanged={model.handleFilesChanged}
        onToggleMarked={model.toggleMarked}
      />
      <AppModal
        centered
        opened={model.confirmCloseDetailOpen}
        title={translate('Є незбережені зміни')}
        onClose={model.cancelCloseDetail}
      >
        <Stack gap="md">
          <Text>{translate('Якщо закрити вікно, додані файли не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={model.cancelCloseDetail}>
              {translate('Залишитися')}
            </Button>
            <Button color="red" onClick={model.confirmCloseDetail}>
              {translate('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function AvailablePaymentsHeader({ model }: { model: ReturnType<typeof useAvailablePaymentsPageModel> }) {
  const { t } = useI18n()
  const { isLoading, reload } = model

  return (
    <Group justify="space-between" align="center">
      <Text fw={700} size="lg">
        {t('Наявні платежі')}
      </Text>
      <Group gap="xs">
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  )
}

function AvailablePaymentsTableCard({ model }: { model: ReturnType<typeof useAvailablePaymentsPageModel> }) {
  const { t } = useI18n()
  const {
    applyFilters,
    columns,
    error,
    filterDraft,
    filterError,
    groups,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMoreGroups,
    markedModels,
    openDetail,
    organizations,
    organizationsError,
    pageSize,
    reload,
    resetFilters,
    setPageSize,
    toolbarLeft,
    totalGrossPrice,
    totalNotDoneTasks,
    totalsByCurrency,
    clearMarked,
  } = model

  const organizationOptions = useMemo(
    () => [
      { label: t('Всі'), value: '' },
      ...organizations.flatMap((organization) =>
        (organization.Name || organization.FullName) && organization.NetUid
          ? [
              {
                label: organization.Name || organization.FullName || '',
                value: organization.NetUid || '',
              },
            ]
          : [],
      ),
    ],
    [organizations, t],
  )

  const typeOptions = useMemo(
    () => [
      { label: t('Всі'), value: String(AccountingTypeValue.All) },
      { label: t('Управлінський облік'), value: String(AccountingTypeValue.ManagementAccounting) },
      { label: t('Бухгалтерський облік'), value: String(AccountingTypeValue.Accounting) },
    ],
    [t],
  )

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="wrap">
          <Select
            data={organizationOptions}
            label={t('Організація')}
            searchable
            value={filterDraft.organizationNetId}
            w={240}
            onChange={(value) => applyFilters({ ...filterDraft, organizationNetId: value || '' })}
          />
          <Select
            data={typeOptions}
            label={t('Тип')}
            value={String(filterDraft.type)}
            w={200}
            onChange={(value) =>
              applyFilters({ ...filterDraft, type: Number(value ?? AccountingTypeValue.All) as FilterDraft['type'] })
            }
          />
          <TextInput
            label={t('Від якої дати')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
          />
          <TextInput
            label={t('До якої дати')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {(error || filterError || organizationsError) && (
          <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || error || organizationsError}
          </Alert>
        )}

        {markedModels.length > 0 && (
          <Alert color="blue" icon={<IconListDetails size={18} />} variant="light">
            <Group justify="space-between" gap="sm">
              <Text size="sm">
                {t('Вибрано платіжних задач')}: {markedModels.length}
              </Text>
              <Button color="gray" size="xs" variant="subtle" onClick={clearMarked}>
                {t('Очистити')}
              </Button>
            </Group>
          </Alert>
        )}

        <Group justify="flex-end" gap="xs">
          <Select
            aria-label={t('Кількість рядків')}
            data={PAGE_SIZE_OPTIONS}
            size="xs"
            value={String(pageSize)}
            w={88}
            onChange={(value) => {
              setPageSize(Number(value || DEFAULT_PAGE_SIZE))
              reload()
            }}
          />
        </Group>

        <DataTable
          columns={columns}
          data={groups}
          defaultLayout={AVAILABLE_PAYMENTS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Платіжних задач не знайдено')}
          getRowId={(group, index) => String(group.NetUid || group.Id || index)}
          isLoading={isLoading}
          layoutVersion="available-payments-table-1"
          loadingText={t('Завантаження')}
          maxHeight="calc(100vh - 420px)"
          minWidth={1080}
          tableId="available-payments"
          toolbarLeft={toolbarLeft}
          onRowClick={openDetail}
        />

        {groups.length > 0 && (
          <AvailablePaymentsTotalsRow
            totalGrossPrice={totalGrossPrice}
            totalNotDoneTasks={totalNotDoneTasks}
            totalsByCurrency={totalsByCurrency}
          />
        )}

        {hasMore && (
          <Group justify="center">
            <Button color="gray" loading={isLoadingMore} variant="light" onClick={loadMoreGroups}>
              {t('Завантажити ще')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

function AvailablePaymentsTotalsRow({
  totalGrossPrice,
  totalNotDoneTasks,
  totalsByCurrency,
}: {
  totalGrossPrice: number
  totalNotDoneTasks: number
  totalsByCurrency: Record<string, number>
}) {
  const { t } = useI18n()

  return (
    <Group justify="flex-end" gap="lg" wrap="wrap">
      <TotalCell label={t('К-сть')} value={String(totalNotDoneTasks)} />
      {CURRENCY_CODES.map((code) => (
        <TotalCell key={code} label={code} value={formatAmount(totalsByCurrency[code] || 0)} />
      ))}
      <TotalCell label={t('Вся сума в EUR')} value={formatAmount(totalGrossPrice)} strong />
    </Group>
  )
}

function TotalCell({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <Stack gap={0} align="flex-end">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={strong ? 700 : 600}>{value}</Text>
    </Stack>
  )
}

function useAvailablePaymentsColumns(
  indexMap: Map<GroupedPaymentTask, number>,
  onOpen: (group: GroupedPaymentTask) => void,
) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<GroupedPaymentTask>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (group) => indexMap.get(group) || 0,
        cell: (group) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(group) || ''}
          </Text>
        ),
      },
      {
        id: 'date',
        header: t('Дата'),
        width: 150,
        minWidth: 120,
        accessor: (group) => getDateTime(group.PayToDate),
        cell: (group) => <Text fw={600}>{formatDate(group.PayToDate)}</Text>,
      },
      {
        id: 'tasks',
        header: t('К-сть'),
        width: 130,
        minWidth: 110,
        align: 'right',
        enableSorting: false,
        accessor: (group) => countNotDone(group),
        cell: (group) => renderTasksCell(group),
      },
      {
        id: 'eur',
        header: 'EUR',
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (group) => getCurrencyTotal(group, 'EUR'),
        cell: (group) => formatAmount(getCurrencyTotal(group, 'EUR')),
      },
      {
        id: 'usd',
        header: 'USD',
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (group) => getCurrencyTotal(group, 'USD'),
        cell: (group) => formatAmount(getCurrencyTotal(group, 'USD')),
      },
      {
        id: 'pln',
        header: 'PLN',
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (group) => getCurrencyTotal(group, 'PLN'),
        cell: (group) => formatAmount(getCurrencyTotal(group, 'PLN')),
      },
      {
        id: 'uah',
        header: 'UAH',
        width: 130,
        minWidth: 100,
        align: 'right',
        accessor: (group) => getCurrencyTotal(group, 'UAH'),
        cell: (group) => formatAmount(getCurrencyTotal(group, 'UAH')),
      },
      {
        id: 'totalEuro',
        header: t('Вся сума в EUR'),
        width: 160,
        minWidth: 140,
        align: 'right',
        accessor: (group) => group.TotalGrossAmount || 0,
        cell: (group) => <Text fw={700}>{formatAmount(group.TotalGrossAmount)}</Text>,
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (group) => (
          <Box>
            <Tooltip label={t('Деталі')}>
              <ActionIcon
                aria-label={t('Деталі')}
                color="gray"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(group)
                }}
              >
                <IconListDetails size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [indexMap, onOpen, t],
  )
}

function renderTasksCell(group: GroupedPaymentTask) {
  const tasks = group.SupplyPaymentTasks || []
  const notDone = countNotDone(group)
  const done = tasks.length - notDone

  return (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      <Badge color="green" variant="light">
        {done}
      </Badge>
      <Badge color="gray" variant="light">
        {notDone}
      </Badge>
    </Group>
  )
}

function buildIndexMap(groups: GroupedPaymentTask[]): Map<GroupedPaymentTask, number> {
  return groups.reduce((indexMap, group, index) => {
    indexMap.set(group, index + 1)

    return indexMap
  }, new Map<GroupedPaymentTask, number>())
}

function getPaymentGroupKey(group: GroupedPaymentTask): string {
  return String(group.NetUid || group.Id || group.PayToDate || '')
}

function buildCurrencyTotals(priceTotals: PriceTotal[]): Record<string, number> {
  return priceTotals.reduce<Record<string, number>>((totals, priceTotal) => {
    const code = priceTotal.Currency?.Code

    if (code) {
      totals[code] = (totals[code] || 0) + (priceTotal.TotalPrice || 0)
    }

    return totals
  }, {})
}

function getCurrencyTotal(group: GroupedPaymentTask, code: string): number {
  return (group.PriceTotals || [])
    .filter((priceTotal) => priceTotal.Currency?.Code === code)
    .reduce((sum, priceTotal) => sum + (priceTotal.TotalPrice || 0), 0)
}

function countNotDone(group: GroupedPaymentTask): number {
  return (group.SupplyPaymentTasks || []).filter((task) => task.TaskStatus === TaskStatusValue.NotDone).length
}

function countNotDoneTasks(groups: GroupedPaymentTask[]): number {
  return groups.reduce((total, group) => total + countNotDone(group), 0)
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function parseAccountingType(value: string | null): AccountingTypeValue {
  const numericValue = Number(value)

  if (
    numericValue === AccountingTypeValue.ManagementAccounting ||
    numericValue === AccountingTypeValue.Accounting ||
    numericValue === AccountingTypeValue.All
  ) {
    return numericValue
  }

  return AccountingTypeValue.All
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function toQueryDate(value: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toDateString()
}

function getDateTime(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }

  if (typeof value !== 'string' || !value) {
    return 0
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0.00'
  }

  return value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
