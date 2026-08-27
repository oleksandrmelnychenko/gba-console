import {
  Alert,
  Badge,
  Button,
  Group,
  Text,
} from '@mantine/core'
import { CircleAlert, Download } from 'lucide-react'
import { useMemo } from 'react'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import {
  DocumentDetailFlag,
  DocumentDetailLayout,
  DocumentDetailMetric,
  DocumentDetailRow,
  DocumentDetailSection,
  DocumentDetailSummary,
} from '../../../shared/ui/document-detail/DocumentDetail'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import type {
  DepreciatedOrder,
  DepreciatedOrderExportDocument,
  DepreciatedOrderItem,
  DepreciatedOrderLocation,
} from '../types'

const DEPRECIATED_ORDER_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'name'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export type DepreciatedOrderDetailDrawerProps = {
  canExport: boolean
  detailError: string | null
  downloadDocument: DepreciatedOrderExportDocument | null
  downloadError: string | null
  downloadOpened: boolean
  isDetailLoading: boolean
  isDownloading: boolean
  order: DepreciatedOrder | null
  onClose: () => void
  onCloseDownload: () => void
  onExport: (order: DepreciatedOrder) => void
}

export function DepreciatedOrderDetailDrawer({
  canExport,
  detailError,
  downloadDocument,
  downloadError,
  downloadOpened,
  isDetailLoading,
  isDownloading,
  order,
  onClose,
  onCloseDownload,
  onExport,
}: DepreciatedOrderDetailDrawerProps) {
  const { t } = useI18n()
  const items = useMemo(() => order?.DepreciatedOrderItems || [], [order?.DepreciatedOrderItems])
  const itemColumns = useDepreciatedOrderItemColumns(items)
  const totalQty = useMemo(() => items.reduce((sum, item) => sum + (Number(item.Qty) || 0), 0), [items])

  return (
    <AppDrawer
      opened={Boolean(order)}
      padding="lg"
      position="right"
      size="wide"
      title={t('Акт списання')}
      onClose={onClose}
    >
      {order && (
        <DocumentDetailLayout
          summary={
            <DocumentDetailSummary
              eyebrow={t('Акт списання')}
              title={displayValue(order.Number)}
              meta={[formatDate(order.FromDate), order.Storage?.Name].filter(Boolean).join(' · ')}
              metrics={
                <>
                  <DocumentDetailMetric label={t('Позицій')} value={String(items.length)} />
                  <DocumentDetailMetric label={t('К-сть')} value={String(totalQty)} />
                </>
              }
            />
          }
          actions={
            <Group justify="space-between">
              <Group gap="xs">
                {order.IsManagement && <DocumentDetailFlag active label={t('Управ.')} />}
                {isDetailLoading && (
                  <Badge className="app-role-pill is-gray" variant="light">{t('Завантаження деталей')}</Badge>
                )}
              </Group>
              {canExport && (
                <Button
                  disabled={!order.NetUid}
                  leftSection={<Download size={16} />}
                  loading={isDownloading}
                  variant="default"
                  onClick={() => onExport(order)}
                >
                  {t('Завантажити')}
                </Button>
              )}
            </Group>
          }
        >
          <DocumentDetailSection subtitle={displayValue(order.Number)} title={t('Документ')}>
            <DocumentDetailRow label={t('Від якої дати')} mono value={formatDateTime(order.FromDate)} />
            <DocumentDetailRow label={t('Номер')} mono value={order.Number} />
            {order.Comment && (
              <DocumentDetailRow label={t('Коментар')} value={order.Comment} wide />
            )}
          </DocumentDetailSection>

          <DocumentDetailSection title={t('Учасники та склад')}>
            <DocumentDetailRow label={t('Організація')} value={order.Organization?.Name} wide />
            <DocumentDetailRow label={t('Склад')} value={order.Storage?.Name} />
            <DocumentDetailRow label={t('Відповідальний')} value={getResponsibleName(order)} />
          </DocumentDetailSection>

          <DocumentDetailSection stacked subtitle={String(items.length)} title={t('Позиції')}>
            {detailError && (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                {detailError}
              </Alert>
            )}
            <DataTable
              columns={itemColumns}
              data={items}
              defaultLayout={DEPRECIATED_ORDER_ITEMS_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Позицій не знайдено')}
              getRowId={(item, index) => String(item.NetUid || item.Id || index)}
              isLoading={isDetailLoading}
              layoutVersion="depreciated-order-items-table-1"
              loadingText={t('Завантаження позицій')}
              maxHeight="calc(100vh - 420px)"
              minWidth={920}
              tableId="depreciated-order-items"
            />
          </DocumentDetailSection>
        </DocumentDetailLayout>
      )}

      {canExport && (
        <DocumentExportModal
          document={downloadDocument}
          error={downloadError}
          isLoading={isDownloading}
          opened={downloadOpened}
          title={t('Завантажити')}
          onClose={onCloseDownload}
        />
      )}
    </AppDrawer>
  )
}

function useDepreciatedOrderItemColumns(items: DepreciatedOrderItem[]): DataTableColumn<DepreciatedOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DepreciatedOrderItem>[]>(
    () => [
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
          <Text fw={600} lineClamp={2}>
            {displayValue(item.Product?.NameUA || item.Product?.Name)}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 96,
        minWidth: 80,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => displayValue(item.Qty),
      },
      {
        id: 'reason',
        header: t('Причина'),
        width: 250,
        minWidth: 180,
        accessor: (item) => item.Reason,
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(item.Reason)}
          </Text>
        ),
      },
      {
        id: 'placements',
        header: t('Позиція'),
        minWidth: 200,
        accessor: (item) => formatPlacements(item.ProductLocations || []),
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(formatPlacements(item.ProductLocations || []))}
          </Text>
        ),
      },
    ],
    [items, t],
  )
}


function getResponsibleName(order: DepreciatedOrder): string {
  const responsible = order.Responsible

  return (
    responsible?.LastName?.trim()
    || responsible?.FullName?.trim()
    || responsible?.Name?.trim()
    || [responsible?.LastName, responsible?.FirstName, responsible?.MiddleName].filter(Boolean).join(' ').trim()
    || ''
  )
}

function formatPlacements(locations: DepreciatedOrderLocation[]): string {
  return locations
    .reduce<string[]>((values, location) => {
      const placement = location.ProductPlacement

      if (!placement) {
        return values
      }

      const address = [placement.StorageNumber, placement.RowNumber, placement.CellNumber].filter(Boolean).join('-')
      const qty = placement.Qty !== undefined ? `${translate('К-сть')} ${placement.Qty}` : ''
      const formatted = [`${translate('Позиція')} ${address}`.trim(), qty].filter(Boolean).join('. ')

      if (formatted) {
        values.push(formatted)
      }

      return values
    }, [])
    .join('; ')
}

function formatDateTime(value?: Date | string): string {
  return formatValue(value, true)
}

function formatDate(value?: Date | string): string {
  return formatValue(value, false)
}

function formatValue(value: Date | string | undefined, withTime: boolean): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return withTime ? dateTimeFormatter.format(date) : date.toLocaleDateString('uk-UA')
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
