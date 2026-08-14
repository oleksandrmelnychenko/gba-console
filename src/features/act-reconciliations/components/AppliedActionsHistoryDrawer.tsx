import { Alert, Badge, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getDispositionReasonLabel } from '../actReconciliationWorkflow'
import type {
  ActReconciliationAppliedAction,
  ActReconciliationDispositionEvent,
} from '../types'
import { AppliedActionsGrid } from './AppliedActionsGrid'

const historyDateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function AppliedActionsHistoryDrawer({
  appliedActions,
  dispositionEvents,
  error,
  isLoading,
  opened,
  selectedAction,
  title,
  onClose,
  onSelectAction,
}: {
  appliedActions: ActReconciliationAppliedAction[]
  dispositionEvents: ActReconciliationDispositionEvent[]
  error: string | null
  isLoading: boolean
  opened: boolean
  selectedAction: ActReconciliationAppliedAction | null
  title: string
  onClose: () => void
  onSelectAction: (action: ActReconciliationAppliedAction) => void
}) {
  const { t } = useI18n()
  const columns = useHistoryColumns(appliedActions)
  const dispositionColumns = useDispositionHistoryColumns(t)

  return (
    <AppDrawer opened={opened} padding="lg" position="right" size="72rem" title={title} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Text fw={700}>{t('Історія')}</Text>

        <Text c="dimmed" fw={600} size="sm">{t('Складські документи')}</Text>

        <DataTable
          columns={columns}
          data={appliedActions}
          emptyText={t('Історію не знайдено')}
          getRowId={(action, index) => String(action.ActReconciliationItem?.NetUid || index)}
          isLoading={isLoading}
          layoutVersion="act-reconciliation-history-table-1"
          loadingText={t('Завантаження історії')}
          maxHeight="40vh"
          minWidth={760}
          tableId="act-reconciliation-history"
          onRowClick={onSelectAction}
        />

        {selectedAction && <AppliedActionsGrid appliedAction={selectedAction} />}

        <Text c="dimmed" fw={600} mt="sm" size="sm">{t('Рішення без руху товару')}</Text>

        <DataTable
          columns={dispositionColumns}
          data={dispositionEvents}
          emptyText={t('Рішень без руху не знайдено')}
          getRowId={(event, index) => String(event.Id || `${event.OperationNetUid}-${event.ActReconciliationItemNetUid}-${index}`)}
          isLoading={isLoading}
          layoutVersion="act-reconciliation-disposition-history-table-1"
          loadingText={t('Завантаження історії')}
          maxHeight="40vh"
          minWidth={980}
          tableId="act-reconciliation-disposition-history"
        />
      </Stack>
    </AppDrawer>
  )
}

function useDispositionHistoryColumns(
  t: (key: string) => string,
): DataTableColumn<ActReconciliationDispositionEvent>[] {
  return useMemo<DataTableColumn<ActReconciliationDispositionEvent>[]>(
    () => [
      {
        id: 'createdAt',
        header: t('Дата і час'),
        width: 170,
        minWidth: 150,
        accessor: (event) => getDateTime(event.CreatedAtUtc),
        cell: (event) => formatDateTime(event.CreatedAtUtc),
      },
      {
        id: 'action',
        header: t('Рішення'),
        width: 170,
        minWidth: 150,
        cell: (event) => (
          <Badge color={event.IsDismissed ? 'orange' : 'blue'} variant="light">
            {event.IsDismissed ? t('Закрито без руху') : t('Повернуто в роботу')}
          </Badge>
        ),
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 150,
        minWidth: 120,
        accessor: (event) => event.ProductVendorCode,
        cell: (event) => <Text fw={700}>{displayValue(event.ProductVendorCode)}</Text>,
      },
      {
        id: 'productName',
        header: t('Назва товару'),
        minWidth: 220,
        accessor: (event) => event.ProductName,
        cell: (event) => <Text lineClamp={2}>{displayValue(event.ProductName)}</Text>,
      },
      {
        id: 'reason',
        header: t('Причина'),
        width: 230,
        minWidth: 180,
        accessor: (event) => event.ReasonCode,
        cell: (event) => event.IsDismissed ? t(getDispositionReasonLabel(event.ReasonCode)) : '-',
      },
      {
        id: 'comment',
        header: t('Пояснення'),
        minWidth: 240,
        accessor: (event) => event.Comment,
        cell: (event) => <Text lineClamp={2}>{displayValue(event.Comment)}</Text>,
      },
      {
        id: 'user',
        header: t('Хто змінив'),
        width: 190,
        minWidth: 150,
        accessor: (event) => event.UserName,
        cell: (event) => displayValue(event.UserName),
      },
    ],
    [t],
  )
}

function useHistoryColumns(
  appliedActions: ActReconciliationAppliedAction[],
): DataTableColumn<ActReconciliationAppliedAction>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ActReconciliationAppliedAction>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (action) => String(appliedActions.indexOf(action) + 1),
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 160,
        minWidth: 124,
        accessor: (action) => action.ActReconciliationItem?.Product?.VendorCode,
        cell: (action) => <Text fw={700}>{displayValue(action.ActReconciliationItem?.Product?.VendorCode)}</Text>,
      },
      {
        id: 'name',
        header: t('Назва товару'),
        minWidth: 240,
        accessor: (action) =>
          action.ActReconciliationItem?.Product?.NameUA || action.ActReconciliationItem?.Product?.Name,
        cell: (action) => (
          <Text lineClamp={2}>
            {displayValue(action.ActReconciliationItem?.Product?.NameUA || action.ActReconciliationItem?.Product?.Name)}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 96,
        minWidth: 80,
        align: 'right',
        accessor: (action) => action.ActReconciliationItem?.OrderedQty,
        cell: (action) => displayValue(action.ActReconciliationItem?.OrderedQty),
      },
      {
        id: 'actualQty',
        header: t('Фактична К-сть'),
        width: 140,
        minWidth: 110,
        align: 'right',
        accessor: (action) => action.ActReconciliationItem?.ActualQty,
        cell: (action) => displayValue(action.ActReconciliationItem?.ActualQty),
      },
      {
        id: 'difference',
        header: t('Різниця'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (action) => action.ActReconciliationItem?.QtyDifference,
        cell: (action) => <DifferenceText item={action.ActReconciliationItem} />,
      },
    ],
    [appliedActions, t],
  )
}

function DifferenceText({
  item,
}: {
  item?: ActReconciliationAppliedAction['ActReconciliationItem']
}) {
  if (!item?.HasDifference) {
    return <Text size="sm">{item?.QtyDifference ?? '-'}</Text>
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function getDateTime(value: unknown): number {
  if (!value) {
    return 0
  }

  const parsed = value instanceof Date ? value : new Date(String(value))

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const parsed = value instanceof Date ? value : new Date(value)

  return Number.isNaN(parsed.getTime())
    ? String(value)
    : historyDateTimeFormatter.format(parsed)
}
