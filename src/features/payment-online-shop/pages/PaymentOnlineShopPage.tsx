import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, RotateCcw, Search } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { useAuth } from '../../auth/useAuth'
import {
  addPaymentImage,
  editPaymentImage,
  getPaymentShopItemForRefresh,
  getPaymentShopItemsPage,
} from '../api/paymentOnlineShopApi'
import { PaymentImageEditModal } from '../components/PaymentImageEditModal'
import { PaymentShopDetailDrawer } from '../components/PaymentShopDetailDrawer'
import {
  classifyRetailPaymentImageMutationFailure,
  createAddPaymentImageMutationPayload,
  ensurePaymentImageReplayFileMatches,
  getRetailPaymentImageConcurrencyCode,
  isDefinitiveRetailPaymentImageConcurrencyConflict,
  RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT,
} from '../paymentImageMutation'
import { RetailPaymentStatusType } from '../types'
import { getRetailPaymentStatusPresentation } from '../retailPaymentStatus'
import type {
  AddPaymentImagePayload,
  PaymentShopFilters,
  PaymentShopItem,
  PaymentTypeValue,
  RetailClientPaymentImageItem,
} from '../types'
import {
  SalesPendingMutationRecoveredError,
  usePersistentSalesMutation,
} from '../../sales-ukraine/persistentSalesMutation'
import './payment-online-shop-page.css'

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
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [totalRowsQty, setTotalRowsQty] = useValueState(0)
  const [selectedItem, setSelectedItem] = useValueState<PaymentShopItem | null>(null)
  const [editItem, setEditItem] = useValueState<RetailClientPaymentImageItem | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [createError, setCreateError] = useValueState<string | null>(null)
  const [createNotice, setCreateNotice] = useValueState<string | null>(null)
  const [editError, setEditError] = useValueState<string | null>(null)
  const [editNotice, setEditNotice] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isCreating, setCreating] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [isRefreshingEdit, setRefreshingEdit] = useValueState(false)
  const isEditOpenRef = useRef(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const runAddPaymentMutation = usePersistentSalesMutation(
    'retail-payment-image-add',
    'payment-online-shop:add',
    classifyRetailPaymentImageMutationFailure,
  )
  const runEditPaymentMutation = usePersistentSalesMutation(
    'retail-payment-image-update',
    'payment-online-shop:update',
    classifyRetailPaymentImageMutationFailure,
  )

  usePaymentShopLoader({ activeFilters, page, pageSize, reloadKey, setError, setItems, setLoading, setTotalRowsQty })

  const [debouncedSaleNumber] = useDebouncedValue(filterDraft.saleNumber, 400)
  const [debouncedPhoneNumber] = useDebouncedValue(filterDraft.phoneNumber, 400)

  useEffect(() => {
    if (debouncedSaleNumber !== filterDraft.saleNumber || debouncedPhoneNumber !== filterDraft.phoneNumber) {
      return
    }

    if (debouncedSaleNumber === activeFilters.saleNumber && debouncedPhoneNumber === activeFilters.phoneNumber) {
      return
    }

    setPage(1)
    setActiveFilters((current) => ({ ...current, phoneNumber: debouncedPhoneNumber, saleNumber: debouncedSaleNumber }))
  }, [
    activeFilters.phoneNumber,
    activeFilters.saleNumber,
    debouncedPhoneNumber,
    debouncedSaleNumber,
    filterDraft.phoneNumber,
    filterDraft.saleNumber,
    setActiveFilters,
    setPage,
  ])

  const openDetail = useCallback(
    (item: PaymentShopItem) => {
      setCreateError(null)
      setCreateNotice(null)
      setSelectedItem(item)
    },
    [setCreateError, setCreateNotice, setSelectedItem],
  )

  const closeDetail = useCallback(() => {
    setSelectedItem(null)
    setCreateError(null)
    setCreateNotice(null)
    reload()
  }, [setCreateError, setCreateNotice, setSelectedItem])

  const createIncomeOrder = useCallback(
    (item: PaymentShopItem) => {
      const path = buildIncomeOrderPath(item)

      if (path) {
        navigate(path)
      }
    },
    [navigate],
  )

  const openEditItem = useCallback(
    (item: RetailClientPaymentImageItem) => {
      isEditOpenRef.current = true
      setEditError(null)
      setEditNotice(null)
      setEditItem(item)
    },
    [setEditError, setEditItem, setEditNotice],
  )

  const closeEditItem = useCallback(() => {
    isEditOpenRef.current = false
    setRefreshingEdit(false)
    setEditError(null)
    setEditNotice(null)
    setEditItem(null)
  }, [setEditError, setEditItem, setEditNotice, setRefreshingEdit])

  function applyFilters() {
    setPage(1)
    setActiveFilters(filterDraft)
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(EMPTY_FILTERS)
    setActiveFilters(EMPTY_FILTERS)
  }

  async function handleAddPayment(
    payload: Omit<AddPaymentImagePayload, 'paymentImageId' | 'user'>,
  ): Promise<boolean> {
    if (!selectedItem?.Id) {
      return false
    }

    setCreateError(null)
    setCreateNotice(null)
    setCreating(true)

    try {
      const requestPayload: AddPaymentImagePayload = {
        ...payload,
        paymentImageId: selectedItem.Id,
        user: user,
      }
      const mutationPayload =
        await createAddPaymentImageMutationPayload(requestPayload)

      await runAddPaymentMutation(
        mutationPayload,
        async (persistedPayload, operation) => {
          ensurePaymentImageReplayFileMatches(
            persistedPayload.file,
            mutationPayload.file,
          )

          return addPaymentImage(
            {
              amount: persistedPayload.amount,
              comment: persistedPayload.comment,
              image: requestPayload.image,
              paymentImageId: persistedPayload.paymentImageId,
              paymentType: persistedPayload.paymentType,
              user: persistedPayload.user,
            },
            operation,
          )
        },
      )
      setSelectedItem(null)
      reload()
      notifications.show({ color: 'green', message: t('Платіж створено') })
      return true
    } catch (addError) {
      if (addError instanceof SalesPendingMutationRecoveredError) {
        setSelectedItem(null)
        reload()
        notifications.show({
          color: 'yellow',
          message: t(addError.message),
        })
        return true
      }

      if (isDefinitiveRetailPaymentImageConcurrencyConflict(addError)) {
        const conflictMessage = t(
          'Статус оплати змінився під час збереження. Ми оновили платіж; введені сума, тип, коментар і файл залишилися у формі. Перевірте дані та повторіть дію.',
        )
        const refreshed = await refreshSelectedPaymentForCreate(
          conflictMessage,
        )

        notifications.show({
          color: refreshed ? 'yellow' : 'red',
          message: conflictMessage,
        })
        return false
      }

      setCreateError(addError instanceof Error ? addError.message : t('Сталася помилка, заповніть поля!'))
      return false
    } finally {
      setCreating(false)
    }
  }

  async function refreshSelectedPaymentForCreate(
    successMessage: string,
  ): Promise<boolean> {
    const paymentImageId = selectedItem?.Id
    const saleNumber = selectedItem?.Sale?.SaleNumber?.Value || ''

    if (!paymentImageId || !saleNumber) {
      setCreateError(
        t('Не вдалося визначити платіж для оновлення. Закрийте форму та відкрийте її повторно.'),
      )
      return false
    }

    try {
      const freshPayment = await getPaymentShopItemForRefresh(
        paymentImageId,
        saleNumber,
      )

      if (!freshPayment) {
        setSelectedItem(null)
        setCreateNotice(null)
        setCreateError(
          t('Оплату вже видалено або вона недоступна. Список оновлено.'),
        )
        reload()
        return false
      }

      setSelectedItem(freshPayment)
      setItems((current) => replacePaymentShopItem(current, freshPayment))
      setCreateError(null)
      setCreateNotice(successMessage)
      return true
    } catch (refreshError) {
      setCreateError(
        refreshError instanceof Error
          ? refreshError.message
          : t('Не вдалося оновити дані оплати'),
      )
      return false
    }
  }

  async function refreshEditingPayment(
    successMessage = t(
      'Актуальні дані завантажено. Перевірте введені значення та повторіть збереження.',
    ),
  ): Promise<boolean> {
    const paymentImageId = selectedItem?.Id
    const paymentImageItemId = editItem?.Id
    const saleNumber = selectedItem?.Sale?.SaleNumber?.Value || ''

    if (!paymentImageId || !paymentImageItemId || !saleNumber) {
      setEditError(
        t('Не вдалося визначити платіж для оновлення. Закрийте форму та відкрийте її повторно.'),
      )
      return false
    }

    if (!isEditOpenRef.current) {
      return false
    }

    setRefreshingEdit(true)

    try {
      const freshPayment = await getPaymentShopItemForRefresh(
        paymentImageId,
        saleNumber,
      )
      const freshItem = freshPayment?.RetailClientPaymentImageItems?.find(
        (item) => item.Id === paymentImageItemId,
      )

      if (!isEditOpenRef.current) {
        return false
      }

      if (!freshPayment || !freshItem) {
        isEditOpenRef.current = false
        setEditItem(null)
        setEditNotice(null)
        setEditError(
          t('Підтвердження оплати вже видалено або недоступне. Список оновлено.'),
        )
        reload()
        return false
      }

      setSelectedItem(freshPayment)
      setItems((current) => replacePaymentShopItem(current, freshPayment))

      if (freshItem.IsLocked) {
        isEditOpenRef.current = false
        setEditItem(null)
        setEditNotice(null)
        notifications.show({
          color: 'yellow',
          message: t(
            'Оплату вже проведено бухгалтерією. Редагування більше недоступне.',
          ),
        })
        return false
      }

      // The edit form key is the stable item identity, not RowVersion, so the
      // user's amount/comment draft survives while the concurrency token and
      // server summary are refreshed underneath it.
      setEditItem(freshItem)
      setEditError(null)
      setEditNotice(successMessage)
      return true
    } catch (refreshError) {
      setEditError(
        refreshError instanceof Error
          ? refreshError.message
          : t('Не вдалося оновити дані оплати'),
      )
      return false
    } finally {
      setRefreshingEdit(false)
    }
  }

  async function handleEditPayment(
    amount: number,
    comment: string,
    paymentType: PaymentTypeValue,
  ) {
    if (!editItem || !selectedItem?.Id) {
      return
    }

    if (!editItem.RowVersion) {
      setEditError(t('Дані платежу застаріли. Оновіть список перед редагуванням.'))
      return
    }

    setEditError(null)
    setSaving(true)

    try {
      const requestPayload = {
        amount,
        comment,
        item: editItem,
        paymentImageId: selectedItem.Id,
        paymentType,
        user: user,
      }
      const updatedItem = await runEditPaymentMutation(
        requestPayload,
        editPaymentImage,
      )

      if (updatedItem?.RetailClientPaymentImageItems) {
        setSelectedItem(updatedItem)
        setItems((current) => replacePaymentShopItem(current, updatedItem))
      } else {
        // Never keep the stale RowVersion after a committed update.
        setSelectedItem(null)
      }
      setEditItem(null)
      isEditOpenRef.current = false
      setEditNotice(null)
      reload()
    } catch (saveError) {
      if (saveError instanceof SalesPendingMutationRecoveredError) {
        isEditOpenRef.current = false
        setEditItem(null)
        setSelectedItem(null)
        reload()
        notifications.show({
          color: 'yellow',
          message: t(saveError.message),
        })
        return
      }
      if (isDefinitiveRetailPaymentImageConcurrencyConflict(saveError)) {
        const conflictCode = getRetailPaymentImageConcurrencyCode(saveError)
        const conflictMessage =
          conflictCode === RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT
            ? t(
                'Це підтвердження оплати змінив інший користувач. Ми завантажили актуальну версію; ваші введені значення збережено у формі.',
              )
            : t(
                'Загальний статус оплати змінився під час збереження. Ми оновили платіж; перевірте дані та повторіть дію.',
              )

        setEditError(null)
        setEditNotice(conflictMessage)
        await refreshEditingPayment(conflictMessage)
        notifications.show({
          color: 'yellow',
          message: conflictMessage,
        })
        return
      }

      const message =
        saveError instanceof Error
          ? saveError.message
          : t('Не вдалося виконати запит')
      setEditError(message)
    } finally {
      setSaving(false)
    }
  }

  const columns = usePaymentShopColumns(openDetail, createIncomeOrder)
  const totalPages = totalRowsQty > 0 ? Math.max(1, Math.ceil(totalRowsQty / pageSize)) : undefined
  const hasNext = totalPages ? page < totalPages : items.length === pageSize

  return {
    activeFilters, applyFilters, closeDetail, closeEditItem, columns, createError, createNotice, editError, editItem, editNotice,
    error, filterDraft, handleAddPayment, handleEditPayment, hasNext, isCreating, isLoading, isRefreshingEdit,
    isSaving, items, openDetail, openEditItem, page, pageSize, refreshEditingPayment, reload, resetFilters,
    selectedItem, setFilterDraft, setPage, setPageSize,
    totalPages,
  }
}

function usePaymentShopLoader({
  activeFilters,
  page,
  pageSize,
  reloadKey,
  setError,
  setItems,
  setLoading,
  setTotalRowsQty,
}: {
  activeFilters: PaymentShopFilters
  page: number
  pageSize: number
  reloadKey: number
  setError: (value: string | null) => void
  setItems: (value: PaymentShopItem[]) => void
  setLoading: (value: boolean) => void
  setTotalRowsQty: (value: number) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadItems() {
      setLoading(true)
      setError(null)

      try {
        const nextPage = await getPaymentShopItemsPage({
          ...activeFilters,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })

        if (!cancelled) {
          setItems(nextPage.items)
          setTotalRowsQty(nextPage.totalRowsQty ?? 0)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setTotalRowsQty(0)
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
  }, [activeFilters, page, pageSize, reloadKey, setError, setItems, setLoading, setTotalRowsQty, t])
}

export function PaymentOnlineShopPage() {
  const model = usePaymentOnlineShopModel()

  return (
    <Stack className="payment-online-shop-page" gap={6}>
      <PaymentShopTableCard model={model} />
      <PaymentShopDetailDrawer
        createError={model.createError}
        createNotice={model.createNotice}
        isCreating={model.isCreating}
        item={model.selectedItem}
        onAddPayment={model.handleAddPayment}
        onClose={model.closeDetail}
        onEditItem={model.openEditItem}
      />
      <PaymentImageEditModal
        editError={model.editError}
        editNotice={model.editNotice}
        isRefreshing={model.isRefreshingEdit}
        isSaving={model.isSaving}
        item={model.editItem}
        onClose={model.closeEditItem}
        onConfirm={model.handleEditPayment}
        onRefresh={() => void model.refreshEditingPayment()}
      />
    </Stack>
  )
}

function PaymentShopTableCard({ model }: { model: ReturnType<typeof usePaymentOnlineShopModel> }) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const {
    applyFilters, columns, error, filterDraft, hasNext, isLoading, items, openDetail, page, pageSize, reload,
    resetFilters, setFilterDraft, setPage, setPageSize, totalPages,
  } = model

  return (
    <Card className="app-data-card payment-online-shop-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar payment-online-shop-filter-bar">
        <Group align="end" gap={10} wrap="nowrap" className="payment-online-shop-filter-row">
          <div className="app-filter-date-range">
            <TextInput
              size="sm"
              label={t('Від')}
              max={filterDraft.saleDateTo || undefined}
              type="date"
              value={filterDraft.saleDateFrom}
              onChange={(event) => setFilterDraft({ ...filterDraft, saleDateFrom: event.currentTarget.value })}
            />
            <TextInput
              size="sm"
              label={t('До')}
              min={filterDraft.saleDateFrom || undefined}
              type="date"
              value={filterDraft.saleDateTo}
              onChange={(event) => setFilterDraft({ ...filterDraft, saleDateTo: event.currentTarget.value })}
            />
          </div>
          <TextInput
            size="sm"
            label={t('Продаж')}
            placeholder={t('Номер')}
            value={filterDraft.saleNumber}
            onChange={(event) => setFilterDraft({ ...filterDraft, saleNumber: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyFilters()
              }
            }}
            style={{ flex: '1 1 auto', minWidth: 180 }}
          />
          <TextInput
            size="sm"
            label={t('Клієнт')}
            placeholder={t('Телефон')}
            value={filterDraft.phoneNumber}
            onChange={(event) => setFilterDraft({ ...filterDraft, phoneNumber: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyFilters()
              }
            }}
          />
          <div className="app-filter-actions">
            <Tooltip label={t('Пошук')}>
              <ActionIcon aria-label={t('Пошук')} color="gray" size={34} variant="light" onClick={applyFilters}>
                <Search size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              hasNext={hasNext}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
              onRefresh={reload}
            />
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </Group>
      </div>

      <Stack className="payment-online-shop-card__body" gap={0}>
        {error && (
          <Alert className="payment-online-shop-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="payment-online-shop-page__table">
          <DataTable
            columns={columns}
            data={items}
            defaultLayout={PAYMENT_SHOP_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Замовлень магазину не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="payment-online-shop-table-1"
            loadingText={t('Завантаження')}
            minWidth={1620}
            showLayoutControls
            tableId="payment-online-shop"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openDetail}
          />
        </div>
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
        id: 'status',
        header: t('Статус оплати'),
        width: 210,
        minWidth: 190,
        accessor: (item) => item.RetailPaymentStatus?.RetailPaymentStatusType,
        cell: (item) => {
          const status = getRetailPaymentStatusPresentation(
            item.RetailPaymentStatus?.RetailPaymentStatusType,
          )

          return (
            <Badge color={status.color} variant="light">
              {t(status.label)}
            </Badge>
          )
        },
      },
      {
        id: 'paid',
        header: t('Оплачено'),
        width: 160,
        minWidth: 130,
        numeric: true,
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
        rowActions: true,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (item) =>
          canCreateIncomeOrder(item) ? (
            <TableRowAction
              action="receipt"
              label={t('Новий прибутковий ордер')}
              tone="success"
              onClick={() => onCreateIncomeOrder(item)}
            />
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
          <TableRowAction action="details" label={t('Деталі')} onClick={() => onOpenDetail(item)} />
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

function isSamePaymentShopItem(first: PaymentShopItem, second: PaymentShopItem): boolean {
  return Boolean((first.NetUid && first.NetUid === second.NetUid) || (first.Id && first.Id === second.Id))
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
