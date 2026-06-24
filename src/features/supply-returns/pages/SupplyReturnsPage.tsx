import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  IconAlertCircle,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconRestore,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  exportSupplyReturnDocument,
  getSupplyReturnByNetId,
  getSupplyReturns,
} from '../api/supplyReturnsApi'
import type { SupplyReturn, SupplyReturnExportDocument, SupplyReturnItem } from '../types'
import './supply-returns-page.css'

type FilterDraft = {
  from: string
  to: string
}

const SUPPLY_RETURNS_PAGE_SIZE_STORAGE_KEY = 'gba-data-table:supply-returns:page-size'

const SUPPLY_RETURNS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SUPPLY_RETURN_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'code'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const priceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function useSupplyReturnsPageModel() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-7),
      to: today,
    }),
    [today],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [supplyReturns, setSupplyReturns] = useValueState<SupplyReturn[]>([])
  const [selectedReturn, setSelectedReturn] = useValueState<SupplyReturn | null>(null)
  const [detailError, setDetailError] = useValueState<string | null>(null)
  const [isDetailLoading, setDetailLoading] = useValueState(false)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<SupplyReturnExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(readSupplyReturnsPageSize)
  const [totalQty, setTotalQty] = useValueState(0)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const detailRequestRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const canMoveForward = supplyReturns.length === pageSize
  const totalPages =
    totalQty > 0 ? Math.max(1, Math.ceil(totalQty / pageSize)) : page + (canMoveForward ? 1 : 0)
  const resetSupplyReturns = useCallback(() => {
    setSupplyReturns([])
    setTotalQty(0)
    setLoading(false)
    setSelectedReturn(null)
  }, [setLoading, setSelectedReturn, setSupplyReturns, setTotalQty])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1
    setSelectedReturn(null)
    setDetailError(null)
    setDetailLoading(false)
    closeDownload()
  }, [closeDownload, setDetailError, setDetailLoading, setSelectedReturn])

  const openDetail = useCallback(
    async (supplyReturn: SupplyReturn) => {
      const requestId = detailRequestRef.current + 1
      detailRequestRef.current = requestId
      setSelectedReturn(supplyReturn)
      setDetailError(null)

      if (!supplyReturn.NetUid) {
        return
      }

      const hasItems = Array.isArray(supplyReturn.SupplyReturnItems) && supplyReturn.SupplyReturnItems.length > 0

      if (hasItems) {
        return
      }

      setDetailLoading(true)

      try {
        const detailedReturn = await getSupplyReturnByNetId(supplyReturn.NetUid)

        if (detailRequestRef.current === requestId && detailedReturn) {
          setSelectedReturn(detailedReturn)
        }
      } catch (loadError) {
        if (detailRequestRef.current === requestId) {
          setDetailError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі повернення'))
        }
      } finally {
        if (detailRequestRef.current === requestId) {
          setDetailLoading(false)
        }
      }
    },
    [setDetailError, setDetailLoading, setSelectedReturn, t],
  )

  const openDownload = useCallback(
    async (supplyReturn: SupplyReturn) => {
      if (!supplyReturn.NetUid) {
        return
      }

      const requestId = downloadRequestRef.current + 1
      downloadRequestRef.current = requestId
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(null)
      setDownloading(true)

      try {
        const document = await exportSupplyReturnDocument(supplyReturn.NetUid)

        if (downloadRequestRef.current === requestId) {
          setDownloadDocument(document)
        }
      } catch (exportError) {
        if (downloadRequestRef.current === requestId) {
          setDownloadError(exportError instanceof Error ? exportError.message : t('Документ недоступний для завантаження'))
        }
      } finally {
        if (downloadRequestRef.current === requestId) {
          setDownloading(false)
        }
      }
    },
    [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading, t],
  )

  const returnIndexMap = useMemo(() => buildIndexMap(supplyReturns), [supplyReturns])
  const columns = useSupplyReturnColumns(openDetail, returnIndexMap)

  const changePageSize = useCallback(
    (value: number) => {
      const nextPageSize = normalizeSupplyReturnsPageSize(String(value))

      setPage(1)
      setPageSize(nextPageSize)
      writeSupplyReturnsPageSize(nextPageSize)
    },
    [setPage, setPageSize],
  )

  useSupplyReturnsLoader({
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetSupplyReturns,
    setError,
    setLoading,
    setTotalQty,
    setSupplyReturns,
  })

  function applyFilters(nextFilters: FilterDraft) {
    setPage(1)
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  return {
    changePageSize,
    columns,
    detailError,
    downloadDocument,
    downloadError,
    downloadOpened,
    error,
    filterDraft,
    filterError,
    isDetailLoading,
    isDownloading,
    isLoading,
    page,
    pageSize,
    selectedReturn,
    supplyReturns,
    totalPages,
    applyFilters,
    closeDetail,
    closeDownload,
    openDetail,
    openDownload,
    reload,
    resetFilters,
    setPage,
  }
}

function useSupplyReturnsLoader({
  activeFilters,
  filterError,
  page,
  pageSize,
  reloadKey,
  resetSupplyReturns,
  setError,
  setLoading,
  setTotalQty,
  setSupplyReturns,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  page: number
  pageSize: number
  reloadKey: number
  resetSupplyReturns: () => void
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
  setTotalQty: (value: number) => void
  setSupplyReturns: (value: SupplyReturn[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetSupplyReturns()
      return
    }

    let cancelled = false

    async function loadSupplyReturns() {
      setLoading(true)
      setError(null)

      try {
        const result = await getSupplyReturns({
          from: activeFilters.from,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setSupplyReturns(result.items)
          setTotalQty(result.totalQty)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSupplyReturns([])
          setTotalQty(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити повернення постачальникам'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSupplyReturns()

    return () => {
      cancelled = true
    }
  }, [
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetSupplyReturns,
    setError,
    setLoading,
    setTotalQty,
    setSupplyReturns,
    t,
  ])
}

export function SupplyReturnsPage() {
  const model = useSupplyReturnsPageModel()

  return <SupplyReturnsPageView model={model} />
}

function SupplyReturnsPageView({ model }: { model: ReturnType<typeof useSupplyReturnsPageModel> }) {
  return (
    <Stack className="supply-returns-page" gap={6}>
      <SupplyReturnsTableCard model={model} />
      <SupplyReturnDetailDrawer model={model} />
    </Stack>
  )
}

function SupplyReturnsTableCard({ model }: { model: ReturnType<typeof useSupplyReturnsPageModel> }) {
  const { t } = useI18n()
  const {
    changePageSize,
    columns,
    error,
    filterDraft,
    filterError,
    isLoading,
    openDetail,
    page,
    pageSize,
    reload,
    resetFilters,
    applyFilters,
    supplyReturns,
    totalPages,
    setPage,
  } = model

  return (
    <Card className="app-data-card supply-returns-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar supply-returns-filter-bar">
        <Group align="end" gap="sm" wrap="nowrap" className="supply-returns-filter-row">
          <TextInput
            label={t('Від якої дати')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
          />
          <TextInput
            label={t('До якої дати')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
          />
          <div className="app-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути')} onClick={resetFilters}>
                <IconRestore size={17} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
              onRefresh={reload}
            />
          </div>
        </Group>
      </div>

      {(error || filterError) && (
        <Alert
          className="supply-returns-page__alert"
          color={filterError ? 'yellow' : 'red'}
          icon={<IconAlertCircle size={18} />}
          variant="light"
        >
          {filterError || error}
        </Alert>
      )}

      <div className="supply-returns-page__table">
        <DataTable
          columns={columns}
          data={supplyReturns}
          defaultLayout={SUPPLY_RETURNS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Повернень не знайдено')}
          getRowId={(supplyReturn, index) => String(supplyReturn.NetUid || supplyReturn.Id || index)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="supply-returns-table-1"
          loadingText={t('Завантаження повернень')}
          minWidth={1660}
          tableId="supply-returns"
          onRowClick={openDetail}
        />
      </div>
    </Card>
  )
}

function SupplyReturnDetailDrawer({ model }: { model: ReturnType<typeof useSupplyReturnsPageModel> }) {
  const { t } = useI18n()
  const {
    closeDetail,
    closeDownload,
    detailError,
    downloadDocument,
    downloadError,
    downloadOpened,
    isDetailLoading,
    isDownloading,
    openDownload,
    selectedReturn,
  } = model

  return (
    <AppDrawer
      opened={Boolean(selectedReturn)}
      position="right"
      size="min(920px, 100vw)"
      title={selectedReturn ? buildDrawerTitle(selectedReturn, t) : t('Повернення постачальнику')}
      onClose={closeDetail}
    >
      {selectedReturn && (
        <>
          <Group justify="flex-end" mb="md">
            <Button
              color="violet"
              disabled={!selectedReturn.NetUid}
              leftSection={<IconDownload size={16} />}
              loading={isDownloading}
              variant="light"
              onClick={() => openDownload(selectedReturn)}
            >
              {t('Завантажити')}
            </Button>
          </Group>
          <SupplyReturnDetail error={detailError} isLoading={isDetailLoading} supplyReturn={selectedReturn} />
        </>
      )}

      <AppModal centered opened={downloadOpened} title={t('Завантажити')} onClose={closeDownload}>
        <Stack gap="sm">
          {isDownloading ? (
            <Text c="dimmed" size="sm">
              {t('Завантаження')}
            </Text>
          ) : downloadError ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
                    <IconFileTypePdf size={22} stroke={1.8} />
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

function useSupplyReturnColumns(
  onOpenDetail: (supplyReturn: SupplyReturn) => void,
  indexMap: Map<SupplyReturn, number>,
) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyReturn>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableHiding: false,
        accessor: (supplyReturn) => indexMap.get(supplyReturn) || 0,
        cell: (supplyReturn) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(supplyReturn) || ''}
          </Text>
        ),
      },
      {
        id: 'management',
        header: t('Управ.'),
        width: 88,
        minWidth: 76,
        align: 'center',
        accessor: (supplyReturn) => Boolean(supplyReturn.IsManagement),
        cell: (supplyReturn) =>
          supplyReturn.IsManagement ? (
            <Badge color="violet" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Ні')}
            </Text>
          ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (supplyReturn) => getDateTime(supplyReturn.FromDate),
        cell: (supplyReturn) => (
          <>
            <Text fw={600}>{displayValue(formatDate(parseDate(supplyReturn.FromDate)))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(formatTime(parseDate(supplyReturn.FromDate)))}
            </Text>
          </>
        ),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 160,
        minWidth: 132,
        accessor: (supplyReturn) => supplyReturn.Number || supplyReturn.NetUid,
        cell: (supplyReturn) => <Text fw={600}>{displayValue(supplyReturn.Number)}</Text>,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (supplyReturn) => supplyReturn.Organization?.Name,
        cell: (supplyReturn) => displayValue(supplyReturn.Organization?.Name),
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        minWidth: 200,
        accessor: (supplyReturn) => supplyReturn.Supplier?.FullName,
        cell: (supplyReturn) => displayValue(supplyReturn.Supplier?.FullName),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 96,
        minWidth: 80,
        align: 'right',
        accessor: getReturnQty,
        cell: (supplyReturn) => formatAmount(getReturnQty(supplyReturn)),
      },
      {
        id: 'totalAmount',
        header: t('Сума в EUR'),
        width: 160,
        minWidth: 130,
        align: 'right',
        accessor: (supplyReturn) => toNumber(supplyReturn.TotalNetPrice) || 0,
        cell: (supplyReturn) => formatPrice(toNumber(supplyReturn.TotalNetPrice)),
      },
      {
        id: 'fromStorage',
        header: t('З складу'),
        width: 220,
        minWidth: 180,
        accessor: (supplyReturn) => supplyReturn.Storage?.Name,
        cell: (supplyReturn) => displayValue(supplyReturn.Storage?.Name),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 200,
        minWidth: 160,
        accessor: getResponsibleName,
        cell: (supplyReturn) => displayValue(getResponsibleName(supplyReturn)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 200,
        minWidth: 160,
        accessor: (supplyReturn) => supplyReturn.Comment,
        cell: (supplyReturn) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(supplyReturn.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (supplyReturn) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Деталі')}>
              <ActionIcon
                aria-label={t('Деталі')}
                color="gray"
                variant="subtle"
                onClick={() => onOpenDetail(supplyReturn)}
              >
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [indexMap, onOpenDetail, t],
  )
}

function SupplyReturnDetail({
  error,
  isLoading,
  supplyReturn,
}: {
  error: string | null
  isLoading: boolean
  supplyReturn: SupplyReturn
}) {
  const { t } = useI18n()
  const items = useMemo(() => supplyReturn.SupplyReturnItems || [], [supplyReturn.SupplyReturnItems])
  const itemIndexMap = useMemo(
    () =>
      items.reduce((indexMap, item, index) => {
        indexMap.set(item, index + 1)

        return indexMap
      }, new Map<SupplyReturnItem, number>()),
    [items],
  )
  const itemColumns = useMemo<DataTableColumn<SupplyReturnItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableHiding: false,
        accessor: (item) => itemIndexMap.get(item) || 0,
        cell: (item) => (
          <Text c="dimmed" size="sm">
            {itemIndexMap.get(item) || ''}
          </Text>
        ),
      },
      {
        id: 'code',
        header: t('Код товару'),
        width: 160,
        minWidth: 130,
        accessor: (item) => getProductCode(item),
      },
      {
        id: 'product',
        header: t('Назва товару'),
        minWidth: 240,
        accessor: (item) => getProductName(item),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 96,
        minWidth: 80,
        align: 'right',
        accessor: (item) => toNumber(item.Qty) || 0,
        cell: (item) => formatAmount(toNumber(item.Qty)),
      },
      {
        id: 'totalAmount',
        header: t('Сума в EUR'),
        width: 160,
        minWidth: 130,
        align: 'right',
        accessor: (item) => toNumber(item.TotalNetPrice) || 0,
        cell: (item) => formatPrice(toNumber(item.TotalNetPrice)),
      },
    ],
    [itemIndexMap, t],
  )

  return (
    <Stack gap="md">
      {error && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Group gap="xs">
        {supplyReturn.IsManagement && (
          <Badge color="violet" variant="light">
            {t('Управ.')}
          </Badge>
        )}
        {isLoading && (
          <Badge color="gray" variant="light">
            {t('Завантаження деталей')}
          </Badge>
        )}
      </Group>

      <DetailRows
        rows={[
          [t('Організація'), supplyReturn.Organization?.Name],
          [t('Постачальник'), supplyReturn.Supplier?.SupplierName || supplyReturn.Supplier?.FullName],
          [t('З складу'), supplyReturn.Storage?.Name],
          [t('Відповідальний'), getResponsibleName(supplyReturn)],
        ]}
      />

      {supplyReturn.Comment && (
        <>
          <Divider />
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{supplyReturn.Comment}</Text>
          </Box>
        </>
      )}

      <Divider />

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{t('Назва товару')}</Text>
          <Badge color="gray" variant="light">
            {items.length}
          </Badge>
        </Group>
        <DataTable
          columns={itemColumns}
          data={items}
          defaultLayout={SUPPLY_RETURN_ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Позицій не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          layoutVersion="supply-return-items-table-1"
          maxHeight="48vh"
          minWidth={760}
          tableId="supply-return-items"
        />
      </Stack>

      <Divider />

      <DetailRows
        rows={[
          [t('Всього товарів'), items.length],
          [t('Вся кількість'), formatAmount(getReturnQty(supplyReturn))],
          [t('Вся сума'), formatPrice(toNumber(supplyReturn.TotalNetPrice))],
        ]}
      />
    </Stack>
  )
}

function DetailRows({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <Stack gap={6}>
      {rows.map(([label, value]) => (
        <Group key={label} justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text size="sm" ta="right">
            {displayValue(value)}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

function buildDrawerTitle(supplyReturn: SupplyReturn, t: (key: string) => string): string {
  const number = supplyReturn.Number ? ` ${supplyReturn.Number}` : ''
  const date = formatDate(parseDate(supplyReturn.FromDate))
  const datePart = date ? ` ${t('Від')} ${date}` : ''

  return `${t('Повернення постачальнику')}${number}${datePart}`
}

function buildIndexMap(supplyReturns: SupplyReturn[]): Map<SupplyReturn, number> {
  return supplyReturns.reduce((indexMap, supplyReturn, index) => {
    indexMap.set(supplyReturn, index + 1)

    return indexMap
  }, new Map<SupplyReturn, number>())
}

function readSupplyReturnsPageSize() {
  if (typeof window === 'undefined') {
    return DEFAULT_PAGINATOR_PAGE_SIZE
  }

  return normalizeSupplyReturnsPageSize(window.localStorage.getItem(SUPPLY_RETURNS_PAGE_SIZE_STORAGE_KEY))
}

function writeSupplyReturnsPageSize(pageSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SUPPLY_RETURNS_PAGE_SIZE_STORAGE_KEY, String(pageSize))
}

function normalizeSupplyReturnsPageSize(value?: string | null) {
  return PAGINATOR_PAGE_SIZE_OPTIONS.includes(value ?? '') ? Number(value) : DEFAULT_PAGINATOR_PAGE_SIZE
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

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateTime(value: unknown): number {
  return parseDate(value)?.getTime() || 0
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string' || !value) {
    return null
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString('uk-UA') : ''
}

function formatTime(value: Date | null): string {
  return value ? value.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''
}

function getResponsibleName(supplyReturn: SupplyReturn): string {
  const responsible = supplyReturn.Responsible

  return (
    responsible?.FullName?.trim() ||
    responsible?.Name?.trim() ||
    [responsible?.LastName, responsible?.FirstName, responsible?.MiddleName].filter(Boolean).join(' ').trim() ||
    responsible?.Abbreviation?.trim() ||
    ''
  )
}

function getReturnQty(supplyReturn: SupplyReturn): number {
  return (supplyReturn.SupplyReturnItems || []).reduce((total, item) => total + (toNumber(item.Qty) || 0), 0)
}

function getProductName(item: SupplyReturnItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getProductCode(item: SupplyReturnItem): string {
  return item.Product?.VendorCode || item.Product?.Articul || item.Product?.MainOriginalNumber || ''
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
}

function formatPrice(value: number | null): string {
  return typeof value === 'number' ? priceFormatter.format(value) : displayValue(value)
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
