import { ActionIcon, Alert, Anchor, Badge, Card, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconFileText,
  IconPrinter,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getSaleActProtocolEditDocument,
  getSalePrintDocument,
  getWarehouseUkraineSales,
} from '../api/salesApi'
import type { Sale, WarehouseUkraineExportDocument } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateString } from './dateHelpers'
import { SaleCarrierDrawer } from './SaleCarrierDrawer'

const DEFAULT_LIMIT = 500
const PAGE_SIZE_OPTIONS = ['100', '200', '500', '1000']

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'fromDate'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

type FilterDraft = {
  from: string
  to: string
  value: string
}

function useSalesTabModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0), value: '' }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [sales, setSales] = useValueState<Sale[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [pageSize, setPageSize] = useValueState(DEFAULT_LIMIT)
  const [carrierSale, setCarrierSale] = useValueState<Sale | null>(null)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<WarehouseUkraineExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const saleIndexMap = useMemo(() => buildIndexMap(sales), [sales])

  useEffect(() => {
    if (filterError) {
      setSales([])
      setTotalQty(0)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const result = await getWarehouseUkraineSales({
          from: toDateString(activeFilters.from),
          to: toDateString(activeFilters.to),
          value: activeFilters.value,
          limit: pageSize,
          offset: 0,
        })

        if (!cancelled) {
          setSales(result.items)
          setTotalQty(result.totalQty)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setTotalQty(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити документи'))
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
  }, [activeFilters, filterError, pageSize, reloadKey, setError, setLoading, setSales, setTotalQty, t])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  const runDownload = useCallback(
    async (loader: () => Promise<WarehouseUkraineExportDocument>) => {
      const requestId = downloadRequestRef.current + 1
      downloadRequestRef.current = requestId
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(null)
      setDownloading(true)

      try {
        const document = await loader()

        if (downloadRequestRef.current === requestId) {
          setDownloadDocument(document)
        }
      } catch (exportError) {
        if (downloadRequestRef.current === requestId) {
          setDownloadError(
            exportError instanceof Error ? exportError.message : t('Немає документів для завантаження'),
          )
        }
      } finally {
        if (downloadRequestRef.current === requestId) {
          setDownloading(false)
        }
      }
    },
    [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading, t],
  )

  const printSale = useCallback(
    (sale: Sale) => {
      if (sale.NetUid) {
        void runDownload(() => getSalePrintDocument(sale.NetUid as string))
      }
    },
    [runDownload],
  )

  const printActProtocolEdit = useCallback(
    (sale: Sale) => {
      if (sale.NetUid) {
        void runDownload(() => getSaleActProtocolEditDocument(sale.NetUid as string, true))
      }
    },
    [runDownload],
  )

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  const columns = useSalesColumns({ indexMap: saleIndexMap, onPrint: printSale, onPrintActProtocolEdit: printActProtocolEdit, onOpenCarrier: setCarrierSale })

  return {
    activeFilters, applyFilters, carrierSale, closeDownload, columns, downloadDocument, downloadError,
    downloadOpened, error, filterDraft, filterError, isDownloading, isLoading, pageSize, reload, resetFilters,
    sales, setCarrierSale, setPageSize, totalQty,
  }
}

export function SalesTab() {
  const model = useSalesTabModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Статус пакування')}
        </Text>
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
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <TextInput
              label={t('Пошук по товару')}
              value={model.filterDraft.value}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, value: event.currentTarget.value })}
            />
            <TextInput
              label={t('Початкова дата')}
              max={model.filterDraft.to || undefined}
              type="date"
              value={model.filterDraft.from}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('Кінцева дата')}
              min={model.filterDraft.from || undefined}
              type="date"
              value={model.filterDraft.to}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, to: event.currentTarget.value })}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={model.resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(model.error || model.filterError) && (
            <Alert color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <Group justify="space-between" gap="xs">
            <Text c="dimmed" size="xs">
              {t('Показано')} {model.sales.length} / {model.totalQty}
            </Text>
            <Select
              aria-label={t('Кількість рядків')}
              data={PAGE_SIZE_OPTIONS}
              size="xs"
              value={String(model.pageSize)}
              w={96}
              onChange={(value) => model.setPageSize(Number(value || DEFAULT_LIMIT))}
            />
          </Group>

          <DataTable
            columns={model.columns}
            data={model.sales}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Документів не знайдено')}
            getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-sales-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={1480}
            tableId="warehouse-ukraine-sales"
          />
        </Stack>
      </Card>

      <SaleCarrierDrawer sale={model.carrierSale} onClose={() => model.setCarrierSale(null)} />
      <DownloadDocumentModal
        document={model.downloadDocument}
        error={model.downloadError}
        isLoading={model.isDownloading}
        opened={model.downloadOpened}
        onClose={model.closeDownload}
      />
    </Stack>
  )
}

function useSalesColumns({
  indexMap,
  onOpenCarrier,
  onPrint,
  onPrintActProtocolEdit,
}: {
  indexMap: Map<Sale, number>
  onOpenCarrier: (sale: Sale) => void
  onPrint: (sale: Sale) => void
  onPrintActProtocolEdit: (sale: Sale) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        accessor: (sale) => indexMap.get(sale) || 0,
        cell: (sale) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(sale) || ''}
          </Text>
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 150,
        minWidth: 130,
        accessor: (sale) => sale.ChangedToInvoice,
        cell: (sale) => <Text fw={600}>{formatDateTime(sale.ChangedToInvoice)}</Text>,
      },
      {
        id: 'actions',
        header: t('Роздрукувати'),
        width: 120,
        minWidth: 110,
        enableSorting: false,
        cell: (sale) => (
          <Group gap={4} wrap="nowrap">
            <Tooltip label={t('Підтвердження на друк і Друк пакета документів')}>
              <ActionIcon aria-label={t('Роздрукувати')} color="gray" size="sm" variant="subtle" onClick={() => onPrint(sale)}>
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Акт редагування')}>
              <ActionIcon
                aria-label={t('Акт редагування')}
                color={sale.IsPrintedActProtocolEdit ? 'teal' : 'gray'}
                size="sm"
                variant="subtle"
                onClick={() => onPrintActProtocolEdit(sale)}
              >
                <IconFileText size={16} />
              </ActionIcon>
            </Tooltip>
            {sale.CustomersOwnTtn?.TtnPDFPath && (
              <Tooltip label={t('Завантажити ТТН')}>
                <Anchor
                  href={upgradeHttpToHttps(sale.CustomersOwnTtn.TtnPDFPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconDownload size={16} />
                </Anchor>
              </Tooltip>
            )}
          </Group>
        ),
      },
      {
        id: 'status',
        header: t('Роздруковано'),
        width: 120,
        minWidth: 100,
        enableSorting: false,
        accessor: (sale) => getPrintedStatusText(sale),
        cell: (sale) => {
          const status = getPrintedStatusText(sale)

          if (!status) {
            return '-'
          }

          return (
            <Badge color={status === 'changed' ? 'orange' : 'teal'} variant="light">
              {status}
            </Badge>
          )
        },
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (sale) => sale.SaleNumber?.Value,
        cell: (sale) => <Text fw={700}>{displayValue(sale.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'client',
        header: t("Повне ім'я"),
        minWidth: 240,
        accessor: (sale) => buildClientName(sale),
        cell: (sale) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(buildClientName(sale))}
          </Text>
        ),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (sale) => sale.TotalAmountLocal,
        cell: (sale) => displayValue(sale.TotalAmountLocal),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        minWidth: 80,
        accessor: (sale) => sale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (sale) => displayValue(sale.ClientAgreement?.Agreement?.Currency?.Code),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 140,
        accessor: (sale) => getResponsible(sale),
        cell: (sale) => displayValue(getResponsible(sale)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 200,
        accessor: (sale) => sale.Comment,
        cell: (sale) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(sale.Comment)}
          </Text>
        ),
      },
      {
        id: 'transporter',
        header: t('Перевізник'),
        width: 180,
        minWidth: 150,
        accessor: (sale) => sale.Transporter?.Name,
        cell: (sale) => {
          if (!sale.Transporter?.Name) {
            return '-'
          }

          return (
            <Anchor component="button" type="button" size="sm" onClick={() => onOpenCarrier(sale)}>
              {sale.Transporter.Name}
            </Anchor>
          )
        },
      },
    ],
    [indexMap, onOpenCarrier, onPrint, onPrintActProtocolEdit, t],
  )
}

function getPrintedStatusText(sale: Sale): string {
  const approved = (sale.HistoryInvoiceEdit || []).filter((entry) => entry.ApproveUpdate)

  if (approved.length > 0) {
    return 'changed'
  }

  if (sale.IsPrinted) {
    return translate('Роздруковано')
  }

  return ''
}

function buildClientName(sale: Sale): string {
  const client = sale.ClientAgreement?.Client
  const region = client?.RegionCode?.Value ? `${client.RegionCode.Value} ` : ''
  const retail =
    sale.RetailClient && (sale.RetailClient.Id || 0) > 0
      ? ` (${sale.RetailClient.Name || ''} ${sale.RetailClient.PhoneNumber || ''})`
      : ''

  return `${region}${client?.FullName || ''}${retail}`.trim()
}

function getResponsible(sale: Sale): string {
  if (sale.UpdateUser && (sale.UpdateUser.Id || 0) > 0) {
    return sale.UpdateUser.LastName || ''
  }

  if (sale.User && (sale.User.Id || 0) > 0) {
    return sale.User.LastName || ''
  }

  return ''
}

function upgradeHttpToHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://')
}

function buildIndexMap(sales: Sale[]): Map<Sale, number> {
  return sales.reduce((indexMap, sale, index) => {
    indexMap.set(sale, index + 1)

    return indexMap
  }, new Map<Sale, number>())
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
