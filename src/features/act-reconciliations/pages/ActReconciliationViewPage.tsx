import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, History, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { usePermissions } from '../../auth/usePermissions'
import { getActReconciliationByNetId, getAppliedActions } from '../api/actReconciliationsApi'
import { getDispositionHistory } from '../api/actReconciliationsApi'
import {
  buildWorkflowCounts,
  getDispositionReasonLabel,
  getItemWorkflowState,
} from '../actReconciliationWorkflow'
import {
  ActReconciliationActionsModal,
  type ActionTarget,
} from '../components/ActReconciliationActionsModal'
import {
  ActReconciliationDispositionModal,
  type ActReconciliationDispositionMode,
} from '../components/ActReconciliationDispositionModal'
import { AppliedActionsHistoryDrawer } from '../components/AppliedActionsHistoryDrawer'
import type {
  ActReconciliation,
  ActReconciliationAppliedAction,
  ActReconciliationDispositionEvent,
  ActReconciliationItem,
} from '../types'

type DispositionTarget = {
  mode: ActReconciliationDispositionMode
  items: ActReconciliationItem[]
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

function useActReconciliationViewModel() {
  const { can } = usePermissions()
  const canViewHistory = can(PermissionKeys.ActReconciliations.History.View)
  const canCreateProductIncome = can(PermissionKeys.ActReconciliations.Action.CreateProductIncome)
  const canCreateProductTransfer = can(PermissionKeys.ActReconciliations.Action.CreateProductTransfer)
  const canCreateWriteOff = can(PermissionKeys.ActReconciliations.Action.CreateWriteOff)
  const canChangeDisposition = can(PermissionKeys.ActReconciliations.Disposition.Change)
  const canCreateAction = canCreateProductIncome || canCreateProductTransfer || canCreateWriteOff
  const canSelectItems = canCreateAction || canChangeDisposition
  const { netid } = useParams<{ netid: string }>()
  const [reconciliation, setReconciliation] = useValueState<ActReconciliation | null>(null)
  const [selectedNetIds, setSelectedNetIds] = useValueState<Set<string>>(() => new Set())
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [actionTarget, setActionTarget] = useValueState<ActionTarget | null>(null)
  const [isActionOpen, setActionOpen] = useValueState(false)
  const [isHistoryOpen, setHistoryOpen] = useValueState(false)
  const [appliedActions, setAppliedActions] = useValueState<ActReconciliationAppliedAction[]>([])
  const [dispositionEvents, setDispositionEvents] = useValueState<ActReconciliationDispositionEvent[]>([])
  const [dispositionTarget, setDispositionTarget] = useValueState<DispositionTarget | null>(null)
  const [selectedAppliedAction, setSelectedAppliedAction] =
    useValueState<ActReconciliationAppliedAction | null>(null)
  const [isHistoryLoading, setHistoryLoading] = useValueState(false)
  const [historyError, setHistoryError] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const requestRef = useRef(0)

  const items = useMemo(() => sortByDifferenceFirst(reconciliation?.ActReconciliationItems || []), [reconciliation])
  const organizationNetId = useMemo(() => getOrganizationNetId(reconciliation), [reconciliation])
  const totals = useMemo(() => buildTotals(items), [items])
  const selectedItems = useMemo(
    () => items.filter((item) => item.NetUid && selectedNetIds.has(item.NetUid)),
    [items, selectedNetIds],
  )
  const selectedActiveItems = useMemo(
    () => selectedItems.filter((item) => getItemWorkflowState(item).startsWith('pending-')),
    [selectedItems],
  )
  const activePendingItems = useMemo(
    () => items.filter(isActivePendingItem),
    [items],
  )
  const dismissedItems = useMemo(
    () => items.filter((item) => getItemWorkflowState(item) === 'dismissed'),
    [items],
  )
  const selectedDismissedItems = useMemo(
    () => selectedItems.filter((item) => getItemWorkflowState(item) === 'dismissed'),
    [selectedItems],
  )
  const workflowCounts = useMemo(() => buildWorkflowCounts(items), [items])
  const hasMassZeroActualQty = useMemo(() => {
    const pending = items.filter((item) => getItemWorkflowState(item).startsWith('pending-'))
    const zeroActual = pending.filter((item) => Math.abs(item.ActualQty || 0) <= 0.0000001)

    return pending.length >= 5 && zeroActual.length / pending.length >= 0.8
  }, [items])

  const loadReconciliation = useCallback(() => {
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

    void getActReconciliationByNetId(netid)
      .then((loaded) => {
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
      })
      .catch((loadError: unknown) => {
        if (requestRef.current === requestId) {
          setReconciliation(null)
          setError(loadError instanceof Error ? loadError.message : translate('Не вдалося завантажити акт звірки'))
        }
      })
      .finally(() => {
        if (requestRef.current === requestId) {
          setLoading(false)
        }
      })
  }, [netid, setError, setLoading, setReconciliation, setSelectedNetIds])

  useEffect(() => {
    loadReconciliation()
  }, [loadReconciliation, reloadKey])

  const toggleItem = useCallback(
    (item: ActReconciliationItem) => {
      if (!canSelectItems || !isSelectableItem(item) || !item.NetUid) {
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
    [canSelectItems, setSelectedNetIds],
  )

  const toggleAll = useCallback(() => {
    if (!canSelectItems) {
      return
    }

    const eligible = items.filter((item) => isSelectableItem(item) && item.NetUid)
    const allSelected = eligible.length > 0 && eligible.every((item) => selectedNetIds.has(item.NetUid as string))

    setSelectedNetIds(allSelected ? new Set() : new Set(eligible.map((item) => item.NetUid as string)))
  }, [canSelectItems, items, selectedNetIds, setSelectedNetIds])

  const openSingleAction = useCallback(
    (item: ActReconciliationItem) => {
      if (!canCreateAction || !isActivePendingItem(item)) {
        return
      }

      setActionTarget({ mode: 'single', item })
      setActionOpen(true)
    },
    [canCreateAction, setActionOpen, setActionTarget],
  )

  const openMultiAction = useCallback(() => {
    if (!canCreateAction || selectedActiveItems.length === 0) {
      return
    }

    setActionTarget({ mode: 'multi', items: selectedActiveItems })
    setActionOpen(true)
  }, [canCreateAction, selectedActiveItems, setActionOpen, setActionTarget])

  const openDisposition = useCallback(
    (mode: ActReconciliationDispositionMode, targetItems: ActReconciliationItem[]) => {
      if (!canChangeDisposition || targetItems.length === 0) {
        return
      }

      setDispositionTarget({ mode, items: targetItems })
    },
    [canChangeDisposition, setDispositionTarget],
  )

  const closeDisposition = useCallback(() => {
    setDispositionTarget(null)
  }, [setDispositionTarget])

  const closeAction = useCallback(() => {
    setActionOpen(false)
    setActionTarget(null)
  }, [setActionOpen, setActionTarget])

  const handleApplied = useCallback(() => {
    void loadReconciliation()
  }, [loadReconciliation])

  const openHistory = useCallback(async () => {
    if (!canViewHistory || !netid) {
      return
    }

    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    setSelectedAppliedAction(null)

    const [actionsResult, eventsResult] = await Promise.allSettled([
      getAppliedActions(netid),
      getDispositionHistory(netid),
    ])

    setAppliedActions(actionsResult.status === 'fulfilled' ? actionsResult.value : [])
    setDispositionEvents(eventsResult.status === 'fulfilled' ? eventsResult.value : [])

    const failedSections = [actionsResult, eventsResult]
      .filter((result) => result.status === 'rejected')
      .length

    if (failedSections === 2) {
      setHistoryError(translate('Не вдалося завантажити історію'))
    } else if (failedSections === 1) {
      setHistoryError(translate('Частину історії не вдалося завантажити. Доступні записи показано нижче.'))
    }

    setHistoryLoading(false)
  }, [canViewHistory, netid, setAppliedActions, setDispositionEvents, setHistoryError, setHistoryLoading, setHistoryOpen, setSelectedAppliedAction])

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    setSelectedAppliedAction(null)
  }, [setHistoryOpen, setSelectedAppliedAction])

  return {
    actionTarget,
    activePendingItems,
    appliedActions,
    dispositionEvents,
    dispositionTarget,
    dismissedItems,
    error,
    historyError,
    isActionOpen,
    isHistoryLoading,
    isHistoryOpen,
    isLoading,
    items,
    hasMassZeroActualQty,
    organizationNetId,
    reconciliation,
    selectedAppliedAction,
    selectedItems,
    selectedActiveItems,
    selectedDismissedItems,
    selectedNetIds,
    totals,
    workflowCounts,
    canChangeDisposition,
    canCreateAction,
    canCreateProductIncome,
    canCreateProductTransfer,
    canCreateWriteOff,
    canSelectItems,
    canViewHistory,
    closeAction,
    closeHistory,
    closeDisposition,
    handleApplied,
    openHistory,
    openDisposition,
    openMultiAction,
    openSingleAction,
    reload,
    setSelectedAppliedAction,
    toggleAll,
    toggleItem,
  }
}

export function ActReconciliationViewPage() {
  return (
    <PermissionGate permissionKey={PermissionKeys.ActReconciliations.Page.View} fallback={<ActReconciliationPermissionDenied />}>
      <PermissionGate permissionKey={PermissionKeys.ActReconciliations.Act.OpenDetails} fallback={<ActReconciliationPermissionDenied />}>
        <ActReconciliationViewPageContent />
      </PermissionGate>
    </PermissionGate>
  )
}

function ActReconciliationViewPageContent() {
  const model = useActReconciliationViewModel()

  return <ActReconciliationViewPageView model={model} />
}

function ActReconciliationPermissionDenied() {
  const { t } = useI18n()

  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
      {t('У вашої ролі немає права відкривати акт звірки.')}
    </Alert>
  )
}

function ActReconciliationViewPageView({ model }: { model: ReturnType<typeof useActReconciliationViewModel> }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { density } = useDataTableDensity('act-reconciliation-items', 'normal')
  const columns = useItemColumns({
    canChangeDisposition: model.canChangeDisposition,
    canCreateAction: model.canCreateAction,
    canSelectItems: model.canSelectItems,
    items: model.items,
    selectedNetIds: model.selectedNetIds,
    onOpenDisposition: model.openDisposition,
    onOpenAction: model.openSingleAction,
    onToggleAll: model.toggleAll,
    onToggleItem: model.toggleItem,
  })

  return (
    <AppDrawer
      opened
      keepMounted={false}
      position="right"
      size="wide"
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>{getTitle(model.reconciliation)}</span>
      }
      onClose={() => navigate('/ukraine/act/reconcoliation')}
    >
    <Stack gap="md">
      <Group justify="flex-end" align="center">
        <Group gap="xs">
          {model.canViewHistory && <Tooltip label={t('Історія змін')}>
            <ActionIcon
              aria-label={t('Історія змін')}
              color="gray"
              disabled={!model.reconciliation}
              size={38}
              variant="light"
              onClick={() => void model.openHistory()}
            >
              <History size={18} />
            </ActionIcon>
          </Tooltip>}
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={model.isLoading}
              size={38}
              variant="light"
              onClick={() => model.reload()}
            >
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
          {model.canCreateAction && model.selectedActiveItems.length > 0 && (
            <Button color={CREATE_ACTION_COLOR} onClick={model.openMultiAction}>
              {t('Створити складську дію')} ({model.selectedActiveItems.length})
            </Button>
          )}
          {model.canChangeDisposition && model.selectedActiveItems.length > 0 && (
            <Button
              color="orange"
              variant="light"
              onClick={() => model.openDisposition('dismiss', model.selectedActiveItems)}
            >
              {t('Закрити без руху')} ({model.selectedActiveItems.length})
            </Button>
          )}
          {model.canChangeDisposition && model.selectedDismissedItems.length > 0 && (
            <Button
              color="blue"
              variant="light"
              onClick={() => model.openDisposition('reopen', model.selectedDismissedItems)}
            >
              {t('Повернути в роботу')} ({model.selectedDismissedItems.length})
            </Button>
          )}
          {model.canChangeDisposition && model.selectedItems.length === 0 && model.activePendingItems.length > 0 && (
            <Button
              color="orange"
              variant="subtle"
              onClick={() => model.openDisposition('dismiss', model.activePendingItems)}
            >
              {t('Закрити всі активні')} ({model.activePendingItems.length})
            </Button>
          )}
          {model.canChangeDisposition && model.selectedItems.length === 0 && model.dismissedItems.length > 0 && (
            <Button
              color="blue"
              variant="subtle"
              onClick={() => model.openDisposition('reopen', model.dismissedItems)}
            >
              {t('Повернути всі закриті')} ({model.dismissedItems.length})
            </Button>
          )}
        </Group>
      </Group>

      {model.error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {model.error}
        </Alert>
      )}

      {model.hasMassZeroActualQty && (
        <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
          <Text fw={600}>{t('Масове нульове фактичне значення')}</Text>
          <Text size="sm">
            {t('У більшості невирішених позицій фактична кількість дорівнює нулю. Перевірте в 1С, чи інвентаризацію завершили та провели конкретною складською дією, перш ніж створювати документи масово.')}
          </Text>
        </Alert>
      )}

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <DataTable
          columns={columns}
          data={model.items}
          density={density}
          emptyText={t('Позицій не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          isLoading={model.isLoading}
          layoutVersion="act-reconciliation-items-table-2"
          loadingText={t('Завантаження позицій')}
          maxHeight="calc(100vh - 360px)"
          minWidth={1120}
          showToolbar={false}
          tableId="act-reconciliation-items"
          onRowClick={model.canSelectItems ? model.toggleItem : undefined}
        />
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
        <TotalValue label={t('Всього товарів')} value={model.totals.totalProducts} />
        <TotalValue
          color="red"
          label={t('Очікує · недостача')}
          value={model.workflowCounts['pending-shortage']}
        />
        <TotalValue
          color="teal"
          label={t('Очікує · надлишок')}
          value={model.workflowCounts['pending-surplus']}
        />
        <TotalValue color="orange" label={t('Закрито без руху')} value={model.workflowCounts.dismissed} />
        <TotalValue color="green" label={t('Опрацьовано')} value={model.workflowCounts.resolved} />
        <TotalValue label={t('Загальна кількість')} value={model.totals.totalCount} />
      </SimpleGrid>

      <ActReconciliationActionsModal
        canCreateProductIncome={model.canCreateProductIncome}
        canCreateProductTransfer={model.canCreateProductTransfer}
        canCreateWriteOff={model.canCreateWriteOff}
        opened={model.isActionOpen}
        organizationNetId={model.organizationNetId}
        target={model.actionTarget}
        onApplied={model.handleApplied}
        onClose={model.closeAction}
      />

      <ActReconciliationDispositionModal
        actNetId={model.reconciliation?.NetUid || ''}
        items={model.dispositionTarget?.items || []}
        mode={model.dispositionTarget?.mode || 'dismiss'}
        opened={Boolean(model.dispositionTarget)}
        permitted={model.canChangeDisposition}
        onApplied={model.handleApplied}
        onClose={model.closeDisposition}
      />

      <AppliedActionsHistoryDrawer
        appliedActions={model.appliedActions}
        dispositionEvents={model.dispositionEvents}
        error={model.historyError}
        isLoading={model.isHistoryLoading}
        opened={model.isHistoryOpen}
        selectedAction={model.selectedAppliedAction}
        title={getTitle(model.reconciliation)}
        onClose={model.closeHistory}
        onSelectAction={model.setSelectedAppliedAction}
      />
    </Stack>
    </AppDrawer>
  )
}

/* Totals per the pattern: no frame — a mono label with the orange dot (section
   heading language) and a big mono value (semantic red/teal kept). */
function TotalValue({ color, label, value }: { color?: string; label: string; value: unknown }) {
  return (
    <Box>
      <Text className="app-section-title" fw={600} size="xs">
        {label}
      </Text>
      <Text c={color} fw={600} size="lg" style={{ ...ACT_VIEW_MONO_STYLE, marginTop: 2 }}>
        {String(value)}
      </Text>
    </Box>
  )
}

const ACT_VIEW_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

function useItemColumns({
  canChangeDisposition,
  canCreateAction,
  canSelectItems,
  items,
  selectedNetIds,
  onOpenDisposition,
  onOpenAction,
  onToggleAll,
  onToggleItem,
}: {
  canChangeDisposition: boolean
  canCreateAction: boolean
  canSelectItems: boolean
  items: ActReconciliationItem[]
  selectedNetIds: Set<string>
  onOpenDisposition: (
    mode: ActReconciliationDispositionMode,
    items: ActReconciliationItem[],
  ) => void
  onOpenAction: (item: ActReconciliationItem) => void
  onToggleAll: () => void
  onToggleItem: (item: ActReconciliationItem) => void
}): DataTableColumn<ActReconciliationItem>[] {
  const { t } = useI18n()
  const storageColumns = useMemo(() => buildStorageColumns(items), [items])
  const eligible = useMemo(() => items.filter((item) => isSelectableItem(item) && item.NetUid), [items])
  const allSelected = eligible.length > 0 && eligible.every((item) => selectedNetIds.has(item.NetUid as string))

  return useMemo<DataTableColumn<ActReconciliationItem>[]>(
    () => [
      ...(canSelectItems ? [{
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
              disabled={!isSelectableItem(item)}
              onChange={() => onToggleItem(item)}
            />
          </Box>
        ),
      } satisfies DataTableColumn<ActReconciliationItem>] : []),
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
        width: 140,
        minWidth: 120,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => <Text fw={700}>{displayValue(item.Product?.VendorCode)}</Text>,
      },
      {
        id: 'name',
        header: t('Назва товару'),
        width: 220,
        minWidth: 190,
        accessor: (item) => item.Product?.NameUA || item.Product?.Name,
        cell: (item) => (
          <Text lineClamp={2}>{displayValue(item.Product?.NameUA || item.Product?.Name)}</Text>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 80,
        minWidth: 72,
        align: 'right',
        accessor: (item) => item.OrderedQty,
        cell: (item) => displayValue(item.OrderedQty),
      },
      {
        id: 'actualQty',
        header: t('Фактична К-сть'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (item) => item.ActualQty,
        cell: (item) => displayValue(item.ActualQty),
      },
      {
        id: 'difference',
        header: t('Різниця'),
        width: 100,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.QtyDifference,
        cell: (item) => <DifferenceText item={item} />,
      },
      {
        id: 'workflowStatus',
        header: t('Статус'),
        width: 220,
        minWidth: 190,
        accessor: (item) => getItemWorkflowState(item),
        cell: (item) => <WorkflowStatusBadge item={item} />,
      },
      {
        id: 'action',
        header: '',
        width: 64,
        minWidth: 56,
        align: 'center',
        rowActions: true,
        enableSorting: false,
        cell: (item) => {
          const state = getItemWorkflowState(item)

          if (state === 'dismissed' && canChangeDisposition) {
            return (
              <Box onClick={(event) => event.stopPropagation()}>
                <TableRowAction
                  action="restore"
                  label={t('Повернути в роботу')}
                  tone="success"
                  onClick={() => onOpenDisposition('reopen', [item])}
                />
              </Box>
            )
          }

          return canCreateAction && state.startsWith('pending-') ? (
            <Box onClick={(event) => event.stopPropagation()}>
              <TableRowAction
                action="settings"
                label={t('Створити складську дію')}
                tone={item.NegativeDifference ? 'danger' : 'success'}
                onClick={() => onOpenAction(item)}
              />
            </Box>
          ) : null
        },
      },
      ...storageColumns,
    ],
    [allSelected, canChangeDisposition, canCreateAction, canSelectItems, eligible.length, items, onOpenAction, onOpenDisposition, onToggleAll, onToggleItem, selectedNetIds, storageColumns, t],
  )
}

function WorkflowStatusBadge({ item }: { item: ActReconciliationItem }) {
  const { t } = useI18n()
  const state = getItemWorkflowState(item)

  if (item.IsDispositionStale) {
    return (
      <Stack gap={2}>
        <Badge color="yellow" variant="light">{t('Дані змінилися · перевірити')}</Badge>
        <Text c="orange" lineClamp={1} size="xs">
          {item.DispositionReasonCode
            ? `${t('Було')}: ${t(getDispositionReasonLabel(item.DispositionReasonCode))}`
            : t('Перевірити повторно')}
        </Text>
      </Stack>
    )
  }

  if (state === 'dismissed') {
    return (
      <Stack gap={2}>
        <Badge color="orange" variant="light">{t('Закрито без руху')}</Badge>
        <Text c="dimmed" lineClamp={1} size="xs">
          {t(getDispositionReasonLabel(item.DispositionReasonCode))}
        </Text>
      </Stack>
    )
  }

  if (state === 'resolved') {
    return <Badge color="green" variant="light">{t('Опрацьовано')}</Badge>
  }

  return (
    <Badge color={state === 'pending-shortage' ? 'red' : 'teal'} variant="light">
      {state === 'pending-shortage' ? t('Очікує · недостача') : t('Очікує · надлишок')}
    </Badge>
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
      width: 110,
      minWidth: 90,
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

function sortByDifferenceFirst(items: ActReconciliationItem[]): ActReconciliationItem[] {
  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => {
      const difference = getWorkflowSortRank(left.item) - getWorkflowSortRank(right.item)

      return difference !== 0 ? difference : left.index - right.index
    })
    .map((entry) => entry.item)
}

function getWorkflowSortRank(item: ActReconciliationItem): number {
  const state = getItemWorkflowState(item)

  if (state === 'pending-shortage') {
    return 0
  }

  if (state === 'pending-surplus') {
    return 1
  }

  return state === 'dismissed' ? 2 : 3
}

function isSelectableItem(item: ActReconciliationItem): boolean {
  return item.HasDifference === true && (item.QtyDifference || 0) > 0.0000001
}

function isActivePendingItem(item: ActReconciliationItem): boolean {
  return getItemWorkflowState(item).startsWith('pending-')
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
