import { TableChip } from '../../../shared/ui/TableChip'
import {
  Alert,
  Badge,
  Button,
  Group,
  Text,
} from '@mantine/core'
import { CircleAlert, Download } from 'lucide-react'
import { useMemo } from 'react'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  DocumentDetailFlag,
  DocumentDetailChip,
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
import { mergePlacementQuantities } from '../../../shared/placements/placementAddress'
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

/* Four-digit year: «31.12.2099, 10:00», never the ambiguous «31.12.99». */
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
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
  const totalAmount = useMemo(() => getWriteOffTotalAmount(items), [items])

  return (
    <AppModal
      opened={Boolean(order)}
      size="min(1240px, calc(100vw - 32px))"
      title={t('Акт списання')}
      onClose={onClose}
    >
      {order && (
        <DocumentDetailLayout
          variant="inventory"
          summary={
            <DocumentDetailSummary
              eyebrow={t('Акт списання')}
              title={displayValue(order.Number)}
              meta={<><DocumentDetailChip tone="info">{formatDateTime(order.FromDate)}</DocumentDetailChip>{order.Storage?.Name ? <DocumentDetailChip tone="storage">{order.Storage.Name}</DocumentDetailChip> : null}</>}
              metrics={
                <>
                  <DocumentDetailMetric label={t('Позицій')} value={String(items.length)} />
                  <DocumentDetailMetric label={t('К-сть')} value={String(totalQty)} />
                  {totalAmount !== null ? <DocumentDetailMetric label={t('Сума')} value={moneyFormat.format(totalAmount)} /> : null}
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
          <DocumentDetailSection title={t('Реквізити документа')}>
            <DocumentDetailRow label={t('Організація')} value={<TableChip tone="product" value={order.Organization?.Name} />} />
            <DocumentDetailRow label={t('Склад')} value={<TableChip tone="storage" value={order.Storage?.Name} />} />
            <DocumentDetailRow label={t('Відповідальний')} value={getResponsibleName(order)} />
            {order.Comment && <DocumentDetailRow label={t('Коментар')} value={order.Comment} />}
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
              showToolbar={false}
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
    </AppModal>
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
        cell: (item) => <TableChip tone="product" value={displayValue(item.Product?.VendorCode)} />,
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
      ...(getWriteOffTotalAmount(items) !== null ? [
        {
          id: 'price',
          header: t('Ціна'),
          width: 110,
          minWidth: 90,
          align: 'right' as const,
          accessor: (item: DepreciatedOrderItem) => item.PerUnitPrice,
          cell: (item: DepreciatedOrderItem) => formatMoney(item.PerUnitPrice),
        },
        {
          id: 'amount',
          header: t('Сума'),
          width: 120,
          minWidth: 100,
          align: 'right' as const,
          accessor: (item: DepreciatedOrderItem) => getLineAmount(item),
          cell: (item: DepreciatedOrderItem) => formatMoney(getLineAmount(item)),
        },
      ] : []),
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

const placementQtyFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

const moneyFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

function formatMoney(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormat.format(value) : '-'
}

function getLineAmount(item: DepreciatedOrderItem): number | null {
  return typeof item.PerUnitPrice === 'number' && typeof item.Qty === 'number'
    ? Math.round(item.PerUnitPrice * item.Qty * 100) / 100
    : null
}

/** Document total when the payload carries prices; null (no price columns) otherwise. */
function getWriteOffTotalAmount(items: DepreciatedOrderItem[]): number | null {
  if (!items.some((item) => typeof item.PerUnitPrice === 'number' && item.PerUnitPrice > 0)) {
    return null
  }

  return Math.round(items.reduce((sum, item) => sum + (getLineAmount(item) ?? 0), 0) * 100) / 100
}

/**
 * What THIS act took from each cell: ProductLocation.Qty. ProductPlacement.Qty is
 * the cell's current remainder and keeps changing after posting.
 */
function formatPlacements(locations: DepreciatedOrderLocation[]): string {
  return mergePlacementQuantities(
    locations.filter((location) => location.ProductPlacement),
    (location) => location.ProductPlacement,
    (location) => location.Qty,
  )
    .map(({ address, qty }) => {
      const position = !address || address === translate('Без розміщення') ? address : `${translate('Позиція')} ${address}`
      return [position, `${translate('К-сть')} ${placementQtyFormat.format(qty)}`].filter(Boolean).join('. ')
    })
    .join('; ')
}

function formatDateTime(value?: Date | string): string {
  return formatValue(value, true)
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
