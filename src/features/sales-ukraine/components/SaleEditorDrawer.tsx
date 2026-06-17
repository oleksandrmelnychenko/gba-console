import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowsJoin,
  IconCopy,
  IconFileInvoice,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
  IconUserShare,
} from '@tabler/icons-react'
import { useEffect, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  addOrderItem,
  convertVatSaleAndGetPaymentDocument,
  deleteOrderItem,
  getSaleById,
  getSaleClientAgreements,
  getSaleClientDebtTotal,
  getRetailPaymentStatusBySaleId,
  searchSaleProducts,
  searchSalesUkraineClients,
  switchSale,
  updateOrderItem,
  updateSaleFromData,
} from '../api/salesUkraineApi'
import { getSaleReviewIssues, type SaleReviewIssueCode } from '../saleReviewGuards'
import { getVisibleOrderItemBaseDiscount } from '../saleDiscounts'
import { getSaleLocalCurrencyCode, isNonVatEurSale, roundMoney } from '../saleMoney'
import { isStatusType } from '../saleStatus'
import { MergedSalesDrawer } from './MergedSalesDrawer'
import { SaleDetailsDrawer } from './SaleDetailsDrawer'
import type {
  SaleClientDebtTotal,
  SalesUkraineClientAgreement,
  SalesUkraineClientOption,
  SalesUkraineOrderItem,
  SalesUkraineProduct,
  SalesUkraineRetailPaymentStatus,
  SalesUkraineSale,
} from '../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const EMPTY_RETAIL_PAYMENT_STATE: RetailPaymentState = {
  error: null,
  key: '',
  status: null,
}

type RetailPaymentState = {
  error: string | null
  key: string
  status: SalesUkraineRetailPaymentStatus | null
}

export function SaleEditorDrawer({ sale, onClose }: { onClose: () => void; sale: SalesUkraineSale | null }) {
  const { t } = useI18n()

  return (
    <AppDrawer
      offset={8}
      opened={Boolean(sale)}
      padding="lg"
      position="right"
      radius="md"
      size="min(1080px, 100vw)"
      title={sale ? `${t('Продаж')} ${sale.SaleNumber?.Value || ''}`.trim() : t('Продаж')}
      onClose={onClose}
    >
      {sale && <SaleEditorContent key={sale.NetUid || sale.Id} initialSale={sale} />}
    </AppDrawer>
  )
}

function SaleEditorContent({ initialSale }: { initialSale: SalesUkraineSale }) {
  const { t } = useI18n()
  const [sale, setSale] = useValueState<SalesUkraineSale>(initialSale)
  const [retailPaymentState, setRetailPaymentState] =
    useValueState<RetailPaymentState>(EMPTY_RETAIL_PAYMENT_STATE)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [editingItem, setEditingItem] = useValueState<SalesUkraineOrderItem | null>(null)
  const [deletingItem, setDeletingItem] = useValueState<SalesUkraineOrderItem | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [isAddOpen, setAddOpen] = useValueState(false)
  const [isDetailsOpen, setDetailsOpen] = useValueState(false)
  const [isConvertOpen, setConvertOpen] = useValueState(false)
  const [isConverting, setConverting] = useValueState(false)
  const [invoiceTtnFile, setInvoiceTtnFile] = useValueState<File | null>(null)
  const [isMergedOpen, setMergedOpen] = useValueState(false)
  const [isReassignOpen, setReassignOpen] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const netId = initialSale.NetUid

    if (!netId) {
      setLoading(false)

      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load(id: string) {
      try {
        const next = await getSaleById(id)

        if (!cancelled && next) {
          setSale(next)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продаж'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load(netId)

    return () => {
      cancelled = true
    }
  }, [initialSale.NetUid, reloadKey, setError, setLoading, setSale, t])

  const retailSaleId = typeof sale.Id === 'number' && sale.Id > 0 ? sale.Id : null
  const retailClientKey = getEntityKey(sale.RetailClient)
  const retailPaymentKey = retailSaleId && retailClientKey ? `${retailSaleId}:${retailClientKey}:${reloadKey}` : ''
  const isRetailPaymentLoading = Boolean(retailPaymentKey && retailPaymentState.key !== retailPaymentKey)
  const retailPaymentStatus = retailPaymentState.status
  const retailPaymentError = retailPaymentState.error

  useEffect(() => {
    let cancelled = false
    const commit = (nextState: RetailPaymentState) => {
      if (!cancelled) {
        setRetailPaymentState(nextState)
      }
    }

    if (!retailSaleId || !retailClientKey || !retailPaymentKey) {
      commit(EMPTY_RETAIL_PAYMENT_STATE)
      return
    }

    async function loadRetailPaymentStatus(saleId: number) {
      try {
        const next = await getRetailPaymentStatusBySaleId(saleId)

        commit({ error: null, key: retailPaymentKey, status: next })
      } catch (loadError) {
        commit({
          error: loadError instanceof Error ? loadError.message : t('Не вдалося перевірити оплату'),
          key: retailPaymentKey,
          status: null,
        })
      }
    }

    void loadRetailPaymentStatus(retailSaleId)

    return () => {
      cancelled = true
    }
  }, [
    retailClientKey,
    retailPaymentKey,
    retailSaleId,
    setRetailPaymentState,
    t,
  ])

  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const isEditable = !sale.IsLocked
  const useEurToUah = isNonVatEurSale(sale)
  const editorCurrencyCode = getSaleLocalCurrencyCode(sale)
  const headerTotal = useEurToUah
    ? roundMoney(orderItems.reduce((sum, item) => sum + (getNumber(item.TotalAmountEurToUah) ?? 0), 0))
    : getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount) ?? 0
  const itemColumns = useItemColumns({ canEdit: isEditable, onDelete: setDeletingItem, onEditQty: setEditingItem, useEurToUah })
  const reviewIssues = getSaleReviewIssues(sale, { isRetailPaymentLoading, retailPaymentStatus })

  async function confirmDelete() {
    if (!deletingItem?.NetUid) {
      return
    }

    setDeleting(true)

    try {
      await deleteOrderItem(deletingItem.NetUid)
      notifications.show({ color: 'green', message: t('Товар видалено') })
      setDeletingItem(null)
      reload()
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося видалити товар') })
    } finally {
      setDeleting(false)
    }
  }

  async function convertToInvoice() {
    const issues = getSaleReviewIssues(sale, { isRetailPaymentLoading, retailPaymentStatus })

    if (issues.length > 0) {
      notifications.show({ color: 'orange', message: t('Заповніть обов’язкові дані продажу') })

      return
    }

    setConverting(true)

    const payload: SalesUkraineSale = {
      ...sale,
      BaseLifeCycleStatus: { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SaleLifeCycleType: 1 },
      BaseSalePaymentStatus: { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SalePaymentStatusType: 0 },
      IsPrintedPaymentInvoice: true,
    }

    try {
      if (sale.IsVatSale) {
        const document = await convertVatSaleAndGetPaymentDocument(payload, invoiceTtnFile)
        const url = document.pdfUrl || document.excelUrl

        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      } else {
        await updateSaleFromData(payload, invoiceTtnFile)
      }

      notifications.show({ color: 'green', message: t('Рахунок створено') })
      setConvertOpen(false)
      setInvoiceTtnFile(null)
      reload()
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося створити рахунок') })
    } finally {
      setConverting(false)
    }
  }

  async function copySaleData() {
    const header = [
      '#',
      t('Код Виробника'),
      t('Назва товару'),
      t('К-сть'),
      t('Ціна'),
      t('Сума'),
    ].join('\t')

    const rows = orderItems.map((item, index) => {
      return [
        index + 1,
        item.Product?.VendorCode || item.Product?.Articul || '',
        item.Product?.NameUA || item.Product?.Name || '',
        getNumber(item.Qty) ?? '',
        getNumber(item.PricePerItem) ?? '',
        getNumber(item.TotalAmount) ?? getNumber(item.TotalAmountLocal) ?? '',
      ].join('\t')
    })

    try {
      await navigator.clipboard.writeText([header, ...rows].join('\n'))
      notifications.show({ color: 'green', message: t('Дані скопійовано') })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося скопіювати') })
    }
  }

  const canConvert = isEditable && isStatusType(sale.BaseLifeCycleStatus?.SaleLifeCycleType, 0)

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Text fw={700} size="lg">
              {displayValue(getClientName(sale))}
            </Text>
            <Text size="sm" c="dimmed">
              {displayValue(sale.ClientAgreement?.Agreement?.Name)}
            </Text>
            <Text size="xs" c="dimmed">
              {displayValue(sale.ClientAgreement?.Agreement?.Organization?.Name)}
            </Text>
          </Stack>
          <Stack gap={4} align="flex-end">
            <Group gap="xs">
              {sale.IsVatSale && (
                <Badge color="blue" variant="light">
                  {t('ПДВ')}
                </Badge>
              )}
              {sale.IsLocked && (
                <Badge color="red" variant="light">
                  {t('Заблоковано')}
                </Badge>
              )}
              {isLoading && <Loader size="xs" />}
            </Group>
            <Text fw={700} size="lg">
              {amountFormatter.format(headerTotal)} {editorCurrencyCode}
            </Text>
            <Text size="xs" c="dimmed">
              {t('ПДВ')}: {amountFormatter.format(getNumber(sale.Order?.TotalVat) ?? 0)}
            </Text>
          </Stack>
        </Group>
      </Card>

      <Group justify="flex-end" gap="sm">
        {Array.isArray(sale.InputSaleMerges) && sale.InputSaleMerges.length > 0 && (
          <Button leftSection={<IconArrowsJoin size={16} />} variant="light" onClick={() => setMergedOpen(true)}>
            {t("Об'єднання")}
          </Button>
        )}
        <Button
          disabled={orderItems.length === 0}
          leftSection={<IconCopy size={16} />}
          variant="light"
          onClick={copySaleData}
        >
          {t('Копіювати')}
        </Button>
        {isEditable && (
          <Button leftSection={<IconUserShare size={16} />} variant="light" onClick={() => setReassignOpen(true)}>
            {t('Переназначити')}
          </Button>
        )}
        {(sale.Transporter || isEditable) && (
          <Button leftSection={<IconTruck size={16} />} variant="light" onClick={() => setDetailsOpen(true)}>
            {t('Доставка')}
          </Button>
        )}
        {canConvert && (
          <Button color="teal" leftSection={<IconFileInvoice size={16} />} onClick={() => setConvertOpen(true)}>
            {t('Зробити рахунок')}
          </Button>
        )}
      </Group>

      <Tabs defaultValue="products">
        <Tabs.List>
          <Tabs.Tab value="products">
            {t('Товари')} ({orderItems.length})
          </Tabs.Tab>
          <Tabs.Tab value="client">{t('Клієнт')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="products" pt="md">
          {isEditable && (
            <Group justify="flex-end" mb="sm">
              <Button leftSection={<IconPlus size={16} />} variant="light" onClick={() => setAddOpen(true)}>
                {t('Додати товар')}
              </Button>
            </Group>
          )}
          <DataTable
            columns={itemColumns}
            data={orderItems}
            emptyText={t('Товарів не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || index)}
            isLoading={isLoading}
            layoutVersion="sales-ukraine-editor-items-1"
            loadingText={t('Завантаження товарів')}
            maxHeight="calc(100vh - 320px)"
            minWidth={820}
            tableId="sales-ukraine-editor-items"
          />
        </Tabs.Panel>

        <Tabs.Panel value="client" pt="md">
          <ClientTab canEdit={isEditable} sale={sale} onSwitched={reload} />
        </Tabs.Panel>
      </Tabs>

      <AddProductModal
        opened={isAddOpen}
        sale={sale}
        onAdded={() => {
          setAddOpen(false)
          reload()
        }}
        onClose={() => setAddOpen(false)}
      />

      <OrderItemQtyModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={() => {
          setEditingItem(null)
          reload()
        }}
      />

      <SaleDetailsDrawer
        sale={isDetailsOpen ? sale : null}
        onClose={() => setDetailsOpen(false)}
        onSaved={() => {
          setDetailsOpen(false)
          reload()
        }}
      />

      <MergedSalesDrawer
        saleNetId={isMergedOpen ? sale.NetUid ?? null : null}
        onChanged={reload}
        onClose={() => setMergedOpen(false)}
      />

      <ReassignSaleModal
        opened={isReassignOpen}
        sale={sale}
        onClose={() => setReassignOpen(false)}
        onReassigned={() => {
          setReassignOpen(false)
          reload()
        }}
      />

      <AppModal
        centered
        opened={isConvertOpen}
        size="sm"
        title={t('Зробити рахунок')}
        onClose={() => {
          if (isConverting) {
            return
          }

          setConvertOpen(false)
          setInvoiceTtnFile(null)
        }}
      >
        <Stack gap="md">
          <Text>{t('Перетворити продаж на рахунок?')}</Text>
          {reviewIssues.length > 0 && (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />} variant="light">
              <Stack gap={4}>
                {reviewIssues.map((issue) => (
                  <Text key={issue} size="sm">
                    {getReviewIssueLabel(issue, t)}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}
          {isRetailPaymentLoading && (
            <Text c="dimmed" size="sm">
              {t('Перевіряємо оплату інтернет-магазину')}
            </Text>
          )}
          {retailPaymentError && (
            <Text c="red" size="sm">
              {retailPaymentError}
            </Text>
          )}
          {sale.CustomersOwnTtn && (
            <FileInput
              clearable
              disabled={isConverting}
              label={t('Завантажити ТТН')}
              placeholder={t('Оберіть файл')}
              value={invoiceTtnFile}
              onChange={setInvoiceTtnFile}
            />
          )}
          <Group justify="flex-end">
            <Button
              color="gray"
              disabled={isConverting}
              variant="subtle"
              onClick={() => {
                setConvertOpen(false)
                setInvoiceTtnFile(null)
              }}
            >
              {t('Скасувати')}
            </Button>
            <Button color="teal" disabled={reviewIssues.length > 0} loading={isConverting} onClick={convertToInvoice}>
              {t('Зробити рахунок')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal
        centered
        opened={Boolean(deletingItem)}
        size="sm"
        title={t('Видалити товар')}
        onClose={() => (isDeleting ? undefined : setDeletingItem(null))}
      >
        {deletingItem && (
          <Stack gap="md">
            <Text>
              {t('Видалити товар')} «{displayValue(deletingItem.Product?.NameUA || deletingItem.Product?.Name)}»?
            </Text>
            <Group justify="flex-end">
              <Button color="gray" disabled={isDeleting} variant="subtle" onClick={() => setDeletingItem(null)}>
                {t('Скасувати')}
              </Button>
              <Button color="red" loading={isDeleting} onClick={confirmDelete}>
                {t('Видалити')}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </Stack>
  )
}

function getReviewIssueLabel(issue: SaleReviewIssueCode, t: (message: string) => string): string {
  switch (issue) {
    case 'transporter':
      return t('Оберіть перевізника')
    case 'recipient':
      return t('Оберіть отримувача товару')
    case 'recipientPhone':
      return t('Вкажіть мобільний телефон отримувача')
    case 'cashOnDeliveryAmount':
      return t('Вкажіть суму накладеного платежу')
    case 'ownTtnNumber':
      return t('Вкажіть номер власної ТТН')
    case 'retailPaymentStatus':
      return t('Не вдалося перевірити оплату інтернет-магазину')
    case 'retailPaymentAmount':
      return t('Продаж інтернет-магазину не оплачений')
    default:
      return t('Заповніть обов’язкові дані продажу')
  }
}

function getEntityKey(entity: { Id?: number; NetUid?: string } | null | undefined): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function useItemColumns({
  canEdit,
  onDelete,
  onEditQty,
  useEurToUah,
}: {
  canEdit: boolean
  onDelete: (item: SalesUkraineOrderItem) => void
  onEditQty: (item: SalesUkraineOrderItem) => void
  useEurToUah: boolean
}): DataTableColumn<SalesUkraineOrderItem>[] {
  const { t } = useI18n()

  return [
    {
      id: 'vendorCode',
      header: t('Код Виробника'),
      width: 140,
      accessor: (item) => item.Product?.VendorCode || item.Product?.Articul,
      cell: (item) => displayValue(item.Product?.VendorCode || item.Product?.Articul),
    },
    {
      id: 'name',
      header: t('Назва товару'),
      minWidth: 260,
      accessor: (item) => item.Product?.NameUA || item.Product?.Name,
      cell: (item) => displayValue(item.Product?.NameUA || item.Product?.Name),
    },
    {
      id: 'qty',
      header: t('К-сть'),
      width: 100,
      align: 'right',
      accessor: (item) => getNumber(item.Qty),
      cell: (item) => displayValue(getNumber(item.Qty)),
    },
    {
      id: 'price',
      header: t('Ціна'),
      width: 120,
      align: 'right',
      accessor: (item) => getNumber(item.PricePerItem),
      cell: (item) => formatAmount(getNumber(item.PricePerItem)),
    },
    {
      id: 'baseDiscount',
      header: t('Базова знижка'),
      width: 132,
      align: 'right',
      accessor: (item) => getVisibleOrderItemBaseDiscount(item),
      cell: (item) => formatPercent(getVisibleOrderItemBaseDiscount(item)),
    },
    {
      id: 'discount',
      header: t('Разова знижка'),
      width: 132,
      align: 'right',
      accessor: (item) => getNumber(item.OneTimeDiscount),
      cell: (item) => formatPercent(getNumber(item.OneTimeDiscount)),
    },
    {
      id: 'total',
      header: t('Сума'),
      width: 130,
      align: 'right',
      accessor: (item) => (useEurToUah ? getNumber(item.TotalAmountEurToUah) : getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)),
      cell: (item) => formatAmount(useEurToUah ? getNumber(item.TotalAmountEurToUah) : getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)),
    },
    {
      id: 'actions',
      header: '',
      width: 92,
      minWidth: 92,
      maxWidth: 92,
      align: 'center',
      enableHiding: false,
      enableReorder: false,
      enableResizing: false,
      enableSorting: false,
      cell: (item) =>
        canEdit ? (
          <Group gap={2} justify="center" wrap="nowrap">
            <Tooltip label={t('Змінити кількість')}>
              <ActionIcon aria-label={t('Змінити кількість')} color="gray" variant="subtle" onClick={() => onEditQty(item)}>
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" onClick={() => onDelete(item)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ]
}

function OrderItemQtyModal({
  item,
  onClose,
  onSaved,
}: {
  item: SalesUkraineOrderItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(item)} size="sm" title={t('Змінити кількість')} onClose={onClose}>
      {item && <OrderItemQtyForm key={item.NetUid || item.Id} item={item} onCancel={onClose} onSaved={onSaved} />}
    </AppModal>
  )
}

function OrderItemQtyForm({
  item,
  onCancel,
  onSaved,
}: {
  item: SalesUkraineOrderItem
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const [qty, setQty] = useState<number | string>(getNumber(item.Qty) ?? '')
  const [isSaving, setSaving] = useState(false)
  const numericQty = typeof qty === 'number' ? qty : Number(String(qty).replace(',', '.'))
  const isValid = Number.isFinite(numericQty) && numericQty > 0

  async function save() {
    if (!isValid) {
      notifications.show({ color: 'red', message: t('Вкажіть коректну кількість') })

      return
    }

    setSaving(true)

    try {
      await updateOrderItem({ ...item, Qty: numericQty })
      notifications.show({ color: 'green', message: t('Кількість оновлено') })
      onSaved()
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося оновити кількість') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>
        {displayValue(item.Product?.NameUA || item.Product?.Name)}
      </Text>
      <NumberInput
        allowNegative={false}
        decimalScale={2}
        label={t('Кількість')}
        min={0}
        value={qty}
        onChange={setQty}
      />
      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!isValid} loading={isSaving} onClick={save}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}

function AddProductModal({
  opened,
  sale,
  onClose,
  onAdded,
}: {
  onAdded: () => void
  onClose: () => void
  opened: boolean
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size="lg" title={t('Додати товар')} onClose={onClose}>
      {opened && <AddProductForm sale={sale} onAdded={onAdded} onCancel={onClose} />}
    </AppModal>
  )
}

function AddProductForm({ sale, onCancel, onAdded }: { onAdded: () => void; onCancel: () => void; sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SalesUkraineProduct[]>([])
  const [isSearching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SalesUkraineProduct | null>(null)
  const [qty, setQty] = useState<number | string>(1)
  const [isSaving, setSaving] = useState(false)

  const numericQty = typeof qty === 'number' ? qty : Number(String(qty).replace(',', '.'))
  const isValid = Boolean(selected) && Number.isFinite(numericQty) && numericQty > 0

  useEffect(() => {
    const value = query.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      setSearching(true)

      try {
        const next = await searchSaleProducts(value)

        if (!cancelled) {
          setResults(next)
        }
      } catch {
        if (!cancelled) {
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setSearching(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  async function add() {
    const agreementNetUid = sale.ClientAgreement?.NetUid
    const saleNetUid = sale.NetUid

    if (!isValid || !selected || !agreementNetUid || !saleNetUid) {
      return
    }

    setSaving(true)

    const existing = (Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []).find(
      (item) => item.Product?.NetUid === selected.NetUid,
    )

    try {
      if (existing) {
        await updateOrderItem({ ...existing, Qty: (getNumber(existing.Qty) || 0) + numericQty })
      } else {
        await addOrderItem(agreementNetUid, saleNetUid, {
          Deleted: false,
          Id: 0,
          NetUid: EMPTY_GUID,
          Product: selected,
          Qty: numericQty,
        })
      }

      notifications.show({ color: 'green', message: t('Товар додано') })
      onAdded()
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося додати товар') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <TextInput
        autoFocus
        label={t('Пошук по товару')}
        leftSection={<IconSearch size={16} />}
        placeholder={t('Код Виробника')}
        rightSection={isSearching ? <Loader size="xs" /> : null}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <ScrollArea.Autosize mah={320}>
        <Stack gap={4}>
          {results.length === 0 ? (
            <Text c="dimmed" size="sm">
              {query.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
            </Text>
          ) : (
            results.map((product, index) => {
              const isActive = selected?.NetUid === product.NetUid

              return (
                <UnstyledButton
                  key={product.NetUid || product.Id || index}
                  p="xs"
                  style={{
                    backgroundColor: isActive ? 'var(--mantine-color-violet-light)' : undefined,
                    borderRadius: 6,
                  }}
                  onClick={() => setSelected(product)}
                >
                  <Text fw={600} size="sm">
                    {displayValue(product.VendorCode || product.Articul)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {displayValue(product.NameUA || product.Name)}
                  </Text>
                </UnstyledButton>
              )
            })
          )}
        </Stack>
      </ScrollArea.Autosize>

      <NumberInput
        allowNegative={false}
        decimalScale={2}
        disabled={!selected}
        label={t('Кількість')}
        min={0}
        value={qty}
        onChange={setQty}
      />

      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!isValid} loading={isSaving} onClick={add}>
          {t('Додати')}
        </Button>
      </Group>
    </Stack>
  )
}

function ReassignSaleModal({
  opened,
  sale,
  onClose,
  onReassigned,
}: {
  onClose: () => void
  onReassigned: () => void
  opened: boolean
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size="md" title={t('Переназначити')} onClose={onClose}>
      {opened && <ReassignSaleForm sale={sale} onCancel={onClose} onReassigned={onReassigned} />}
    </AppModal>
  )
}

function ReassignSaleForm({
  sale,
  onCancel,
  onReassigned,
}: {
  onCancel: () => void
  onReassigned: () => void
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<SalesUkraineClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [agreements, setAgreements] = useState<SalesUkraineClientAgreement[]>([])
  const [selectedAgreement, setSelectedAgreement] = useState<string | null>(null)
  const [isReassigning, setReassigning] = useState(false)

  useEffect(() => {
    const value = query.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const next = await searchSalesUkraineClients(value, controller.signal)

        if (!cancelled) {
          setClients(next)
        }
      } catch {
        if (!cancelled) {
          setClients([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(handle)
    }
  }, [query])

  useEffect(() => {
    const clientNetUid = clients.find((client) => String(client.NetUid ?? client.Id ?? '') === selectedClient)?.NetUid
    let cancelled = false

    async function load(id: string | null) {
      if (!id) {
        if (!cancelled) {
          setAgreements([])
          setSelectedAgreement(null)
        }

        return
      }

      try {
        const next = await getSaleClientAgreements(id)

        if (!cancelled) {
          setAgreements(next)
        }
      } catch {
        if (!cancelled) {
          setAgreements([])
        }
      }
    }

    void load(selectedClient ? clientNetUid ?? null : null)

    return () => {
      cancelled = true
    }
  }, [clients, selectedClient])

  const clientOptions = clients.map((client) => ({
    label: getClientOptionName(client),
    value: String(client.NetUid ?? client.Id ?? ''),
  }))

  const agreementOptions = agreements.reduce<{ label: string; value: string }[]>((acc, item) => {
    if (item.NetUid) {
      acc.push({ label: item.Agreement?.Name || item.NetUid || '', value: item.NetUid || '' })
    }

    return acc
  }, [])

  async function reassign() {
    if (!sale.NetUid || !selectedAgreement) {
      return
    }

    setReassigning(true)

    try {
      await switchSale(sale.NetUid, selectedAgreement)
      notifications.show({ color: 'green', message: t('Продаж переназначено') })
      onReassigned()
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося переназначити продаж') })
    } finally {
      setReassigning(false)
    }
  }

  return (
    <Stack gap="md">
      <Select
        searchable
        clearable
        data={clientOptions}
        label={t('Клієнт')}
        nothingFoundMessage={query.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
        placeholder={t('Пошук клієнта')}
        searchValue={query}
        value={selectedClient}
        onChange={setSelectedClient}
        onSearchChange={setQuery}
      />
      <Select
        searchable
        data={agreementOptions}
        disabled={!selectedClient}
        label={t('Договір')}
        placeholder={t('Оберіть договір')}
        value={selectedAgreement}
        onChange={setSelectedAgreement}
      />
      <Group justify="flex-end">
        <Button color="gray" disabled={isReassigning} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!selectedAgreement} loading={isReassigning} onClick={reassign}>
          {t('Переназначити')}
        </Button>
      </Group>
    </Stack>
  )
}

function getClientOptionName(client: SalesUkraineClientOption): string {
  return (
    client.FullName?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.Name?.trim()
    || client.NetUid
    || ''
  )
}

function ClientTab({ canEdit, sale, onSwitched }: { canEdit: boolean; onSwitched: () => void; sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const clientNetUid = sale.ClientAgreement?.Client?.NetUid
  const currentAgreementNetUid = sale.ClientAgreement?.NetUid || ''
  const [agreements, setAgreements] = useValueState<SalesUkraineClientAgreement[]>([])
  const [debt, setDebt] = useValueState<SaleClientDebtTotal | null>(null)
  const [selectedAgreement, setSelectedAgreement] = useValueState(currentAgreementNetUid)
  const [isSwitching, setSwitching] = useValueState(false)

  useEffect(() => {
    if (!clientNetUid) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const [nextAgreements, nextDebt] = await Promise.all([getSaleClientAgreements(id), getSaleClientDebtTotal(id)])

        if (!cancelled) {
          setAgreements(nextAgreements)
          setDebt(nextDebt)
        }
      } catch {
        if (!cancelled) {
          setAgreements([])
          setDebt(null)
        }
      }
    }

    void load(clientNetUid)

    return () => {
      cancelled = true
    }
  }, [clientNetUid, setAgreements, setDebt])

  const agreementOptions = agreements.reduce<{ label: string; value: string }[]>((acc, item) => {
    if (item.NetUid) {
      acc.push({ label: item.Agreement?.Name || item.NetUid || '', value: item.NetUid || '' })
    }

    return acc
  }, [])

  async function switchAgreement() {
    if (!sale.NetUid || !selectedAgreement || selectedAgreement === currentAgreementNetUid) {
      return
    }

    setSwitching(true)

    try {
      await switchSale(sale.NetUid, selectedAgreement)
      notifications.show({ color: 'green', message: t('Договір змінено') })
      onSwitched()
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося змінити договір') })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <DetailRow label={t('Клієнт')} value={getClientName(sale)} />
        <DetailRow label={t('Організація')} value={sale.ClientAgreement?.Agreement?.Organization?.Name} />
        <DetailRow label={t('Валюта')} value={sale.ClientAgreement?.Agreement?.Currency?.Code} />
        <DetailRow label={t('Менеджер')} value={getUserName(sale)} />
        <DetailRow label={t('Перевізник')} value={sale.Transporter?.Name || sale.Transporter?.Title} />
        <DetailRow label={t('Коментар')} value={sale.Comment} />
        {debt && (
          <>
            <DetailRow label={t('Борг (локальна)')} value={formatAmount(getNumber(debt.TotalLocal))} />
            <DetailRow label={t('Борг (EUR)')} value={formatAmount(getNumber(debt.TotalEuro))} />
          </>
        )}
      </Stack>

      <Group align="end" gap="sm" wrap="nowrap">
        <Select
          disabled={!canEdit}
          searchable
          data={agreementOptions}
          label={t('Договір')}
          style={{ flex: 1 }}
          value={selectedAgreement || null}
          onChange={(value) => setSelectedAgreement(value || '')}
        />
        <Button
          disabled={!canEdit || !selectedAgreement || selectedAgreement === currentAgreementNetUid}
          loading={isSwitching}
          variant="light"
          onClick={switchAgreement}
        >
          {t('Змінити договір')}
        </Button>
      </Group>
    </Stack>
  )
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <Group justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {displayValue(value)}
      </Text>
    </Group>
  )
}

function getClientName(sale: SalesUkraineSale): string {
  const client = sale.ClientAgreement?.Client

  return (
    client?.FullName?.trim()
    || [client?.LastName, client?.FirstName, client?.MiddleName].filter(Boolean).join(' ').trim()
    || ''
  )
}

function getUserName(sale: SalesUkraineSale): string {
  const user = sale.UpdateUser || sale.User

  return user?.FullName?.trim() || [user?.LastName, user?.FirstName].filter(Boolean).join(' ').trim() || ''
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : '—'
}

function formatPercent(value: number | null): string {
  return typeof value === 'number' ? `${amountFormatter.format(value)} %` : '—'
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
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
