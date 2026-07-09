import { ActionIcon, Alert, Anchor, Badge, Button, Card, Group, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, FileText, MapPin } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams, type Location } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import {
  exportProductIncomeDocument,
  getSupplyOrderProductIncomeByNetId,
  getSupplyOrderUkraineProductIncomeByNetId,
} from '../api/productIncomeDocumentsApi'
import { getActiveProductIncomeItems } from '../productIncomeDocumentItems'
import { mapSupplyPlacementRows, type SupplyPlacementRow } from '../supplyOrderProductPlacementRows'
import type {
  NamedEntity,
  ProductIncomeDocumentsExportDocument,
  ProductIncomeInfo,
  ProductIncomePackingList,
  ProductIncomePlacement,
} from '../types'

const ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'productName'],
    right: ['placementDetails'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const rateFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 })

export function SupplyOrderProductPlacementPage() {
  return (
    <SupplyOrderProductPlacementContent
      loadIncome={getSupplyOrderProductIncomeByNetId}
      title="Розміщення приходу по замовленню"
    />
  )
}

export function SupplyOrderUkraineProductPlacementPage() {
  return (
    <SupplyOrderProductPlacementContent
      loadIncome={getSupplyOrderUkraineProductIncomeByNetId}
      title="Розміщення приходу поставки в Україну"
    />
  )
}

function SupplyOrderProductPlacementContent({
  loadIncome,
  title,
}: {
  loadIncome: (netId: string) => Promise<ProductIncomeInfo | null>
  title: string
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const backgroundLocation = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
  const returnPath = backgroundLocation
    ? `${backgroundLocation.pathname}${backgroundLocation.search}${backgroundLocation.hash}`
    : null
  const returnState = backgroundLocation?.state

  function handleClose() {
    if (returnPath) {
      navigate(returnPath, { state: returnState })
    } else {
      navigate(-1)
    }
  }
  const [income, setIncome] = useValueState<ProductIncomeInfo | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [placementDetailsRow, setPlacementDetailsRow] = useValueState<SupplyPlacementRow | null>(null)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductIncomeDocumentsExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)

  useEffect(() => {
    let isActive = true

    async function loadProductIncome() {
      if (!id) {
        setError(t('Не задано ідентифікатор документа'))
        setIncome(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const nextIncome = await loadIncome(id)

        if (!isActive) {
          return
        }

        setIncome(nextIncome)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setIncome(null)
        setError(requestError instanceof Error ? requestError.message : t('Не вдалося завантажити розміщення приходу'))
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadProductIncome()

    return () => {
      isActive = false
    }
  }, [id, loadIncome, setError, setIncome, setLoading, t])

  const rows = useMemo(() => mapSupplyPlacementRows(getActiveProductIncomeItems(income)), [income])
  const columns = usePlacementColumns(setPlacementDetailsRow)
  const firstPackingItem = rows[0]?.item.PackingListPackageOrderItem
  const firstUkraineItem = rows[0]?.item.SupplyOrderUkraineItem
  const packingList = income?.PackingList || firstPackingItem?.PackingList || null
  const invoice = packingList?.SupplyInvoice || null
  const order = invoice?.SupplyOrder || null
  const ukraineOrder = firstUkraineItem?.SupplyOrderUkraine || null
  const currencyCode = order?.ClientAgreement?.Agreement?.Currency?.Code
    || ukraineOrder?.ClientAgreement?.Agreement?.Currency?.Code
    || income?.Currency?.Code
    || ''
  const exchangeRate = firstPackingItem?.ExchangeRateAmount ?? income?.ExchangeRateToUah
  const status = firstUkraineItem ? getUkrainePlacementStatus(rows) : getPlacementStatus(packingList)

  async function handleExport() {
    if (!income?.NetUid) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const nextDocument = await exportProductIncomeDocument(income.NetUid)

      setDownloadDocument(nextDocument)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppDrawer
      closeOnClickOutside={false}
      opened
      position="right"
      size="full"
      title={
        <Group gap="sm" wrap="nowrap">
          <span style={{ fontFamily: 'var(--font-mono)' }}>{t(title)}</span>
          <Badge color={status.color} variant="light">
            {status.label}
          </Badge>
        </Group>
      }
      onClose={handleClose}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          {order?.SupplyOrderNumber?.Number || ukraineOrder?.Number || income?.Number ? (
            <Text c="dimmed" size="sm">
              {order?.SupplyOrderNumber?.Number || ukraineOrder?.Number || income?.Number}
            </Text>
          ) : (
            <span />
          )}
          {firstUkraineItem && income?.NetUid && (
            <Button color={CREATE_ACTION_COLOR} loading={isExporting} onClick={() => void handleExport()}>
              {t('Експорт')}
            </Button>
          )}
        </Group>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text className="app-section-title" fw={600} size="sm">
            {firstUkraineItem ? t('Замовлення Україна') : t('Замовлення постачальника')}
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <DetailValue label={t('Номер замовлення')} value={order?.SupplyOrderNumber?.Number || ukraineOrder?.Number} />
            <DetailValue label={t('Постачальник')} value={getEntityName(order?.Client || ukraineOrder?.Supplier)} />
            <DetailValue label={t('Від')} value={formatDate(order?.DateFrom || ukraineOrder?.FromDate)} />
            <DetailValue label={t('Організація')} value={getEntityName(order?.Organization || ukraineOrder?.Organization || income?.Organization)} />
            <DetailValue label={t('Валюта')} value={currencyCode} />
            <DetailValue label={t('Договір')} value={order?.ClientAgreement?.Agreement?.Name || ukraineOrder?.ClientAgreement?.Agreement?.Name} />
            <DetailValue label={t('Інвойс')} value={invoice?.Number || ukraineOrder?.InvNumber} />
            <DetailValue label={t('Дата інвойсу')} value={formatDate(invoice?.DateFrom || ukraineOrder?.InvDate)} />
            <DetailValue label={t('Пакувальний лист')} value={packingList?.InvNo || packingList?.Number} />
            <DetailValue label={t('Номер приходу')} value={income?.Number} />
            <DetailValue label={t('Дата розміщення')} value={formatDate(income?.FromDate)} />
            <DetailValue label={t('Склад')} value={income?.Storage?.Name} />
            <DetailValue label={t('Відповідальний')} value={getEntityName(income?.User)} />
            <DetailValue
              label={`${t('Курс')} ${currencyCode ? `${currencyCode} ${t('до')} UAH` : ''}`.trim()}
              value={formatRate(exchangeRate)}
            />
          </SimpleGrid>
        </Stack>
      </Card>

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text className="app-section-title" fw={600} size="sm">{t('Позиції')}</Text>

          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={ITEMS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Позицій не знайдено')}
            getRowId={(row) => String(row.item.NetUid || row.item.Id || row.index)}
            isLoading={isLoading}
            layoutVersion="supply-order-product-placement-1"
            loadingText={t('Завантаження розміщення')}
            maxHeight="calc(100vh - 430px)"
            minWidth={1780}
            tableId="supply-order-product-placement"
          />
        </Stack>
      </Card>

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Group gap="xl" justify="flex-end" wrap="wrap">
          <TotalValue label={t('Всього товарів')} value={rows.length} />
          <TotalValue label={t('Всього кількість')} value={formatAmount(packingList?.TotalQuantity || income?.TotalQty)} />
          <TotalValue label={t('Всього нетто')} value={formatMoney(packingList?.TotalNetPrice || income?.TotalNetPrice)} />
          <TotalValue label={t('Всього з ПДВ')} value={formatMoney(firstUkraineItem ? (income?.TotalGrossPrice || packingList?.TotalNetPriceWithVat || income?.TotalNetWithVat) : (packingList?.TotalNetPriceWithVat || income?.TotalNetWithVat))} />
          <TotalValue label={t('ПДВ')} value={formatMoney(packingList?.TotalVatAmount || income?.TotalVatAmount)} />
          <TotalValue label={t('Вага нетто')} value={formatAmount(packingList?.TotalNetWeight || income?.TotalNetWeight)} />
          <TotalValue label={t('Вага брутто')} value={formatAmount(packingList?.TotalGrossWeight || income?.TotalGrossWeight)} />
        </Group>
      </Card>

      <PlacementDetailsDrawer row={placementDetailsRow} onClose={() => setPlacementDetailsRow(null)} />

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Документ приходу')}
        onClose={() => setDownloadModalOpened(false)}
      >
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.DocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.PdfDocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
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
      </Stack>
    </AppDrawer>
  )
}

function usePlacementColumns(
  onOpenPlacementDetails: (row: SupplyPlacementRow) => void,
): DataTableColumn<SupplyPlacementRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyPlacementRow>[]>(
    () => [
      {
        id: 'index',
        header: '',
        width: 58,
        minWidth: 50,
        accessor: (row) => row.index,
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.vendorCode,
        cell: (row) => <Text fw={700}>{displayValue(row.vendorCode)}</Text>,
      },
      {
        id: 'productName',
        header: t('Назва товару'),
        width: 280,
        minWidth: 220,
        accessor: (row) => row.productName,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(row.productName)}
          </Text>
        ),
      },
      {
        id: 'specificationCode',
        header: t('Код специфікації'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.specificationCode,
        cell: (row) => displayValue(row.specificationCode),
      },
      {
        id: 'orderedQty',
        header: t('Замовлено'),
        width: 118,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.orderedQty,
        cell: (row) => formatAmount(row.orderedQty),
      },
      {
        id: 'actualQty',
        header: t('Факт'),
        width: 104,
        minWidth: 92,
        align: 'right',
        accessor: (row) => row.actualQty,
        cell: (row) => formatAmount(row.actualQty),
      },
      {
        id: 'measureUnit',
        header: t('Од. виміру'),
        width: 120,
        minWidth: 104,
        accessor: (row) => row.measureUnit,
        cell: (row) => displayValue(row.measureUnit),
      },
      {
        id: 'customsRate',
        header: t('Мито %'),
        width: 106,
        minWidth: 92,
        align: 'right',
        accessor: (row) => row.customsRate,
        cell: (row) => formatAmount(row.customsRate),
      },
      {
        id: 'customsValue',
        header: t('Митна вартість'),
        width: 132,
        minWidth: 116,
        align: 'right',
        accessor: (row) => row.customsValue,
        cell: (row) => formatMoney(row.customsValue),
      },
      {
        id: 'unitPrice',
        header: t('Ціна нетто'),
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.unitPrice,
        cell: (row) => formatMoney(row.unitPrice),
      },
      {
        id: 'totalNetPrice',
        header: t('Сума нетто'),
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (row) => row.totalNetPrice,
        cell: (row) => formatMoney(row.totalNetPrice),
      },
      {
        id: 'totalNetWeight',
        header: t('Вага нетто'),
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.totalNetWeight,
        cell: (row) => formatAmount(row.totalNetWeight),
      },
      {
        id: 'totalGrossWeight',
        header: t('Вага брутто'),
        width: 126,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.totalGrossWeight,
        cell: (row) => formatAmount(row.totalGrossWeight),
      },
      {
        id: 'isImported',
        header: t('Імпорт'),
        width: 94,
        minWidth: 84,
        align: 'center',
        accessor: (row) => row.isImported,
        cell: (row) => (
          <Badge color={row.isImported ? 'green' : 'gray'} variant="light">
            {row.isImported ? t('Так') : t('Ні')}
          </Badge>
        ),
      },
      {
        id: 'vatPercent',
        header: t('ПДВ %'),
        width: 96,
        minWidth: 84,
        align: 'right',
        accessor: (row) => row.vatPercent,
        cell: (row) => formatAmount(row.vatPercent),
      },
      {
        id: 'vatAmount',
        header: t('Сума ПДВ'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.vatAmount,
        cell: (row) => formatMoney(row.vatAmount),
      },
      {
        id: 'total',
        header: t('Разом'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.total,
        cell: (row) => formatMoney(row.total),
      },
      {
        id: 'placements',
        header: t('Місця зберігання'),
        width: 260,
        minWidth: 220,
        accessor: (row) => row.placements.map(formatPlacement).join(', '),
        cell: (row) => <PlacementList placements={row.placements} />,
      },
      {
        id: 'placementDetails',
        header: '',
        width: 64,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) =>
          row.placements.length > 0 ? (
            <Tooltip label={t('Місця зберігання')}>
              <ActionIcon
                aria-label={t('Місця зберігання')}
                color="blue"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenPlacementDetails(row)
                }}
              >
                <MapPin size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null,
      },
    ],
    [onOpenPlacementDetails, t],
  )
}

function DetailValue({ label, value }: { label: string; value?: string | number }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={600} size="sm" lineClamp={2}>
        {displayValue(value)}
      </Text>
    </Stack>
  )
}

function TotalValue({ label, value }: { label: string; value?: string | number }) {
  return (
    <Stack gap={2} miw={120}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {displayValue(value)}
      </Text>
    </Stack>
  )
}

function PlacementList({ placements }: { placements: ProductIncomePlacement[] }) {
  if (placements.length === 0) {
    return <Text c="dimmed">-</Text>
  }

  return (
    <Stack gap={2}>
      {placements.map((placement, index) => (
        <Text key={placement.NetUid || placement.Id || index} size="xs">
          {formatPlacement(placement)}
        </Text>
      ))}
    </Stack>
  )
}

function PlacementDetailsDrawer({ row, onClose }: { row: SupplyPlacementRow | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={Boolean(row)}
      padding="md"
      size="md"
      title={row ? `${displayValue(row.vendorCode)} ${displayValue(row.productName)}` : t('Місця зберігання')}
      onClose={onClose}
    >
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <DetailValue label={t('Код товару')} value={row.vendorCode} />
            <DetailValue label={t('Назва товару')} value={row.productName} />
            <DetailValue label={t('Факт')} value={formatAmount(row.actualQty)} />
            <DetailValue label={t('Замовлено')} value={formatAmount(row.orderedQty)} />
          </SimpleGrid>

          <Stack gap="xs">
            <Text fw={700}>{t('Місця зберігання')}</Text>
            {row.placements.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('Місця зберігання не вказані')}
              </Text>
            ) : (
              row.placements.map((placement, index) => (
                <Card key={placement.NetUid || placement.Id || index} withBorder radius="sm" padding="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <DetailValue label={t('Позиція')} value={formatPlacementAddress(placement)} />
                    <DetailValue label={t('Кількість')} value={formatAmount(placement.Qty)} />
                    <DetailValue label={t('Склад')} value={getEntityName(placement.Storage)} />
                    <DetailValue label={t('Статус')} value={placement.IsApplied ? t('Застосовано') : t('Очікує')} />
                  </SimpleGrid>
                </Card>
              ))
            )}
          </Stack>
        </Stack>
      )}
    </AppDrawer>
  )
}

function getPlacementStatus(packingList?: ProductIncomePackingList | null): { color: string; label: string } {
  const invoice = packingList?.SupplyInvoice

  if ((packingList?.Id && packingList.IsPlaced) || invoice?.IsFullyPlaced) {
    return { color: 'green', label: 'Розміщено' }
  }

  if (invoice?.IsPartiallyPlaced) {
    return { color: 'yellow', label: 'Частково розміщено' }
  }

  return { color: 'gray', label: 'Не розміщено' }
}

function getUkrainePlacementStatus(rows: SupplyPlacementRow[]): { color: string; label: string } {
  if (rows.length === 0) {
    return { color: 'gray', label: 'Не розміщено' }
  }

  const placedRows = rows.filter((row) => readFiniteNumber(row.actualQty) > 0)
  const fullyPlaced = rows.every((row) => {
    const orderedQty = readFiniteNumber(row.orderedQty)
    const actualQty = readFiniteNumber(row.actualQty)

    return orderedQty > 0 && actualQty >= orderedQty
  })

  if (fullyPlaced) {
    return { color: 'green', label: 'Розміщено' }
  }

  if (placedRows.length > 0) {
    return { color: 'yellow', label: 'Частково розміщено' }
  }

  return { color: 'gray', label: 'Не розміщено' }
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.NameUA || entity?.Name || entity?.LastName || entity?.Number || entity?.Code
}

function formatPlacement(placement: ProductIncomePlacement): string {
  return `${formatPlacementAddress(placement)} - ${formatAmount(placement.Qty)}`
}

function formatPlacementAddress(placement: ProductIncomePlacement): string {
  return placement.Address || [
    placement.StorageNumber,
    placement.RowNumber,
    placement.CellNumber,
  ].filter(Boolean).join('-') || '-'
}

function formatDate(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function formatMoney(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '-'
  }

  return moneyFormatter.format(value)
}

function formatRate(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '-'
  }

  return rateFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  return value || '-'
}

function readFiniteNumber(value?: number): number {
  return isFiniteNumber(value) ? value : 0
}

function isFiniteNumber(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
