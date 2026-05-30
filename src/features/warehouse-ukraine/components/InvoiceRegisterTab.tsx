import { ActionIcon, Alert, Button, Card, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconDownload, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getInvoiceRegister, getInvoiceRegisterPrintDocument } from '../api/invoiceRegisterApi'
import type { Sale, WarehouseUkraineExportDocument } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, getDateShiftedByDays } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '150']

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'invoiceNumber'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

type FilterDraft = {
  date: string
  value: string
}

function useInvoiceRegisterModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(() => ({ date: getDateShiftedByDays(0), value: '' }), [])
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [invoices, setInvoices] = useValueState<Sale[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<WarehouseUkraineExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const filterError = activeFilters.date ? null : translate('Вкажіть дату')
  const listRequestKey = `${activeFilters.date}|${activeFilters.value}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const invoiceIndexMap = useMemo(() => buildIndexMap(invoices), [invoices])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    if (filterError) {
      setInvoices([])
      setTotalQty(0)
      setHasMore(false)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadInvoices() {
      setLoading(true)
      setError(null)

      try {
        const result = await getInvoiceRegister({
          value: activeFilters.value,
          date: activeFilters.date,
          limit: pageSize,
          offset: 0,
        })

        if (!cancelled) {
          setInvoices(result.items)
          setTotalQty(result.totalQty)
          setHasMore(result.items.length < result.totalQty && result.items.length > 0)
        }
      } catch (loadError) {
        if (!cancelled) {
          setInvoices([])
          setTotalQty(0)
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити реєстр'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvoices()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, pageSize, reloadKey, setError, setHasMore, setInvoices, setLoading, setTotalQty, t])

  async function loadMoreInvoices() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = invoices.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getInvoiceRegister({
        value: activeFilters.value,
        date: activeFilters.date,
        limit: pageSize,
        offset: requestOffset,
      })

      if (listRequestKeyRef.current === requestKey) {
        setInvoices((current) => (current.length === requestOffset ? [...current, ...result.items] : current))
        setTotalQty(result.totalQty)
        setHasMore(requestOffset + result.items.length < result.totalQty && result.items.length > 0)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити реєстр'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  async function exportDocument() {
    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    setDownloadOpened(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await getInvoiceRegisterPrintDocument({
        value: activeFilters.value,
        date: activeFilters.date,
        limit: pageSize,
        offset: 0,
      })

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(exportError instanceof Error ? exportError.message : t('Немає документів для завантаження'))
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  const columns = useInvoiceRegisterColumns(invoiceIndexMap)

  return {
    applyFilters, closeDownload, columns, downloadDocument, downloadError, downloadOpened, error, exportDocument,
    filterDraft, filterError, hasMore, invoices, isDownloading, isLoading, isLoadingMore, loadMoreInvoices, pageSize,
    reload, resetFilters, setPageSize, totalQty,
  }
}

export function InvoiceRegisterTab() {
  const model = useInvoiceRegisterModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Реєстр накладних')}
        </Text>
        <Group gap="xs">
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
          <Button
            color="gray"
            leftSection={<IconDownload size={16} />}
            loading={model.isDownloading}
            variant="light"
            onClick={model.exportDocument}
          >
            {t('Роздрукувати')}
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <TextInput
              label={t('Значення')}
              value={model.filterDraft.value}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, value: event.currentTarget.value })}
            />
            <TextInput
              label={t('На дату')}
              type="date"
              value={model.filterDraft.date}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, date: event.currentTarget.value })}
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
              {t('Показано')} {model.invoices.length} / {model.totalQty}
            </Text>
            <Select
              aria-label={t('Кількість рядків')}
              data={PAGE_SIZE_OPTIONS}
              size="xs"
              value={String(model.pageSize)}
              w={88}
              onChange={(value) => model.setPageSize(Number(value || DEFAULT_PAGE_SIZE))}
            />
          </Group>

          <DataTable
            columns={model.columns}
            data={model.invoices}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Накладних не знайдено')}
            getRowId={(invoice, index) => String(invoice.NetUid || invoice.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-invoice-register-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={760}
            tableId="warehouse-ukraine-invoice-register"
          />

          {model.hasMore && (
            <Group justify="center">
              <Button color="gray" loading={model.isLoadingMore} variant="light" onClick={model.loadMoreInvoices}>
                {t('Завантажити ще')}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

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

function useInvoiceRegisterColumns(indexMap: Map<Sale, number>) {
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
        accessor: (invoice) => indexMap.get(invoice) || 0,
        cell: (invoice) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(invoice) || ''}
          </Text>
        ),
      },
      {
        id: 'invoiceNumber',
        header: t('№ Видаткової накладної'),
        width: 220,
        minWidth: 170,
        accessor: (invoice) => invoice.SaleNumber?.Value,
        cell: (invoice) => <Text fw={700}>{displayValue(invoice.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'clientCode',
        header: t('Код клієнта'),
        width: 200,
        minWidth: 150,
        accessor: (invoice) => invoice.ClientAgreement?.Client?.OriginalRegionCode,
        cell: (invoice) => displayValue(invoice.ClientAgreement?.Client?.OriginalRegionCode),
      },
      {
        id: 'clientName',
        header: t("Повне ім'я"),
        minWidth: 260,
        accessor: (invoice) => invoice.ClientAgreement?.Client?.FullName,
        cell: (invoice) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(invoice.ClientAgreement?.Client?.FullName)}
          </Text>
        ),
      },
    ],
    [indexMap, t],
  )
}

function buildIndexMap(invoices: Sale[]): Map<Sale, number> {
  return invoices.reduce((indexMap, invoice, index) => {
    indexMap.set(invoice, index + 1)

    return indexMap
  }, new Map<Sale, number>())
}
