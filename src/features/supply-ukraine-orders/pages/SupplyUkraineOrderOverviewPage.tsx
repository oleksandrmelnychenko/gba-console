import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalculator,
  IconDeviceFloppy,
  IconFile,
  IconFileUpload,
  IconPackageImport,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  addVatPercentToSupplyOrderUkraine,
  getSupplyUkraineOrderById,
  manageSupplyOrderUkraineDocuments,
  updateSupplyOrderUkraineItems,
} from '../api/supplyUkraineOrdersApi'
import {
  SupplyUkraineOrderDocumentsModal,
  type UkraineOrderNewDocument,
} from '../components/SupplyUkraineOrderDocumentsModal'
import type { SupplyOrderUkraine, SupplyOrderUkraineDocument, SupplyOrderUkraineItem } from '../types'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PLACEMENT_PERMISSION = 'PlacementHeader_ProductPlacement_ordersUkraineView_PKEY'
const CALCULATE_VAT_PERMISSION = 'PlacementHeader_Calculate_ordersUkraineView_PKEY'
const MANAGE_DOCUMENTS_PERMISSION = 'PlacementHeader_LoadingSales_ordersUkraineView_PKEY'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type OverviewRow = {
  accountingCost?: number
  accountingDeliveryExpenseAmount?: number
  amount?: number
  deliveryExpenseAmount?: number
  grossWeight?: number
  index: number
  isImported?: boolean
  isVatChanged?: boolean
  item: SupplyOrderUkraineItem
  managementCost?: number
  measureUnit?: string
  netWeight?: number
  productName?: string
  qty?: number
  specificationCode?: string
  totalWithVat?: number
  unitPrice?: number
  vatAccounting?: number
  vatPercent?: number
  vendorCode?: string
}

export function SupplyUkraineOrderOverviewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const [order, setOrder] = useState<SupplyOrderUkraine | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isSavingDocuments, setSavingDocuments] = useState(false)
  const [isSavingVat, setSavingVat] = useState(false)
  const [isSavingVatItems, setSavingVatItems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [documentsOpened, setDocumentsOpened] = useState(false)
  const [documentsCloseConfirmOpened, setDocumentsCloseConfirmOpened] = useState(false)
  const [documentDrafts, setDocumentDrafts] = useState<SupplyOrderUkraineDocument[]>([])
  const [newDocuments, setNewDocuments] = useState<UkraineOrderNewDocument[]>([])
  const [hasVatItemChanges, setVatItemChanges] = useState(false)
  const canCalculateVat = hasPermission(CALCULATE_VAT_PERMISSION)
  const canManageDocuments = hasPermission(MANAGE_DOCUMENTS_PERMISSION)
  const canOpenPlacement = hasPermission(PLACEMENT_PERMISSION)

  useEffect(() => {
    let cancelled = false

    async function loadOrder() {
      if (!id) {
        setError(t('Не задано ідентифікатор замовлення'))
        setOrder(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const nextOrder = await getSupplyUkraineOrderById(id)

        if (!cancelled) {
          setOrder(hydrateSupplyUkraineOrder(nextOrder))
          setVatItemChanges(false)
        }
      } catch (requestError) {
        if (!cancelled) {
          setOrder(null)
          setError(requestError instanceof Error ? requestError.message : t('Не вдалося завантажити замовлення'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      cancelled = true
    }
  }, [id, t])

  async function reloadOrder() {
    if (!id) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextOrder = await getSupplyUkraineOrderById(id)
      setOrder(hydrateSupplyUkraineOrder(nextOrder))
      setVatItemChanges(false)
    } catch (requestError) {
      setOrder(null)
      setError(requestError instanceof Error ? requestError.message : t('Не вдалося завантажити замовлення'))
    } finally {
      setLoading(false)
    }
  }

  function changeOrderVatPercent(value: string | number) {
    setOrder((currentOrder) => currentOrder
      ? { ...currentOrder, VatPercent: toPercentNumber(value, 0) }
      : currentOrder)
  }

  async function calculateVatPercentForOrder() {
    if (!order || isSavingVat) {
      return
    }

    setSavingVat(true)
    setError(null)

    try {
      const updatedOrder = await addVatPercentToSupplyOrderUkraine(order)

      if (updatedOrder) {
        setOrder(hydrateSupplyUkraineOrder(updatedOrder))
        setVatItemChanges(false)
      } else {
        await reloadOrder()
      }

      notifications.show({ color: 'green', message: t('ПДВ перераховано') })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Не вдалося перерахувати ПДВ'))
      notifications.show({ color: 'red', message: t('Не вдалося перерахувати ПДВ') })
    } finally {
      setSavingVat(false)
    }
  }

  function changeItemVatPercent(row: OverviewRow, value: string | number) {
    setOrder((currentOrder) => {
      if (!currentOrder) {
        return currentOrder
      }

      const nextItems = (currentOrder.SupplyOrderUkraineItems || []).map((item) => {
        if (!isSameOrderItem(item, row.item)) {
          return item
        }

        return {
          ...item,
          VatPercent: toPercentNumber(value, 2),
          isChanged: true,
        }
      })

      return { ...currentOrder, SupplyOrderUkraineItems: nextItems }
    })
    setVatItemChanges(true)
  }

  async function saveItemVatPercentChanges() {
    if (!order || isSavingVatItems) {
      return
    }

    const orderNetId = order.NetUid || id
    const changedItems = (order.SupplyOrderUkraineItems || []).filter((item) => Boolean(item.isChanged))

    if (!orderNetId || changedItems.length === 0) {
      setVatItemChanges(false)
      return
    }

    setSavingVatItems(true)
    setError(null)

    try {
      const updatedOrder = await updateSupplyOrderUkraineItems(orderNetId, changedItems)

      if (updatedOrder) {
        setOrder(hydrateSupplyUkraineOrder(updatedOrder))
      } else {
        await reloadOrder()
      }

      setVatItemChanges(false)
      notifications.show({ color: 'green', message: t('ПДВ у рядках збережено') })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Не вдалося зберегти ПДВ у рядках'))
      notifications.show({ color: 'red', message: t('Не вдалося зберегти ПДВ у рядках') })
    } finally {
      setSavingVatItems(false)
    }
  }

  function cancelItemVatPercentChanges() {
    if (isSavingVatItems) {
      return
    }

    setOrder((currentOrder) => {
      if (!currentOrder) {
        return currentOrder
      }

      return {
        ...currentOrder,
        SupplyOrderUkraineItems: (currentOrder.SupplyOrderUkraineItems || []).map((item) => {
          if (!item.isChanged) {
            return item
          }

          return {
            ...item,
            VatPercent: typeof item.VatPercentStore === 'number' ? item.VatPercentStore : item.VatPercent,
            isChanged: false,
          }
        }),
      }
    })
    setVatItemChanges(false)
  }

  function openDocumentsModal() {
    if (isSavingDocuments) {
      return
    }

    setDocumentDrafts(
      (order?.SupplyOrderUkraineDocuments || []).map((document) => ({
        ...document,
        Deleted: Boolean(document.Deleted),
      })),
    )
    setNewDocuments([])
    setDocumentsOpened(true)
    setDocumentsCloseConfirmOpened(false)
  }

  function hasDocumentDraftChanges(): boolean {
    const sourceDocuments = order?.SupplyOrderUkraineDocuments || []

    return (
      newDocuments.length > 0 ||
      documentDrafts.some((document, index) => {
        const sourceDocument = sourceDocuments.find((source) => isSameDocument(source, document)) || sourceDocuments[index]

        return Boolean(document.Deleted) !== Boolean(sourceDocument?.Deleted)
      })
    )
  }

  function requestCloseDocumentsModal() {
    if (isSavingDocuments) {
      return
    }

    if (hasDocumentDraftChanges()) {
      setDocumentsCloseConfirmOpened(true)
      return
    }

    closeDocumentsModal()
  }

  function closeDocumentsModal() {
    setDocumentsOpened(false)
    setDocumentsCloseConfirmOpened(false)
    setDocumentDrafts([])
    setNewDocuments([])
  }

  function addDocumentFiles(files: File[]) {
    if (isSavingDocuments) {
      return
    }

    setNewDocuments((currentDocuments) => [
      ...currentDocuments,
      ...files.map((file, index) => createNewDocumentDraft(file, currentDocuments.length + index)),
    ])
  }

  function removeNewDocument(document: UkraineOrderNewDocument) {
    if (isSavingDocuments) {
      return
    }

    setNewDocuments((currentDocuments) => currentDocuments.filter((currentDocument) => currentDocument.id !== document.id))
  }

  function toggleExistingDocument(document: SupplyOrderUkraineDocument) {
    if (isSavingDocuments) {
      return
    }

    setDocumentDrafts((currentDocuments) =>
      currentDocuments.map((currentDocument) =>
        isSameDocument(currentDocument, document)
          ? { ...currentDocument, Deleted: !currentDocument.Deleted }
          : currentDocument,
      ),
    )
  }

  async function saveDocuments() {
    if (!order || isSavingDocuments) {
      return
    }

    setSavingDocuments(true)
    setError(null)

    try {
      const updatedOrder = await manageSupplyOrderUkraineDocuments({
        documents: newDocuments.map((document) => document.file),
        order: { ...order, SupplyOrderUkraineDocuments: documentDrafts },
      })

      if (updatedOrder) {
        setOrder(hydrateSupplyUkraineOrder(updatedOrder))
      } else {
        await reloadOrder()
      }

      closeDocumentsModal()
      notifications.show({ color: 'green', message: t('Документи збережено') })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Не вдалося зберегти документи'))
      notifications.show({ color: 'red', message: t('Не вдалося зберегти документи') })
    } finally {
      setSavingDocuments(false)
    }
  }

  const rows = useMemo(() => mapRows(order?.SupplyOrderUkraineItems || []), [order?.SupplyOrderUkraineItems])
  const visibleRows = useMemo(() => filterRows(rows, search), [rows, search])
  const columns = useOverviewColumns({
    isSavingVatItems,
    onChangeVatPercent: changeItemVatPercent,
  })
  const documentColumns = useDocumentColumns()
  const documents = order?.SupplyOrderUkraineDocuments || []
  const { density: documentsDensity, toggleDensity: toggleDocumentsDensity } = useDataTableDensity('supply-ukraine-order-documents', 'normal')
  const { density: overviewDensity, toggleDensity: toggleOverviewDensity } = useDataTableDensity('supply-ukraine-order-overview', TABLE_DEFAULT_LAYOUT.density)
  const orderRecord = asRecord(order)
  const currencyCode = order?.ClientAgreement?.Agreement?.Currency?.Code || order?.ClientAgreement?.Agreement?.Currency?.Name || ''

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Button color="gray" leftSection={<IconArrowLeft size={16} />} variant="subtle" onClick={() => navigate(-1)}>
          {t('Назад')}
        </Button>
        <Group justify="flex-end">
          <Stack gap={2} align="flex-end">
            <Text fw={700} size="xl">{t('Огляд поставки в Україну')}</Text>
            <Text c="dimmed" size="sm">{order?.Number || id}</Text>
          </Stack>
          {canManageDocuments && order && (
            <Button
              disabled={isSavingDocuments}
              leftSection={<IconFileUpload size={16} />}
              variant="light"
              onClick={openDocumentsModal}
            >
              {t('Документи')}
            </Button>
          )}
          {canOpenPlacement && id && !order?.IsPlaced && (
            <Button
              disabled={isSavingDocuments || isSavingVat || isSavingVatItems}
              leftSection={<IconPackageImport size={16} />}
              variant="light"
              onClick={() => navigate(`/orders/ukraine/placement/${id}`)}
            >
              {t('Розміщення товару')}
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={700}>{t('Замовлення')}</Text>
            <Badge color={order?.IsPlaced ? 'green' : 'gray'} variant="light">
              {order?.IsPlaced ? t('Розміщено') : t('Не розміщено')}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <DetailValue label={t('Номер')} value={order?.Number} />
            <DetailValue label={t('Дата')} value={formatDateTime(order?.FromDate)} />
            <DetailValue label={t('Інвойс')} value={order?.InvNumber} />
            <DetailValue label={t('Дата інвойсу')} value={formatDateTime(order?.InvDate)} />
            <DetailValue label={t('Постачальник')} value={getEntityName(order?.Supplier)} />
            <DetailValue label={t('Договір')} value={order?.ClientAgreement?.Agreement?.Name} />
            <DetailValue label={t('Валюта')} value={currencyCode} />
            <DetailValue label={t('Організація')} value={getRecipientOrganizationName(order)} />
            <DetailValue label={t('Відповідальний')} value={getEntityName(order?.Responsible)} />
            <DetailValue label={t('Кількість')} value={formatAmount(order?.TotalQty)} />
            <DetailValue label={t('Сума')} value={formatMoney(order?.TotalGrossPriceLocal)} />
            <DetailValue label={currencyCode ? `${t('Курс')} ${currencyCode} ${t('до')} EUR` : t('Курс')} value={formatAmount(order?.ExchangeRateAmount)} />
            <DetailValue label={t('Додатковий відсоток')} value={formatAmount(order?.AdditionalPercent)} />
            <DetailValue label={t('ПДВ')} value={formatAmount(order?.VatPercent)} />
          </SimpleGrid>

          <Group align="flex-end" justify="space-between" wrap="wrap">
            <NumberInput
              allowDecimal={false}
                disabled={!order || isSavingVat || isSavingVatItems}
              label={t('Відсоток ПДВ')}
              max={100}
              min={0}
              value={order?.VatPercent ?? 0}
              w={220}
              onChange={changeOrderVatPercent}
            />
            {canCalculateVat && (
              <Button
                leftSection={<IconCalculator size={16} />}
                disabled={!order || isSavingVat || isSavingVatItems}
                loading={isSavingVat}
                onClick={calculateVatPercentForOrder}
              >
                {t('Розрахувати')}
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      {canManageDocuments && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Stack gap={2}>
                <Text fw={700}>{t('Документи замовлення')}</Text>
              </Stack>
              <Group gap="xs">
                {order && (
                  <Button disabled={isSavingDocuments} leftSection={<IconFileUpload size={16} />} variant="light" onClick={openDocumentsModal}>
                    {t('Завантажити')}
                  </Button>
                )}
                <DataTableDensityToggle density={documentsDensity} onToggle={toggleDocumentsDensity} size={36} />
              </Group>
            </Group>
            <DataTable
              columns={documentColumns}
              data={documents}
              density={documentsDensity}
              emptyText={t('Документів немає')}
              getRowId={(document, index) => document.NetUid || String(document.Id || index)}
              layoutVersion="supply-ukraine-order-documents-1"
              minWidth={760}
              tableId="supply-ukraine-order-documents"
            />
          </Stack>
        </Card>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Text fw={700}>{t('Товари')}</Text>
            </Stack>
            <Group justify="flex-end" align="flex-end">
              {hasVatItemChanges && (
                <Group gap="xs">
                  <Button
                    leftSection={<IconDeviceFloppy size={16} />}
                    disabled={isSavingVatItems}
                    loading={isSavingVatItems}
                    size="sm"
                    onClick={saveItemVatPercentChanges}
                  >
                    {t('Зберегти ПДВ')}
                  </Button>
                  <Button
                    color="gray"
                    disabled={isSavingVatItems}
                    leftSection={<IconX size={16} />}
                    size="sm"
                    variant="light"
                    onClick={cancelItemVatPercentChanges}
                  >
                    {t('Скасувати')}
                  </Button>
                </Group>
              )}
              <TextInput
                leftSection={<IconSearch size={16} />}
                placeholder={t('Код, назва або код УКТЗЕД')}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <DataTableDensityToggle density={overviewDensity} onToggle={toggleOverviewDensity} size="sm" />
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={visibleRows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={overviewDensity}
            emptyText={t('Товарів не знайдено')}
            getRowId={(row) => row.item.NetUid || String(row.item.Id || row.index)}
            isLoading={isLoading}
            layoutVersion="supply-ukraine-order-overview-table-1"
            loadingText={t('Завантаження товарів')}
            maxHeight="calc(100vh - 500px)"
            minWidth={1540}
            tableId="supply-ukraine-order-overview"
          />
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Group gap="xl" justify="flex-end" wrap="wrap">
          <TotalValue label={t('Управлінські витрати')} value={formatMoney(readNumber(orderRecord.TotalDeliveryExpenseAmount))} />
          <TotalValue label={t('Бухгалтерські витрати')} value={formatMoney(readNumber(orderRecord.TotalAccountingDeliveryExpenseAmount))} />
          <TotalValue label={t('Кількість')} value={formatAmount(order?.TotalQty)} />
          <TotalValue label={t('Нетто')} value={formatMoney(readNumber(orderRecord.TotalNetPriceLocal))} />
          <TotalValue label={t('ПДВ')} value={formatMoney(order?.TotalVatAmount)} />
          <TotalValue label={t('З ПДВ')} value={formatMoney(readNumber(orderRecord.TotalNetPriceLocalWithVat))} />
          <TotalValue label={t('Вага нетто')} value={formatAmount(readNumber(orderRecord.TotalNetWeight))} />
          <TotalValue label={t('Вага брутто')} value={formatAmount(readNumber(orderRecord.TotalGrossWeight))} />
        </Group>
      </Card>

      <SupplyUkraineOrderDocumentsModal
        existingDocuments={documentDrafts}
        isSaving={isSavingDocuments}
        newDocuments={newDocuments}
        opened={documentsOpened}
        onAddFiles={addDocumentFiles}
        onClose={requestCloseDocumentsModal}
        onRemoveNewDocument={removeNewDocument}
        onSave={saveDocuments}
        onToggleExistingDocument={toggleExistingDocument}
      />
      <AppModal
        centered
        opened={documentsCloseConfirmOpened}
        title={t('Є незбережені зміни')}
        onClose={() => {
          if (!isSavingDocuments) {
            setDocumentsCloseConfirmOpened(false)
          }
        }}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити вікно, зміни по документах не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isSavingDocuments} variant="light" onClick={() => setDocumentsCloseConfirmOpened(false)}>
              {t('Залишитися')}
            </Button>
            <Button color="red" disabled={isSavingDocuments} onClick={closeDocumentsModal}>
              {t('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function useOverviewColumns({
  isSavingVatItems,
  onChangeVatPercent,
}: {
  isSavingVatItems: boolean
  onChangeVatPercent: (row: OverviewRow, value: string | number) => void
}): DataTableColumn<OverviewRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<OverviewRow>[]>(
    () => [
      { id: 'index', header: '', width: 58, accessor: (row) => row.index },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 150,
        accessor: (row) => row.vendorCode,
        cell: (row) => <Text fw={700}>{displayValue(row.vendorCode)}</Text>,
      },
      {
        id: 'productName',
        header: t('Назва'),
        minWidth: 240,
        accessor: (row) => row.productName,
        cell: (row) => displayValue(row.productName),
      },
      {
        id: 'specificationCode',
        header: t('Код УКТЗЕД'),
        width: 150,
        accessor: (row) => row.specificationCode,
        cell: (row) => displayValue(row.specificationCode),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        align: 'right',
        accessor: (row) => row.qty,
        cell: (row) => formatAmount(row.qty),
      },
      {
        id: 'measureUnit',
        header: t('Од. виміру'),
        width: 120,
        accessor: (row) => row.measureUnit,
        cell: (row) => displayValue(row.measureUnit),
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        width: 110,
        align: 'right',
        accessor: (row) => row.unitPrice,
        cell: (row) => formatMoney(row.unitPrice),
      },
      {
        id: 'amount',
        header: t('Сума нетто'),
        width: 120,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => formatMoney(row.amount),
      },
      {
        id: 'isImported',
        header: t('Імпорт'),
        width: 96,
        accessor: (row) => row.isImported,
        cell: (row) => row.isImported ? <Badge color="green" variant="light">{t('Так')}</Badge> : <Badge color="gray" variant="light">{t('Ні')}</Badge>,
      },
      {
        id: 'vatPercent',
        header: t('ПДВ %'),
        width: 120,
        align: 'right',
        accessor: (row) => row.vatPercent,
        cell: (row) => (
          <NumberInput
            allowDecimal
            decimalScale={2}
            disabled={isSavingVatItems}
            hideControls
            max={100}
            min={0}
            size="xs"
            value={row.vatPercent ?? 0}
            variant={row.isVatChanged ? 'filled' : 'default'}
            w={92}
            onChange={(value) => onChangeVatPercent(row, value)}
          />
        ),
      },
      {
        id: 'vatAccounting',
        header: t('ПДВ бух.'),
        width: 120,
        align: 'right',
        accessor: (row) => row.vatAccounting,
        cell: (row) => formatMoney(row.vatAccounting),
      },
      {
        id: 'totalWithVat',
        header: t('З ПДВ'),
        width: 120,
        align: 'right',
        accessor: (row) => row.totalWithVat,
        cell: (row) => formatMoney(row.totalWithVat),
      },
      {
        id: 'netWeight',
        header: t('Нетто вага'),
        width: 120,
        align: 'right',
        accessor: (row) => row.netWeight,
        cell: (row) => formatAmount(row.netWeight),
      },
      {
        id: 'grossWeight',
        header: t('Брутто вага'),
        width: 120,
        align: 'right',
        accessor: (row) => row.grossWeight,
        cell: (row) => formatAmount(row.grossWeight),
      },
      {
        id: 'accountingDeliveryExpenseAmount',
        header: t('Витрати бух.'),
        width: 120,
        align: 'right',
        accessor: (row) => row.accountingDeliveryExpenseAmount,
        cell: (row) => formatMoney(row.accountingDeliveryExpenseAmount),
      },
      {
        id: 'deliveryExpenseAmount',
        header: t('Витрати упр.'),
        width: 120,
        align: 'right',
        accessor: (row) => row.deliveryExpenseAmount,
        cell: (row) => formatMoney(row.deliveryExpenseAmount),
      },
      {
        id: 'accountingCost',
        header: t('Собівартість бух.'),
        width: 140,
        align: 'right',
        accessor: (row) => row.accountingCost,
        cell: (row) => formatMoney(row.accountingCost),
      },
      {
        id: 'managementCost',
        header: t('Собівартість упр.'),
        width: 140,
        align: 'right',
        accessor: (row) => row.managementCost,
        cell: (row) => formatMoney(row.managementCost),
      },
    ],
    [isSavingVatItems, onChangeVatPercent, t],
  )
}

function useDocumentColumns(): DataTableColumn<SupplyOrderUkraineDocument>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrderUkraineDocument>[]>(
    () => [
      {
        id: 'fileName',
        header: t('Документ'),
        minWidth: 260,
        accessor: (document) => document.FileName || document.Name,
        cell: (document) => document.DocumentUrl ? (
          <Anchor href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" target="_blank">
            {document.FileName || document.Name || t('Документ')}
          </Anchor>
        ) : document.FileName || document.Name || '-',
      },
      {
        id: 'contentType',
        header: t('Тип'),
        width: 100,
        accessor: (document) => document.ContentType,
        cell: (document) => document.ContentType || '-',
      },
      {
        id: 'deleted',
        header: t('Статус'),
        width: 130,
        accessor: (document) => document.Deleted,
        cell: (document) => (
          <Badge color={document.Deleted ? 'red' : 'green'} variant="light">
            {document.Deleted ? t('Видалено') : t('Активний')}
          </Badge>
        ),
      },
      {
        id: 'open',
        header: '',
        width: 64,
        align: 'center',
        enableSorting: false,
        accessor: (document) => document.DocumentUrl,
        cell: (document) => document.DocumentUrl ? (
          <Tooltip label={t('Відкрити')}>
            <ActionIcon
              component="a"
              href={upgradeHttpToHttps(document.DocumentUrl)}
              rel="noreferrer"
              target="_blank"
              variant="subtle"
            >
              <IconFile size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
      },
    ],
    [t],
  )
}

function DetailValue({ label, value }: { label: string, value: unknown }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">{label}</Text>
      <Text fw={600} size="sm">{displayValue(value)}</Text>
    </Stack>
  )
}

function TotalValue({ label, value }: { label: string, value: unknown }) {
  return (
    <Stack gap={0} align="flex-end">
      <Text c="dimmed" size="xs">{label}</Text>
      <Text fw={700}>{displayValue(value)}</Text>
    </Stack>
  )
}

function mapRows(items: SupplyOrderUkraineItem[]): OverviewRow[] {
  return items.map((item, index) => {
    const itemRecord = asRecord(item)
    const product = asRecord(itemRecord.Product)
    const measureUnit = asRecord(product.MeasureUnit)
    const productSpecification = asRecord(itemRecord.ProductSpecification)

    return {
      accountingCost: readNumber(itemRecord.AccountingCost),
      accountingDeliveryExpenseAmount: readNumber(itemRecord.AccountingDeliveryExpenseAmount),
      amount: readNumber(itemRecord.NetPriceLocal),
      deliveryExpenseAmount: readNumber(itemRecord.DeliveryExpenseAmount),
      grossWeight: readNumber(itemRecord.TotalGrossWeight),
      index: index + 1,
      isImported: Boolean(itemRecord.ProductIsImported),
      isVatChanged: Boolean(itemRecord.isChanged),
      item,
      managementCost: readNumber(itemRecord.ManagementCost),
      measureUnit: readString(measureUnit.Name),
      netWeight: readNumber(itemRecord.TotalNetWeight),
      productName: readString(product.Name) || readString(product.NameUA),
      qty: readNumber(itemRecord.Qty),
      specificationCode: readString(productSpecification.SpecificationCode),
      totalWithVat: readNumber(itemRecord.GrossPriceLocal),
      unitPrice: readNumber(itemRecord.UnitPriceLocal),
      vatAccounting: readNumber(itemRecord.VatAmountLocal),
      vatPercent: readNumber(itemRecord.VatPercent),
      vendorCode: readString(product.VendorCode),
    }
  })
}

function filterRows(rows: OverviewRow[], search: string): OverviewRow[] {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return rows
  }

  return rows.filter((row) =>
    [row.vendorCode, row.productName, row.specificationCode].some((value) =>
      Boolean(value) && value?.toLowerCase().includes(normalizedSearch),
    ),
  )
}

function hydrateSupplyUkraineOrder(order: SupplyOrderUkraine | null): SupplyOrderUkraine | null {
  if (!order) {
    return null
  }

  return {
    ...order,
    SupplyOrderUkraineDocuments: Array.isArray(order.SupplyOrderUkraineDocuments)
      ? order.SupplyOrderUkraineDocuments
      : [],
    SupplyOrderUkraineItems: (order.SupplyOrderUkraineItems || []).map((item) => ({
      ...item,
      VatPercentStore: readNumber(asRecord(item).VatPercent) ?? item.VatPercentStore,
      isChanged: false,
    })),
  }
}

function isSameOrderItem(first: SupplyOrderUkraineItem, second: SupplyOrderUkraineItem): boolean {
  if (first.NetUid && second.NetUid) {
    return first.NetUid === second.NetUid
  }

  return Boolean(first.Id && second.Id && first.Id === second.Id)
}

function isSameDocument(first: SupplyOrderUkraineDocument, second: SupplyOrderUkraineDocument): boolean {
  if (first.NetUid && second.NetUid) {
    return first.NetUid === second.NetUid
  }

  if (first.Id && second.Id) {
    return first.Id === second.Id
  }

  const firstKey = getDocumentFallbackKey(first)

  return Boolean(firstKey && firstKey === getDocumentFallbackKey(second))
}

function createNewDocumentDraft(file: File, index: number): UkraineOrderNewDocument {
  const { contentType, fileName } = splitFileName(file.name)

  return {
    contentType,
    file,
    fileName,
    id: `${Date.now()}-${index}-${file.name}`,
  }
}

function splitFileName(name: string): { contentType: string, fileName: string } {
  const parts = name.split('.')

  if (parts.length < 2) {
    return { contentType: '', fileName: name }
  }

  const contentType = parts.pop() || ''

  return {
    contentType,
    fileName: parts.join('.') || name,
  }
}

function toPercentNumber(value: string | number, decimalPlaces: number): number {
  const parsedValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  const clampedValue = Math.min(Math.max(parsedValue, 0), 100)
  const multiplier = 10 ** decimalPlaces

  return Math.round(clampedValue * multiplier) / multiplier
}

function upgradeHttpToHttps(url: string): string {
  return url.startsWith('http:') ? url.replace('http:', 'https:') : url
}

function getDocumentFallbackKey(document: SupplyOrderUkraineDocument): string {
  return [
    document.DocumentUrl,
    document.FileName || document.Name,
    document.ContentType,
  ].filter(Boolean).join(':')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}

function getEntityName(entity?: { FullName?: string, LastName?: string, Name?: string } | null): string {
  return entity?.FullName || entity?.Name || entity?.LastName || ''
}

function getRecipientOrganizationName(order?: SupplyOrderUkraine | null): string {
  if (!order) {
    return ''
  }

  const sad = order.Sad

  if (sad) {
    const sadType = Number(sad.SadType)

    if (sadType === 0) {
      return getEntityName(sad.Client)
    }

    if (sadType === 1) {
      return getEntityName(sad.OrganizationClient)
    }

    return ''
  }

  return order.Organization?.Name || ''
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '-'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
