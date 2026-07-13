import {
  Alert,
  Anchor,
  Badge,
  Button,
  Stack,
  Text,
} from '@mantine/core'
import { CircleAlert, Download, FileText } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useMemo } from 'react'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
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
      size="78rem"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{translate('Акт списання')}</span>}
      onClose={onClose}
    >
      {order && (
        <Stack gap="md">
          {detailError && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {detailError}
            </Alert>
          )}

          <div className="app-detail-hero">
            <div>
              <span className="app-detail-eyebrow">{t('Акт списання')}</span>
              <div className="app-detail-title">
                <strong>{getOrderTitle(order)}</strong>
                {order.Storage?.Name && <span>{order.Storage.Name}</span>}
              </div>
              {(order.IsManagement || isDetailLoading) && (
                <div className="app-detail-badges">
                  {order.IsManagement && (
                    <Badge className="app-role-pill" variant="light">
                      {t('Управ.')}
                    </Badge>
                  )}
                  {isDetailLoading && (
                    <Badge className="app-role-pill is-gray" variant="light">
                      {t('Завантаження деталей')}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="app-detail-hero__side">
              <Button
                disabled={!order.NetUid}
                leftSection={<Download size={16} />}
                loading={isDownloading}
                variant="default"
                onClick={() => onExport(order)}
              >
                {t('Завантажити')}
              </Button>
              <div className="app-detail-metrics">
                <div className="app-detail-metric">
                  <span>{t('Позицій')}</span>
                  <strong>{items.length}</strong>
                </div>
                <div className="app-detail-metric">
                  <span>{t('К-сть')}</span>
                  <strong>{totalQty}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="app-detail-grid">
            <DetailField label={t('Організація')} value={order.Organization?.Name} />
            <DetailField label={t('Відповідальний')} value={getResponsibleName(order)} />
            <DetailField label={t('Склад')} value={order.Storage?.Name} />
            <DetailField label={t('Від якої дати')} value={formatDateTime(order.FromDate)} />
            {order.Comment && (
              <div className="app-detail-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('Коментар')}</span>
                <strong>{order.Comment}</strong>
              </div>
            )}
          </div>

          <div className="app-detail-section-head">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Позиції')}
            </Text>
            <Badge className="app-role-pill is-gray" variant="light">
              {items.length}
            </Badge>
          </div>

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
        </Stack>
      )}

      <AppModal centered opened={downloadOpened} title={t('Завантажити')} onClose={onCloseDownload}>
        <Stack gap="sm">
          {isDownloading ? (
            <Text c="dimmed" size="sm">
              {t('Завантаження')}
            </Text>
          ) : downloadError ? (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {downloadError}
            </Alert>
          ) : downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-pdf">
                    <FileText size={22} strokeWidth={1.8} />
                  </span>
                  <span>{t('PDF документ')}</span>
                </Anchor>
              )}
            </>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Документ недоступний для завантаження')}
            </Text>
          )}
        </Stack>
      </AppModal>
    </AppDrawer>
  )
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="app-detail-field">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
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

function getOrderTitle(order: DepreciatedOrder): string {
  return [order.Number ? `№ ${order.Number}` : '', order.FromDate ? `${translate('Від')} ${formatDate(order.FromDate)}` : '']
    .filter(Boolean)
    .join(' · ')
    || translate('Акт списання')
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
