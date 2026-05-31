import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconHistory, IconRefresh, IconSettings } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getActReconciliationByNetId, getAppliedActions } from '../api/actReconciliationsApi'
import {
  ActReconciliationActionsModal,
  type ActionTarget,
} from '../components/ActReconciliationActionsModal'
import { AppliedActionsHistoryDrawer } from '../components/AppliedActionsHistoryDrawer'
import type {
  ActReconciliation,
  ActReconciliationAppliedAction,
  ActReconciliationItem,
} from '../types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

function useActReconciliationViewModel() {
  const { netid } = useParams<{ netid: string }>()
  const [reconciliation, setReconciliation] = useValueState<ActReconciliation | null>(null)
  const [selectedNetIds, setSelectedNetIds] = useValueState<Set<string>>(() => new Set())
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [actionTarget, setActionTarget] = useValueState<ActionTarget | null>(null)
  const [isActionOpen, setActionOpen] = useValueState(false)
  const [isHistoryOpen, setHistoryOpen] = useValueState(false)
  const [appliedActions, setAppliedActions] = useValueState<ActReconciliationAppliedAction[]>([])
  const [selectedAppliedAction, setSelectedAppliedAction] =
    useValueState<ActReconciliationAppliedAction | null>(null)
  const [isHistoryLoading, setHistoryLoading] = useValueState(false)
  const [historyError, setHistoryError] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const requestRef = useRef(0)

  const items = useMemo(() => reconciliation?.ActReconciliationItems || [], [reconciliation])
  const organizationNetId = useMemo(() => getOrganizationNetId(reconciliation), [reconciliation])
  const totals = useMemo(() => buildTotals(items), [items])
  const selectedItems = useMemo(
    () => items.filter((item) => item.NetUid && selectedNetIds.has(item.NetUid)),
    [items, selectedNetIds],
  )

  const loadReconciliation = useCallback(async () => {
    if (!netid) {
      setReconciliation(null)
      setError(translate('Акт звірки не вибрано'))
      setLoading(false)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const loaded = await getActReconciliationByNetId(netid)

      if (requestRef.current !== requestId) {
        return
      }

      if (!loaded) {
        setReconciliation(null)
        setError(translate('Обраний акт звірки не існує'))
        return
      }

      setReconciliation(loaded)
      setSelectedNetIds(new Set())
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setReconciliation(null)
        setError(loadError instanceof Error ? loadError.message : translate('Не вдалося завантажити акт звірки'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [netid, setError, setLoading, setReconciliation, setSelectedNetIds])

  useEffect(() => {
    void loadReconciliation()
  }, [loadReconciliation, reloadKey])

  const toggleItem = useCallback(
    (item: ActReconciliationItem) => {
      if (!item.HasDifference || !item.NetUid) {
        return
      }

      setSelectedNetIds((current) => {
        const next = new Set(current)

        if (next.has(item.NetUid as string)) {
          next.delete(item.NetUid as string)
        } else {
          next.add(item.NetUid as string)
        }

        return next
      })
    },
    [setSelectedNetIds],
  )

  const toggleAll = useCallback(() => {
    const eligible = items.filter((item) => item.HasDifference && item.NetUid)
    const allSelected = eligible.length > 0 && eligible.every((item) => selectedNetIds.has(item.NetUid as string))

    setSelectedNetIds(allSelected ? new Set() : new Set(eligible.map((item) => item.NetUid as string)))
  }, [items, selectedNetIds, setSelectedNetIds])

  const openSingleAction = useCallback(
    (item: ActReconciliationItem) => {
      if (!item.HasDifference) {
        return
      }

      setActionTarget({ mode: 'single', item })
      setActionOpen(true)
    },
    [setActionOpen, setActionTarget],
  )

  const openMultiAction = useCallback(() => {
    if (selectedItems.length === 0) {
      return
    }

    setActionTarget({ mode: 'multi', items: selectedItems })
    setActionOpen(true)
  }, [selectedItems, setActionOpen, setActionTarget])

  const closeAction = useCallback(() => {
    setActionOpen(false)
    setActionTarget(null)
  }, [setActionOpen, setActionTarget])

  const handleApplied = useCallback(() => {
    void loadReconciliation()
  }, [loadReconciliation])

  const openHistory = useCallback(async () => {
    if (!netid) {
      return
    }

    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    setSelectedAppliedAction(null)

    try {
      const actions = await getAppliedActions(netid)
      setAppliedActions(actions)
    } catch (loadError) {
      setAppliedActions([])
      setHistoryError(loadError instanceof Error ? loadError.message : translate('Не вдалося завантажити історію'))
    } finally {
      setHistoryLoading(false)
    }
  }, [netid, setAppliedActions, setHistoryError, setHistoryLoading, setHistoryOpen, setSelectedAppliedAction])

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    setSelectedAppliedAction(null)
  }, [setHistoryOpen, setSelectedAppliedAction])

  return {
    actionTarget,
    appliedActions,
    error,
    historyError,
    isActionOpen,
    isHistoryLoading,
    isHistoryOpen,
    isLoading,
    items,
    organizationNetId,
    reconciliation,
    selectedAppliedAction,
    selectedItems,
    selectedNetIds,
    totals,
    closeAction,
    closeHistory,
    handleApplied,
    openHistory,
    openMultiAction,
    openSingleAction,
    reload,
    setSelectedAppliedAction,
    toggleAll,
    toggleItem,
  }
}

export function ActReconciliationViewPage() {
  const model = useActReconciliationViewModel()

  return <ActReconciliationViewPageView model={model} />
}

function ActReconciliationViewPageView({ model }: { model: ReturnType<typeof useActReconciliationViewModel> }) {
  const { t } = useI18n()
  const columns = useItemColumns({
    items: model.items,
    selectedNetIds: model.selectedNetIds,
    onOpenAction: model.openSingleAction,
    onToggleAll: model.toggleAll,
    onToggleItem: model.toggleItem,
  })

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <ActionIcon
            aria-label={t('Назад')}
            color="gray"
            component={Link}
            size={38}
            to="/ukraine/act/reconcoliation"
            variant="light"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={4}>{getTitle(model.reconciliation)}</Title>
        </Group>
        <Group gap="xs">
          <Tooltip label={t('Історія змін')}>
            <ActionIcon
              aria-label={t('Історія змін')}
              color="gray"
              disabled={!model.reconciliation}
              size={38}
              variant="light"
              onClick={() => void model.openHistory()}
            >
              <IconHistory size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={model.isLoading}
              size={38}
              variant="light"
              onClick={() => model.reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          {model.selectedItems.length > 0 && (
            <Button color="violet" onClick={model.openMultiAction}>
              {t('Обробити')} ({model.selectedItems.length})
            </Button>
          )}
        </Group>
      </Group>

      {model.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {model.error}
        </Alert>
      )}

      <Card withBorder radius="md" padding="md">
        <DataTable
          columns={columns}
          data={model.items}
          emptyText={t('Позицій не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          isLoading={model.isLoading}
          layoutVersion="act-reconciliation-items-table-1"
          loadingText={t('Завантаження позицій')}
          maxHeight="calc(100vh - 360px)"
          minWidth={1100}
          tableId="act-reconciliation-items"
          onRowClick={model.toggleItem}
        />
      </Card>

      <Card withBorder radius="md" padding="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <TotalValue label={t('Всього товарів')} value={model.totals.totalProducts} />
          <TotalValue label={t('Вся кількість')} value={model.totals.totalCount} />
          <TotalValue
            color="red"
            label={t('Недостача')}
            value={model.totals.lack > 0 ? `- ${model.totals.lack}` : model.totals.lack}
          />
          <TotalValue
            color="teal"
            label={t('Надлишок')}
            value={model.totals.excess > 0 ? `+ ${model.totals.excess}` : model.totals.excess}
          />
        </SimpleGrid>
      </Card>

      <ActReconciliationActionsModal
        opened={model.isActionOpen}
        organizationNetId={model.organizationNetId}
        target={model.actionTarget}
        onApplied={model.handleApplied}
        onClose={model.closeAction}
      />

      <AppliedActionsHistoryDrawer
        appliedActions={model.appliedActions}
        error={model.historyError}
        isLoading={model.isHistoryLoading}
        opened={model.isHistoryOpen}
        selectedAction={model.selectedAppliedAction}
        title={getTitle(model.reconciliation)}
        onClose={model.closeHistory}
        onSelectAction={model.setSelectedAppliedAction}
      />
    </Stack>
  )
}

function TotalValue({ color, label, value }: { color?: string; label: string; value: unknown }) {
  return (
    <Box>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text c={color} fw={700} size="lg">
        {String(value)}
      </Text>
    </Box>
  )
}

function useItemColumns({
  items,
  selectedNetIds,
  onOpenAction,
  onToggleAll,
  onToggleItem,
}: {
  items: ActReconciliationItem[]
  selectedNetIds: Set<string>
  onOpenAction: (item: ActReconciliationItem) => void
  onToggleAll: () => void
  onToggleItem: (item: ActReconciliationItem) => void
}): DataTableColumn<ActReconciliationItem>[] {
  const { t } = useI18n()
  const storageColumns = useMemo(() => buildStorageColumns(items), [items])
  const eligible = useMemo(() => items.filter((item) => item.HasDifference && item.NetUid), [items])
  const allSelected = eligible.length > 0 && eligible.every((item) => selectedNetIds.has(item.NetUid as string))

  return useMemo<DataTableColumn<ActReconciliationItem>[]>(
    () => [
      {
        id: 'check',
        header: (
          <Box onClick={(event) => event.stopPropagation()}>
            <Checkbox
              aria-label={t('Обрати всі')}
              checked={allSelected}
              disabled={eligible.length === 0}
              onChange={onToggleAll}
            />
          </Box>
        ),
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        cell: (item) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Checkbox
              aria-label={t('Обрати')}
              checked={Boolean(item.NetUid && selectedNetIds.has(item.NetUid))}
              disabled={!item.HasDifference}
              onChange={() => onToggleItem(item)}
            />
          </Box>
        ),
      },
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (item) => String(items.indexOf(item) + 1),
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 160,
        minWidth: 124,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => <Text fw={700}>{displayValue(item.Product?.VendorCode)}</Text>,
      },
      {
        id: 'name',
        header: t('Назва товару'),
        minWidth: 240,
        accessor: (item) => item.Product?.NameUA || item.Product?.Name,
        cell: (item) => (
          <Text lineClamp={2}>{displayValue(item.Product?.NameUA || item.Product?.Name)}</Text>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 90,
        minWidth: 72,
        align: 'right',
        accessor: (item) => item.OrderedQty,
        cell: (item) => displayValue(item.OrderedQty),
      },
      {
        id: 'actualQty',
        header: t('Фактична К-сть'),
        width: 140,
        minWidth: 110,
        align: 'right',
        accessor: (item) => item.ActualQty,
        cell: (item) => displayValue(item.ActualQty),
      },
      {
        id: 'difference',
        header: t('Різниця'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.QtyDifference,
        cell: (item) => <DifferenceText item={item} />,
      },
      {
        id: 'action',
        header: t('Статус'),
        width: 80,
        minWidth: 72,
        align: 'center',
        enableSorting: false,
        cell: (item) =>
          item.HasDifference ? (
            <Box onClick={(event) => event.stopPropagation()}>
              <Tooltip label={t('Дія')}>
                <ActionIcon
                  aria-label={t('Дія')}
                  color={item.NegativeDifference ? 'red' : 'teal'}
                  variant="subtle"
                  onClick={() => onOpenAction(item)}
                >
                  <IconSettings size={18} />
                </ActionIcon>
              </Tooltip>
            </Box>
          ) : null,
      },
      ...storageColumns,
    ],
    [allSelected, eligible.length, items, onOpenAction, onToggleAll, onToggleItem, selectedNetIds, storageColumns, t],
  )
}

function DifferenceText({ item }: { item: ActReconciliationItem }) {
  if (!item.HasDifference) {
    return <Text size="sm">{item.QtyDifference ?? '-'}</Text>
  }

  return item.NegativeDifference ? (
    <Text c="red" fw={600} size="sm">
      - {item.QtyDifference}
    </Text>
  ) : (
    <Text c="teal" fw={600} size="sm">
      + {item.QtyDifference}
    </Text>
  )
}

function buildStorageColumns(items: ActReconciliationItem[]): DataTableColumn<ActReconciliationItem>[] {
  const availabilities = items[0]?.Availabilities || []

  return availabilities.reduce<DataTableColumn<ActReconciliationItem>[]>((columns, availability) => {
    const storageNetUid = availability.Storage?.NetUid

    if (!storageNetUid) {
      return columns
    }

    columns.push({
      id: `storage-${storageNetUid}`,
      header: availability.Storage?.Name || '-',
      width: 140,
      minWidth: 100,
      align: 'right',
      enableSorting: false,
      accessor: (item) => getStorageQty(item, storageNetUid),
      cell: (item) => displayValue(getStorageQty(item, storageNetUid)),
    })

    return columns
  }, [])
}

function getStorageQty(item: ActReconciliationItem, storageNetUid: string): number | undefined {
  const availability = (item.Availabilities || []).find(
    (entry) => entry.Storage?.NetUid === storageNetUid,
  )

  return availability?.Qty
}

function buildTotals(items: ActReconciliationItem[]) {
  return items.reduce(
    (totals, item) => {
      totals.totalCount += item.OrderedQty || 0

      if (item.HasDifference && item.NegativeDifference) {
        totals.lack += item.QtyDifference || 0
      }

      if (item.HasDifference && !item.NegativeDifference) {
        totals.excess += item.QtyDifference || 0
      }

      return totals
    },
    { excess: 0, lack: 0, totalCount: 0, totalProducts: items.length },
  )
}

function getOrganizationNetId(reconciliation: ActReconciliation | null): string {
  if (!reconciliation) {
    return ''
  }

  if (reconciliation.SupplyInvoice) {
    return reconciliation.SupplyInvoice.SupplyOrder?.Organization?.NetUid || ''
  }

  if (reconciliation.SupplyOrderUkraine) {
    return reconciliation.SupplyOrderUkraine.Organization?.NetUid || ''
  }

  return ''
}

function getTitle(reconciliation: ActReconciliation | null): string {
  if (!reconciliation) {
    return translate('Акт звірки')
  }

  return [translate('Акт звірки'), reconciliation.Number, formatDate(reconciliation.FromDate)]
    .filter(Boolean)
    .join(' ')
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
