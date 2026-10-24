import { useBusyState } from '../hooks/useBusyState'
import { Alert, Button, Group, Skeleton, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ChevronRight, CircleAlert, FileText, History, Package, PackageCheck, ReceiptText, Truck } from 'lucide-react'
import { DocumentExportModal } from '../ui/document-export-modal/DocumentExportModal'
import { useRef } from 'react'
import { useValueState } from '../hooks/useValueState'
import { useI18n } from '../i18n/useI18n'
import { usePersistentSaleJsonMutationRunner } from '../../features/sales-ukraine/usePersistentSaleJsonMutation'
import type { SalesMutationOperationOptions } from '../../features/sales-ukraine/salesMutationOperation'
import { AppModal } from '../ui/AppModal'
import { DataTable } from '../ui/data-table/DataTable'
import type { DataTableColumn } from '../ui/data-table/types'
import { DocumentDetailChip, DocumentDetailLayout, DocumentDetailSection, DocumentDetailSummary } from '../ui/document-detail/DocumentDetail'
import { TableChip } from '../ui/TableChip'
import { TableRowAction } from '../ui/table-row-action'
import { CREATE_ACTION_COLOR } from '../ui/page-header-actions/PageHeaderActions'
import './sale-audit-detail.css'
import {
  getWarehouseUkraineAuditInvoiceDocument,
  getWarehouseUkraineAuditShiftedDocument,
  type SaleAuditHistoryMutationPayload,
} from './saleAuditApi'
import {
  SaleAuditShiftStatusType,
  type SaleAuditLifeCycleLineItem,
  type SaleAuditOrderItem,
  type SaleAuditPrintDocument,
  type SaleAuditShiftStatus,
  type SaleAuditStatistic,
} from './saleAuditTypes'

type AuditPrintKind = 'act' | 'invoice'

export type SaleAuditDocumentApi = {
  confirm: (
    payload: SaleAuditHistoryMutationPayload,
    operation: SalesMutationOperationOptions,
  ) => Promise<void>
  getInvoice: typeof getWarehouseUkraineAuditInvoiceDocument
  getShifted: typeof getWarehouseUkraineAuditShiftedDocument
}

const DEFAULT_SALE_AUDIT_DOCUMENT_API: SaleAuditDocumentApi = {
  confirm: rejectUnscopedAuditConfirmation,
  getInvoice: getWarehouseUkraineAuditInvoiceDocument,
  getShifted: getWarehouseUkraineAuditShiftedDocument,
}

async function rejectUnscopedAuditConfirmation(): Promise<void> {
  throw new Error('Scoped sale-audit confirmation API is not configured')
}

type SaleAuditDetailProps = {
  documentApi?: SaleAuditDocumentApi
  documentNumber?: string
  error: string | null
  isLoading: boolean
  onConfirmed?: () => void
  showConfirm?: boolean
  statistic: SaleAuditStatistic | null
}

export function SaleAuditDetail({
  documentApi = DEFAULT_SALE_AUDIT_DOCUMENT_API,
  documentNumber,
  error,
  isLoading,
  onConfirmed,
  showConfirm = true,
  statistic,
}: SaleAuditDetailProps) {
  const { t } = useI18n()
  const sale = statistic?.Sale
  const printRequestRef = useRef(0)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [printKind, setPrintKind] = useValueState<AuditPrintKind | null>(null)
  const [printDocument, setPrintDocument] = useValueState<SaleAuditPrintDocument | null>(null)
  const [isPrinting, setPrinting] = useValueState(false)
  const [printError, setPrintError] = useValueState<string | null>(null)
  const [confirmHistoryNetId, setConfirmHistoryNetId] = useValueState<string | null>(null)
  const [isConfirmingHistory, setConfirmingHistory, tryStartConfirmingHistory] = useBusyState()
  const confirmRequestRef = useRef(false)
  const runInvoiceEdit = usePersistentSaleJsonMutationRunner('protocol-invoice-edit')

  function resolveHistoryNetId(orderItem: SaleAuditOrderItem): string | null {
    const historyInvoiceEditId = (orderItem.ShiftStatuses || [])[0]?.HistoryInvoiceEditId

    if (historyInvoiceEditId === undefined) {
      return null
    }

    const historyItem = (sale?.HistoryInvoiceEdit || []).find((item) => item.Id === historyInvoiceEditId)

    return historyItem?.NetUid || null
  }

  function printDocumentFor(kind: AuditPrintKind, orderItem: SaleAuditOrderItem) {
    const netId = sale?.NetUid
    const historyNetId = resolveHistoryNetId(orderItem)

    if (!netId || !historyNetId) {
      return
    }

    setPrintKind(kind)
    setPrintDocument(null)
    setPrintError(null)
    setPrinting(true)
    setDownloadOpened(true)

    const requestId = printRequestRef.current + 1
    printRequestRef.current = requestId

    void (async () => {
      try {
        if (printRequestRef.current !== requestId) {
          return
        }

        const document =
          kind === 'invoice'
            ? await documentApi.getInvoice(netId, historyNetId)
            : await documentApi.getShifted(netId, historyNetId)

        if (printRequestRef.current === requestId) {
          setPrintDocument(document)
        }
      } catch (documentError) {
        if (printRequestRef.current === requestId) {
          setPrintError(documentError instanceof Error ? documentError.message : t('Документ недоступний для завантаження'))
        }
      } finally {
        if (printRequestRef.current === requestId) {
          setPrinting(false)
        }
      }
    })()
  }

  function closeDownload() {
    printRequestRef.current += 1
    setDownloadOpened(false)
    setPrintKind(null)
    setPrintDocument(null)
    setPrintError(null)
    setPrinting(false)
  }

  async function confirmProcessing() {
    if (!confirmHistoryNetId || confirmRequestRef.current) {
      return
    }

    confirmRequestRef.current = true
    if (!tryStartConfirmingHistory()) {
      return
    }

    try {
      const mutation = await runInvoiceEdit(
        `protocol-invoice-edit:${confirmHistoryNetId.toLowerCase()}`,
        { NetId: confirmHistoryNetId },
        documentApi.confirm,
      )
      if (!mutation.completed) {
        throw mutation.error ??
          new Error(t('Не вдалося підтвердити результат операції'))
      }
      notifications.show({ color: 'green', message: t('Підтверджено') })
      setConfirmHistoryNetId(null)
      onConfirmed?.()
    } catch (confirmError) {
      notifications.show({ color: 'red', message: confirmError instanceof Error ? confirmError.message : t('Не вдалося підтвердити') })
    } finally {
      confirmRequestRef.current = false
      setConfirmingHistory(false)
    }
  }

  const confirmableHistoryNetId =
    (sale?.HistoryInvoiceEdit || []).find((item) => item.NetUid && item.ApproveUpdate && !item.IsDevelopment)?.NetUid || null

  const orderItems = sale?.Order?.OrderItems || []
  const movementCount = orderItems.reduce((total, item) => total + (item.ShiftStatuses?.length || 0), 0)
  const rows: AuditMovementRow[] = orderItems.flatMap<AuditMovementRow>((item, index) => {
    const key = String(item.NetUid || item.Id || index)
    const statuses = item.ShiftStatuses || []
    return statuses.length
      ? statuses.map((status, statusIndex) => ({ item, status, first: statusIndex === 0, key: `${key}:${status.NetUid || status.Id || statusIndex}` }))
      : [{ item, first: true, key }]
  })
  const columns: DataTableColumn<AuditMovementRow>[] = [
    { id: 'product', header: t('Товар'), accessor: (row) => row.item.Product?.Name || '', fill: true, width: 300, minWidth: 240,
      cell: (row) => <div className="sale-audit-product"><Package size={16} aria-hidden="true" /><span>{row.item.Product?.Name}</span></div> },
    { id: 'vendor', header: t('Код виробника'), accessor: (row) => row.item.Product?.VendorCode || '', width: 160, minWidth: 144,
      cell: (row) => <TableChip tone="product" value={row.item.Product?.VendorCode} /> },
    { id: 'original', header: t('Ориг. номер'), accessor: (row) => row.item.Product?.MainOriginalNumber || '', width: 168, minWidth: 140,
      cell: (row) => <TableChip tone="warning" value={row.item.Product?.MainOriginalNumber} /> },
  ]
  if (movementCount) {
    columns.push(
      { id: 'target', header: t('Напрямок'), accessor: (row) => getShiftTarget(row.status, t), width: 132, minWidth: 120,
        cell: (row) => <TableChip tone={row.status?.ShiftStatus === SaleAuditShiftStatusType.Store ? 'storage' : 'document'} value={getShiftTarget(row.status, t)} /> },
      { id: 'qty', header: t('К-сть'), accessor: (row) => row.status?.Qty, align: 'right', width: 88, minWidth: 84,
        cell: (row) => <span className="app-money">{row.status?.Qty ?? ''}</span> },
      { id: 'created', header: t('Дата'), accessor: (row) => getDateTime(row.status?.Created) ?? 0, width: 168, minWidth: 156,
        cell: (row) => <span className="sale-audit-date">{formatDateTime(row.status?.Created)}</span> },
      { id: 'user', header: t('Відповідальний'), accessor: (row) => [row.status?.User?.FirstName, row.status?.User?.LastName].filter(Boolean).join(' '), width: 180, minWidth: 160 },
    )
  }
  if (orderItems.some((item) => Boolean(resolveHistoryNetId(item)))) {
    columns.push({ id: 'actions', header: t('Документи'), accessor: () => '', width: 104, minWidth: 104, enableSorting: false,
      cell: (row) => row.first && resolveHistoryNetId(row.item) ? <Group gap={4} wrap="nowrap">
        <TableRowAction action="receipt" label={t('Видаткова накладна')} onClick={() => printDocumentFor('invoice', row.item)} />
        <TableRowAction action="document" label={t('Акт редагування')} onClick={() => printDocumentFor('act', row.item)} />
      </Group> : null })
  }

  return (
    <Stack className="sale-audit-detail" gap="xs">
      {error && <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>}
      {isLoading ? <Stack gap="sm" aria-label={t('Завантаження')}>
        <Skeleton height={76} radius="md" />
        <Skeleton height={112} radius="md" />
        <Skeleton height={180} radius="md" />
      </Stack> : statistic && <DocumentDetailLayout
        summary={<DocumentDetailSummary
          variant="inventory"
          eyebrow={t('Рух товарно-матеріальних цінностей')}
          title={documentNumber ? `№ ${documentNumber}` : t('Рух товару')}
          meta={<>
            <DocumentDetailChip icon={<Package size={14} />}>{t('Позицій')}: {orderItems.length}</DocumentDetailChip>
            <DocumentDetailChip icon={<History size={14} />}>{t('Переміщень')}: {movementCount}</DocumentDetailChip>
          </>}
          metrics={(statistic.SaleExchangeRates || []).length ? <div className="sale-audit-rates">
            <span className="sale-audit-rates__label">{t('Курси валют')}</span>
            <Group gap="md" wrap="wrap">{(statistic.SaleExchangeRates || []).map((rate, index) => <Group key={rate.NetUid || rate.Id || index} gap={6} wrap="nowrap">
              <TableChip tone="source" value={rate.ExchangeRate?.Code} />
              <span className="app-money">{rate.ExchangeRate?.Amount ?? ''}</span>
            </Group>)}</Group>
          </div> : null}
        />}
      >
        <div className="sale-audit-logistics">
          <DocumentDetailSection title={t('Логістика')} stacked>
            {(statistic.LifeCycleLine || []).length ? <ol className="sale-audit-lifecycle">
              {(statistic.LifeCycleLine || []).map((line, index, lines) => (
                <LifeCycleRow
                  key={getLifeCycleLineKey(line)}
                  line={line}
                  index={index}
                  connected={Boolean(line.IsActive && lines[index + 1]?.IsActive)}
                />
              ))}
            </ol> : <Text size="sm" c="gray.6">{t('Історія логістики відсутня')}</Text>}
          </DocumentDetailSection>
        </div>
        <DocumentDetailSection title={t(movementCount ? 'Переміщення товарів' : 'Товари документа')} subtitle={String(movementCount || orderItems.length)} stacked
          actions={showConfirm && confirmableHistoryNetId ? <Button size="xs" color={CREATE_ACTION_COLOR} onClick={() => setConfirmHistoryNetId(confirmableHistoryNetId)}>{t('Підтвердити обробку')}</Button> : null}
        >
          {!movementCount && Boolean(orderItems.length) && <Text size="xs" c="gray.7">{t('Переміщень не зафіксовано')}</Text>}
          <div className="sale-audit-table-shell">
            <DataTable<AuditMovementRow>
              columns={columns} data={rows} getRowId={(row) => row.key}
              tableId="sale-audit-movements" layoutVersion={movementCount ? 'movements-1' : 'products-1'}
              defaultLayout={{ density: 'compact' }} distributeAvailableWidth
              minWidth={movementCount ? 1120 : 560} showToolbar={false} showDensityToggle={false}
              emptyText={t('Товарів не знайдено')}
            />
          </div>
        </DocumentDetailSection>
      </DocumentDetailLayout>}

      <DocumentExportModal
        document={printDocument}
        error={printError}
        isLoading={isPrinting}
        opened={downloadOpened}
        title={printKind === 'act' ? t('Акт редагування') : t('Видаткова накладна')}
        onClose={closeDownload}
      />

      <AppModal
        centered
        opened={Boolean(confirmHistoryNetId)}
        size="xs"
        title={t('Підтвердження')}
        onClose={() => (isConfirmingHistory ? undefined : setConfirmHistoryNetId(null))}
      >
        <Stack gap="md">
          <Text size="sm">{t('Підтвердити обробку відвантаження?')}</Text>
          <Group justify="flex-end" gap="xs">
            <Button color="gray" disabled={isConfirmingHistory} variant="subtle" onClick={() => setConfirmHistoryNetId(null)}>
              {t('Скасувати')}
            </Button>
            <Button loading={isConfirmingHistory} onClick={confirmProcessing}>
              {t('Підтвердити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

type AuditMovementRow = {
  key: string
  item: SaleAuditOrderItem
  status?: SaleAuditShiftStatus
  first: boolean
}

function LifeCycleRow({ line, index, connected }: {
  line: SaleAuditLifeCycleLineItem
  index: number
  connected: boolean
}) {
  const { t } = useI18n()
  const Icon = line.Value === 'New' ? ReceiptText
    : line.Value === 'Shipping' ? Truck
    : line.Value === 'Received' ? PackageCheck
    : line.Value === 'Packaging' || line.Value === 'Packaged' ? Package
    : line.Value === 'InvoiceChanged' ? FileText : History
  return <li
    className={`sale-audit-lifecycle__step${line.IsActive ? ' is-active' : ''}${connected ? ' is-connected' : ''}`}
    style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
  >
    <span className="sale-audit-lifecycle__icon"><Icon size={18} aria-hidden="true" /></span>
    <div>
      <span className="sale-audit-lifecycle__label">{getLifeCycleLineLabel(line.Value, t)}</span>
      {line.IsActive && line.Updated && <time className="sale-audit-date">{formatDateTime(line.Updated)}</time>}
    </div>
    <ChevronRight className="sale-audit-lifecycle__connector" size={16} aria-hidden="true" />
  </li>
}

function getLifeCycleLineKey(line: SaleAuditLifeCycleLineItem): string {
  return [line.Value, line.Updated, line.IsActive ? 'active' : 'inactive'].filter(Boolean).join('|')
}

function getShiftTarget(status: SaleAuditShiftStatus | undefined, t: (key: string) => string): string {
  return status?.ShiftStatus === SaleAuditShiftStatusType.Store ? t('На склад')
    : status?.ShiftStatus === SaleAuditShiftStatusType.Bill ? t('В рахунок') : ''
}

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function getLifeCycleLineLabel(value: string | undefined, t: (key: string) => string): string {
  switch (value) {
    case 'New':
      return t('SaleLifeCycleNew')
    case 'Packaging':
    case 'Packaged':
      return t('SaleLifeCyclePackaging')
    case 'Shipping':
      return t('SaleLifeCycleShipping')
    case 'Received':
      return t('SaleLifeCycleRecevied')
    case 'Await':
      return t('SaleLifeCycleAwait')
    case 'InvoiceChanged':
      return t('InvoiceChanged')
    case 'TransporterChanged':
      return t('TransporterChanged')
    case 'OrderClosed':
      return t('OrderClosed')
    default:
      return value ? t(value) : ''
  }
}

function formatDateTime(value?: Date | string): string {
  const time = getDateTime(value)

  if (time === null) {
    return ''
  }

  return dateTimeFormatter.format(new Date(time))
}

function getDateTime(value?: Date | string): number | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  const time = Date.parse(value)

  return Number.isNaN(time) ? null : time
}
