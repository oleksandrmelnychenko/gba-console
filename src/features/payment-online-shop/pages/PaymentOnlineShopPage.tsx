import {
  ActionIcon,
  Alert,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconReceipt, IconRefresh, IconRestore, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import { addPaymentImage, editPaymentImage, getPaymentShopItems } from '../api/paymentOnlineShopApi'
import { PaymentImageEditModal } from '../components/PaymentImageEditModal'
import { PaymentShopDetailDrawer } from '../components/PaymentShopDetailDrawer'
import { RetailPaymentStatusType } from '../types'
import type {
  AddPaymentImagePayload,
  PaymentShopFilters,
  PaymentShopItem,
  RetailClientPaymentImageItem,
} from '../types'

const EMPTY_FILTERS: PaymentShopFilters = {
  saleDateFrom: '',
  saleDateTo: '',
  saleNumber: '',
  phoneNumber: '',
}

const PAYMENT_SHOP_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['create', 'saleCreate', 'saleNumber'],
    right: ['incomeCashOrder', 'view'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
const priceFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function usePaymentOnlineShopModel() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filterDraft, setFilterDraft] = useValueState<PaymentShopFilters>(EMPTY_FILTERS)
  const [activeFilters, setActiveFilters] = useValueState<PaymentShopFilters>(EMPTY_FILTERS)
  const [items, setItems] = useValueState<PaymentShopItem[]>([])
  const [selectedItem, setSelectedItem] = useValueState<PaymentShopItem | null>(null)
  const [editItem, setEditItem] = useValueState<RetailClientPaymentImageItem | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [createError, setCreateError] = useValueState<string | null>(null)
  const [editError, setEditError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isCreating, setCreating] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('payment-online-shop', PAYMENT_SHOP_TABLE_DEFAULT_LAYOUT.density)

  usePaymentShopLoader({ activeFilters, reloadKey, setError, setItems, setLoading })

  const openDetail = useCallback(
    (item: PaymentShopItem) => {
      setCreateError(null)
      setSelectedItem(item)
    },
    [setCreateError, setSelectedItem],
  )

  const closeDetail = useCallback(() => {
    setSelectedItem(null)
    setCreateError(null)
    reload()
  }, [setCreateError, setSelectedItem])

  const createIncomeOrder = useCallback(
    (item: PaymentShopItem) => {
      const path = buildIncomeOrderPath(item)

      if (path) {
        navigate(path)
      }
    },
    [navigate],
  )

  function applyFilters() {
    setActiveFilters(filterDraft)
  }

  function resetFilters() {
    setFilterDraft(EMPTY_FILTERS)
    setActiveFilters(EMPTY_FILTERS)
  }

  async function handleAddPayment(payload: Omit<AddPaymentImagePayload, 'paymentImageId' | 'user'>) {
    if (!selectedItem?.Id) {
      return
    }

    setCreateError(null)
    setCreating(true)

    try {
      await addPaymentImage({
        ...payload,
        paymentImageId: selectedItem.Id,
        user: user,
      })
      setSelectedItem(null)
      reload()
      notifications.show({ color: 'green', message: t('Платіж створено') })
    } catch (addError) {
      setCreateError(addError instanceof Error ? addError.message : t('Сталася помилка, заповніть поля!'))
    } finally {
      setCreating(false)
    }
  }

  async function handleEditPayment(amount: number, comment: string) {
    if (!editItem || !selectedItem?.Id) {
      return
    }

    setEditError(null)
    setSaving(true)

    try {
      const updatedItem = await editPaymentImage({
        amount,
        comment,
        item: editItem,
        paymentImageId: selectedItem.Id,
        user: user,
      })
      const fallbackItem = updatePaymentImageItem(selectedItem, editItem, amount, comment, user)
      const nextSelectedItem = updatedItem?.RetailClientPaymentImageItems ? updatedItem : fallbackItem

      setSelectedItem(nextSelectedItem)
      setItems((current) => replacePaymentShopItem(current, nextSelectedItem))
      setEditItem(null)
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  const columns = usePaymentShopColumns(openDetail, createIncomeOrder)

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Завантажених')} {items.length}
      </Text>
    ),
    [items.length, t],
  )

  return {
    activeFilters, applyFilters, closeDetail, columns, createError, density, editError, editItem, error, filterDraft,
    handleAddPayment, handleEditPayment, isCreating, isLoading, isSaving, items, openDetail, reload, resetFilters,
    selectedItem, setEditItem, setFilterDraft, toggleDensity, toolbarLeft,
  }
}

function usePaymentShopLoader({
  activeFilters,
  reloadKey,
  setError,
  setItems,
  setLoading,
}: {
  activeFilters: PaymentShopFilters
  reloadKey: number
  setError: (value: string | null) => void
  setItems: (value: PaymentShopItem[]) => void
  setLoading: (value: boolean) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadItems() {
      setLoading(true)
      setError(null)

      try {
        const nextItems = await getPaymentShopItems(activeFilters)

        if (!cancelled) {
          setItems(nextItems)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [activeFilters, reloadKey, setError, setItems, setLoading, t])
}

export function PaymentOnlineShopPage() {
  const model = usePaymentOnlineShopModel()

  return (
    <Stack gap="lg">
      <PaymentShopTableCard model={model} />
      <PaymentShopDetailDrawer
        createError={model.createError}
        isCreating={model.isCreating}
        item={model.selectedItem}
        onAddPayment={model.handleAddPayment}
        onClose={model.closeDetail}
        onEditItem={model.setEditItem}
      />
      <PaymentImageEditModal
        editError={model.editError}
        isSaving={model.isSaving}
        item={model.editItem}
        onClose={() => model.setEditItem(null)}
        onConfirm={model.handleEditPayment}
      />
    </Stack>
  )
}

function PaymentShopTableCard({ model }: { model: ReturnType<typeof usePaymentOnlineShopModel> }) {
  const { t } = useI18n()
  const {
    applyFilters, columns, density, error, filterDraft, isLoading, items, openDetail, reload, resetFilters, setFilterDraft, toggleDensity, toolbarLeft,
  } = model

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('Продажа')}
            placeholder={t('Номер')}
            value={filterDraft.saleNumber}
            onChange={(event) => setFilterDraft({ ...filterDraft, saleNumber: event.currentTarget.value })}
            style={{ flex: '1 1 auto', minWidth: 180 }}
          />
          <TextInput
            label={t('Від якої дати')}
            max={filterDraft.saleDateTo || undefined}
            type="date"
            value={filterDraft.saleDateFrom}
            onChange={(event) => setFilterDraft({ ...filterDraft, saleDateFrom: event.currentTarget.value })}
          />
          <TextInput
            label={t('До якої дати')}
            min={filterDraft.saleDateFrom || undefined}
            type="date"
            value={filterDraft.saleDateTo}
            onChange={(event) => setFilterDraft({ ...filterDraft, saleDateTo: event.currentTarget.value })}
          />
          <TextInput
            label={t('Клієнт')}
            placeholder={t('Телефон')}
            value={filterDraft.phoneNumber}
            onChange={(event) => setFilterDraft({ ...filterDraft, phoneNumber: event.currentTarget.value })}
          />
          <Tooltip label={t('Пошук')}>
            <ActionIcon aria-label={t('Пошук')} color="violet" size={36} variant="light" onClick={applyFilters}>
              <IconSearch size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={36}
              variant="light"
              onClick={() => reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={items}
          defaultLayout={PAYMENT_SHOP_TABLE_DEFAULT_LAYOUT}
          density={density}
          emptyText={t('Оплата магазину')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          isLoading={isLoading}
          layoutVersion="payment-online-shop-table-1"
          loadingText={t('Завантаження')}
          maxHeight="calc(100vh - 320px)"
          minWidth={1620}
          tableId="payment-online-shop"
          toolbarLeft={toolbarLeft}
          onRowClick={openDetail}
        />
      </Stack>
    </Card>
  )
}

function usePaymentShopColumns(onOpenDetail: (item: PaymentShopItem) => void, onCreateIncomeOrder: (item: PaymentShopItem) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<PaymentShopItem>[]>(
    () => [
      {
        id: 'create',
        header: t('Створення оплати'),
        width: 168,
        minWidth: 148,
        accessor: (item) => getDateTime(item.Created),
        cell: (item) => <Text fw={600}>{formatDateTime(item.Created)}</Text>,
      },
      {
        id: 'saleCreate',
        header: t('Створення продажі'),
        width: 168,
        minWidth: 148,
        accessor: (item) => getDateTime(item.Sale?.Created),
        cell: (item) => <Text fw={600}>{formatDateTime(item.Sale?.Created)}</Text>,
      },
      {
        id: 'saleNumber',
        header: t('Номер'),
        width: 160,
        minWidth: 120,
        accessor: (item) => item.Sale?.SaleNumber?.Value,
        cell: (item) => displayValue(item.Sale?.SaleNumber?.Value),
      },
      {
        id: 'agreement',
        header: t('Договір'),
        minWidth: 220,
        accessor: (item) => formatAgreement(item),
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(formatAgreement(item))}
          </Text>
        ),
      },
      {
        id: 'retailClient',
        header: t('Роздрібний клієнт'),
        width: 300,
        minWidth: 220,
        accessor: (item) => item.RetailClient?.Name,
        cell: (item) => (
          <Text size="sm">
            {item.RetailClient?.Name || ''}
            {item.RetailClient?.PhoneNumber ? ` (${item.RetailClient.PhoneNumber})` : ''}
          </Text>
        ),
      },
      {
        id: 'amountSale',
        header: t('Сума продажу'),
        width: 160,
        minWidth: 130,
        accessor: (item) => item.Sale?.Order?.TotalAmountLocal,
        cell: (item) => (
          <Text size="sm">
            {displayValue(item.Sale?.Order?.TotalAmountLocal)} ({(item.Sale?.Order?.OrderItems || []).length}шт)
          </Text>
        ),
      },
      {
        id: 'paymentType',
        header: '',
        width: 56,
        minWidth: 48,
        align: 'center',
        enableSorting: false,
        accessor: (item) => Boolean(item.Sale?.IsFullPayment),
        cell: (item) => (
          <Tooltip label={item.Sale?.IsFullPayment ? t('Повна оплата') : t('Часткова оплата')} position="left">
            <Text fw={700} size="sm">
              {item.Sale?.IsFullPayment ? 'ПО' : 'ЧО'}
            </Text>
          </Tooltip>
        ),
      },
      {
        id: 'paid',
        header: t('Оплачено'),
        width: 160,
        minWidth: 130,
        accessor: (item) => sumImageAmounts(item),
        cell: (item) => (
          <Text size="sm">
            {formatPrice(sumImageAmounts(item))} ({t('UAH')})
          </Text>
        ),
      },
      {
        id: 'paidAmount',
        header: t('Оплата (Бухгалтерія)'),
        width: 168,
        minWidth: 130,
        accessor: (item) => item.RetailPaymentStatus?.PaidAmount,
        cell: (item) => (
          <Text size="sm">
            {formatPrice(item.RetailPaymentStatus?.PaidAmount)} ({t('UAH')})
          </Text>
        ),
      },
      {
        id: 'incomeCashOrder',
        header: '',
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (item) =>
          canCreateIncomeOrder(item) ? (
            <Tooltip label={t('Новий прибутковий ордер')} position="left">
              <ActionIcon
                aria-label={t('Новий прибутковий ордер')}
                color="green"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onCreateIncomeOrder(item)
                }}
              >
                <IconReceipt size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null,
      },
      {
        id: 'view',
        header: '',
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (item) => (
          <ActionIcon
            aria-label={t('Деталі')}
            color="gray"
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation()
              onOpenDetail(item)
            }}
          >
            <IconSearch size={16} />
          </ActionIcon>
        ),
      },
    ],
    [onCreateIncomeOrder, onOpenDetail, t],
  )
}

function canCreateIncomeOrder(item: PaymentShopItem): boolean {
  const statusType = item.RetailPaymentStatus?.RetailPaymentStatusType
  const hasRouteParams = Boolean((item.RetailClient?.NetUid || item.RetailClientId) && (item.SaleId || item.Sale?.Id) && item.Sale?.ClientAgreementId)

  return hasRouteParams && (statusType === RetailPaymentStatusType.ChangedToInvoice || statusType === RetailPaymentStatusType.PartialPaid)
}

function buildIncomeOrderPath(item: PaymentShopItem): string {
  const retailClientId = item.RetailClient?.NetUid || item.RetailClientId || ''
  const saleId = item.SaleId || item.Sale?.Id || ''
  const amountToPay = item.RetailPaymentStatus?.AmountToPay || 0
  const clientAgreementId = item.Sale?.ClientAgreementId || ''
  const params = new URLSearchParams({
    caId: String(clientAgreementId),
    retailClientId: String(retailClientId),
    saleId: String(saleId),
    sum: String(amountToPay > 0 ? amountToPay : 0),
  })

  return `/accounting/income-cashflows/new/shop?${params.toString()}`
}

function formatAgreement(item: PaymentShopItem): string {
  const agreement = item.Sale?.ClientAgreement?.Agreement

  if (!agreement) {
    return ''
  }

  return [agreement.Name, agreement.Currency?.Code, agreement.Organization?.Name].filter(Boolean).join(' ')
}

function sumImageAmounts(item: PaymentShopItem): number {
  return (item.RetailClientPaymentImageItems || []).reduce((sum, image) => sum + (image.Amount || 0), 0)
}

function replacePaymentShopItem(items: PaymentShopItem[], nextItem: PaymentShopItem): PaymentShopItem[] {
  return items.map((item) => (isSamePaymentShopItem(item, nextItem) ? nextItem : item))
}

function updatePaymentImageItem(
  item: PaymentShopItem,
  imageItem: RetailClientPaymentImageItem,
  amount: number,
  comment: string,
  user: RetailClientPaymentImageItem['User'],
): PaymentShopItem {
  return {
    ...item,
    RetailClientPaymentImageItems: (item.RetailClientPaymentImageItems || []).map((candidate) =>
      isSamePaymentImageItem(candidate, imageItem)
        ? {
            ...candidate,
            Amount: amount,
            Comment: comment,
            User: user,
          }
        : candidate,
    ),
  }
}

function isSamePaymentShopItem(first: PaymentShopItem, second: PaymentShopItem): boolean {
  return Boolean((first.NetUid && first.NetUid === second.NetUid) || (first.Id && first.Id === second.Id))
}

function isSamePaymentImageItem(first: RetailClientPaymentImageItem, second: RetailClientPaymentImageItem): boolean {
  return Boolean(
    (first.NetUid && first.NetUid === second.NetUid) ||
      (first.Id && first.Id === second.Id) ||
      (first.ImgUrl && first.ImgUrl === second.ImgUrl) ||
      (first.RetailClientPaymentImageId && first.RetailClientPaymentImageId === second.RetailClientPaymentImageId),
  )
}

function formatPrice(value: number | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0.00'
  }

  return priceFormatter.format(value)
}

function getDateTime(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }

  if (typeof value !== 'string' || !value) {
    return 0
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
