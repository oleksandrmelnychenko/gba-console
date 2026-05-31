import { Alert, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { ActReconciliationAppliedAction } from '../types'
import { AppliedActionsGrid } from './AppliedActionsGrid'

export function AppliedActionsHistoryDrawer({
  appliedActions,
  error,
  isLoading,
  opened,
  selectedAction,
  title,
  onClose,
  onSelectAction,
}: {
  appliedActions: ActReconciliationAppliedAction[]
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

  return (
    <AppDrawer opened={opened} padding="lg" position="right" size="72rem" title={title} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Text fw={700}>{t('Історія')}</Text>

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
      </Stack>
    </AppDrawer>
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
