import {
  Alert,
  Autocomplete,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, FileSpreadsheet, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { formatExcelArticleColumnError } from '../../../shared/excel/excelImportError'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import type { ClientResourceOrganization, ClientResourceStorage } from '../../client-resources/types'
import {
  createProductCapitalization,
  getProductCapitalizationOrganizations,
  getProductCapitalizationStoragesByOrganization,
  parseProductCapitalizationItemsFromFile,
  searchProductsByVendorCode,
} from '../api/productCapitalizationsApi'
import { resolveProductCapitalizationSelection } from '../productCapitalizationSelection'
import type {
  ProductCapitalizationItem,
  ProductCapitalizationParseConfiguration,
  ProductCapitalizationSearchProduct,
} from '../types'
import { ProductCapitalizationMissingItemsModal } from './ProductCapitalizationMissingItemsModal'
import { ProductCapitalizationUploadModal } from './ProductCapitalizationUploadModal'
import './product-capitalization-sheet.css'

const VENDOR_CODE_DEBOUNCE_MS = 280

/* Portal dropdowns get the orange selected-option override (§1 — no violet). */
const CAPITALIZATION_COMBOBOX_PROPS = {
  classNames: { dropdown: 'product-capitalization-dropdown' },
}

const ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type ItemEntryDraft = {
  quantity: number | ''
  unitPrice: number | ''
  weight: number | ''
}

const EMPTY_ITEM_ENTRY: ItemEntryDraft = {
  quantity: '',
  unitPrice: '',
  weight: '',
}

type DraftItem = ProductCapitalizationItem & { __priceRequired: boolean; __rowKey: string }

type StorageSelectionState = {
  items: ClientResourceStorage[]
  isLoading: boolean
  selectedNetId: string | null
}

const EMPTY_STORAGE_SELECTION: StorageSelectionState = {
  items: [],
  isLoading: false,
  selectedNetId: null,
}

let rowKeySequence = 0

function nextRowKey(): string {
  rowKeySequence += 1

  return `pc-item-${rowKeySequence}`
}

function toDraftItem(item: ProductCapitalizationItem, options: { priceRequired?: boolean } = {}): DraftItem {
  return { ...item, __priceRequired: options.priceRequired ?? true, __rowKey: nextRowKey() }
}

function fromDraftItem({ __priceRequired, __rowKey, ...item }: DraftItem): ProductCapitalizationItem {
  void __priceRequired
  void __rowKey

  return {
    ...item,
    ProductId: item.ProductId || item.Product?.Id,
    Qty: toPositiveInteger(item.Qty),
    UnitPrice: toFiniteNumber(item.UnitPrice),
    Weight: toFiniteNumber(item.Weight),
  }
}

function getCapitalizationItemVendorCode(item: ProductCapitalizationItem): string | undefined {
  return item.Product?.VendorCode || item.ProductVendorCode
}

function isValidCapitalizationItemProduct(item: ProductCapitalizationItem): boolean {
  return Boolean((item.ProductId || item.Product?.Id) && !item.Product?.Deleted)
}

export type NewProductCapitalizationPanelProps = {
  opened: boolean
  onClose: () => void
  onCreated: () => void
}

export function NewProductCapitalizationPanel({ opened, onClose, onCreated }: NewProductCapitalizationPanelProps) {
  const { t } = useI18n()
  const model = useNewProductCapitalizationModel(opened, onClose, onCreated)
  const isFormBusy = model.isSubmitting || model.isParsing
  const itemColumns = useItemColumns(model.items, model.updateItem, model.removeItem, isFormBusy)

  return (
    <AppDrawer
      className="product-capitalization-sheet"
      footer={
        <>
          <Button
            disabled={isFormBusy}
            leftSection={<FileSpreadsheet size={16} />}
            variant="default"
            onClick={model.openUploadModal}
          >
            {t('Імпорт з Excel')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={isFormBusy}
            loading={model.isSubmitting}
            onClick={model.submit}
          >
            {t('Провести')}
          </Button>
        </>
      }
      opened={opened}
      padding="lg"
      position="right"
      size="78rem"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Нове оприбуткування')}</span>}
      onClose={model.requestClose}
    >
      <Stack gap="md">
        {model.error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {model.error}
          </Alert>
        )}

        <Text className="app-section-title" fw={600} size="sm">
          {t('Параметри документа')}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm" style={{ alignItems: 'end' }}>
          <TextInput
            disabled={isFormBusy}
            label={t('Коментар')}
            value={model.comment}
            onChange={(event) => model.setComment(event.currentTarget.value)}
          />
          <TextInput
            disabled={isFormBusy}
            label={t('Дата')}
            type="datetime-local"
            value={model.fromDate}
            onChange={(event) => model.setFromDate(event.currentTarget.value)}
          />
          <Select
            comboboxProps={CAPITALIZATION_COMBOBOX_PROPS}
            data={model.organizationOptions}
            disabled={isFormBusy}
            label={t('Організація')}
            searchable
            value={model.selectedOrganizationNetId}
            onChange={model.selectOrganization}
          />
          <Select
            comboboxProps={CAPITALIZATION_COMBOBOX_PROPS}
            data={model.storageOptions}
            disabled={isFormBusy || !model.selectedOrganizationNetId || model.isLoadingStorages}
            label={t('Склад')}
            placeholder={model.isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
            searchable
            value={model.selectedStorageNetId}
            onChange={model.selectStorage}
          />
        </SimpleGrid>

        <Text className="app-section-title" fw={600} size="sm">
          {t('Товари')}
        </Text>
        <Group align="end" gap="sm" wrap="nowrap">
          <Autocomplete
            comboboxProps={CAPITALIZATION_COMBOBOX_PROPS}
            data={model.vendorCodeOptions}
            disabled={isFormBusy}
            label={t('Артикул')}
            style={{ flex: 1.4 }}
            value={model.vendorCodeQuery}
            onChange={model.changeVendorCodeQuery}
            onOptionSubmit={model.selectVendorCode}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={isFormBusy}
            label={t('Кількість')}
            min={1}
            style={{ flex: 1 }}
            value={model.itemEntry.quantity}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, quantity: toIntegerOrEmpty(value) }))}
          />
          <NumberInput
            allowNegative={false}
            disabled={isFormBusy}
            label={t('Вага за одиницю')}
            min={0}
            style={{ flex: 1 }}
            value={model.itemEntry.weight}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, weight: toNumberOrEmpty(value) }))}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            disabled={isFormBusy}
            label={t('Ціна за одиницю')}
            min={0}
            style={{ flex: 1 }}
            value={model.itemEntry.unitPrice}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, unitPrice: toNumberOrEmpty(value) }))}
          />
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={isFormBusy}
            leftSection={<Plus size={16} />}
            mb={1}
            variant="outline"
            onClick={model.addItem}
          >
            {t('Додати рядок')}
          </Button>
        </Group>

        <DataTable
          columns={itemColumns}
          data={model.items}
          defaultLayout={ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Додайте хоча б один товар')}
          getRowId={(item) => item.__rowKey}
          layoutVersion="new-product-capitalization-items-1"
          maxHeight="calc(100vh - 400px)"
          minWidth={920}
          tableId="new-product-capitalization-items"
        />
      </Stack>

      {model.uploadModalOpened && (
        <ProductCapitalizationUploadModal
          isSubmitting={model.isParsing}
          opened={model.uploadModalOpened}
          submitError={model.uploadError}
          onClose={model.closeUploadModal}
          onSubmit={model.parseFromFiles}
        />
      )}

      <ProductCapitalizationMissingItemsModal
        items={model.missingVendorCodes}
        opened={model.missingModalOpened}
        onClose={() => model.setMissingModalOpened(false)}
      />

      <AppModal
        centered
        className="product-capitalization-confirm-modal"
        opened={model.confirmCloseOpen}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Є незбережені зміни')}</span>}
        onClose={model.cancelClose}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити форму, документ оприбуткування не буде створено.')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={model.cancelClose}>
              {t('Залишитися')}
            </Button>
            <Button color="red" onClick={model.confirmClose}>
              {t('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </AppDrawer>
  )
}

function useNewProductCapitalizationModel(opened: boolean, onClose: () => void, onCreated: () => void) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useValueState<ClientResourceOrganization[]>([])
  const [selectedOrganizationNetId, setSelectedOrganizationNetId] = useValueState<string | null>(null)
  const [storageState, setStorageState] = useValueState<StorageSelectionState>(EMPTY_STORAGE_SELECTION)
  const [comment, setComment] = useValueState('')
  const [fromDate, setFromDate] = useValueState(() => toDateTimeLocal(new Date()))
  const [items, setItems] = useValueState<DraftItem[]>([])
  const [itemEntry, setItemEntry] = useValueState<ItemEntryDraft>(EMPTY_ITEM_ENTRY)
  const [selectedProduct, setSelectedProduct] = useValueState<ProductCapitalizationSearchProduct | null>(null)
  const [vendorCodeQuery, setVendorCodeQuery] = useValueState('')
  const [searchedProducts, setSearchedProducts] = useValueState<ProductCapitalizationSearchProduct[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [uploadModalOpened, setUploadModalOpened] = useValueState(false)
  const [uploadError, setUploadError] = useValueState<string | null>(null)
  const [isParsing, setParsing] = useValueState(false)
  const [missingVendorCodes, setMissingVendorCodes] = useValueState<string[]>([])
  const [missingModalOpened, setMissingModalOpened] = useValueState(false)
  const [debouncedVendorCode] = useDebouncedValue(vendorCodeQuery, VENDOR_CODE_DEBOUNCE_MS)
  const [confirmCloseOpen, setConfirmCloseOpen] = useValueState(false)
  const [initialFromDate, setInitialFromDate] = useValueState(fromDate)
  const searchRequestRef = useRef(0)
  const parseRequestRef = useRef(0)
  const submitRequestRef = useRef(0)
  const storages = storageState.items
  const selectedStorageNetId = storageState.selectedNetId
  const isLoadingStorages = storageState.isLoading

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      try {
        const loadedOrganizations = await getProductCapitalizationOrganizations()

        if (cancelled) {
          return
        }

        setOrganizations(loadedOrganizations)

        const firstNetId = loadedOrganizations.find((organization) => organization.NetUid)?.NetUid || null
        setSelectedOrganizationNetId(firstNetId)
      } catch {
        if (!cancelled) {
          setError(t('Не вдалося завантажити організації'))
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [opened, setError, setOrganizations, setSelectedOrganizationNetId, t])

  useEffect(() => {
    if (!opened || !selectedOrganizationNetId) {
      setStorageState(EMPTY_STORAGE_SELECTION)
      return
    }

    let cancelled = false

    async function loadStorages() {
      setStorageState({
        items: [],
        isLoading: true,
        selectedNetId: null,
      })
      setError(null)

      try {
        const loadedStorages = await getProductCapitalizationStoragesByOrganization(selectedOrganizationNetId as string)

        if (cancelled) {
          return
        }

        setStorageState({
          items: loadedStorages,
          isLoading: false,
          selectedNetId: loadedStorages.find((storage) => storage.NetUid)?.NetUid || null,
        })
      } catch {
        if (!cancelled) {
          setStorageState(EMPTY_STORAGE_SELECTION)
          setError(t('Не вдалося завантажити склади'))
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [opened, selectedOrganizationNetId, setError, setStorageState, t])

  useEffect(() => {
    const query = debouncedVendorCode.trim()

    if (!opened || query.length === 0) {
      return
    }

    let cancelled = false
    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId

    async function searchProducts() {
      try {
        const products = await searchProductsByVendorCode(query)

        if (!cancelled && searchRequestRef.current === requestId) {
          setSearchedProducts(products)
        }
      } catch {
        if (!cancelled && searchRequestRef.current === requestId) {
          setSearchedProducts([])
        }
      }
    }

    void searchProducts()

    return () => {
      cancelled = true
    }
  }, [debouncedVendorCode, opened, setSearchedProducts])

  const organizationOptions = useMemo(
    () => toSelectOptions(organizations),
    [organizations],
  )
  const storageOptions = useMemo(
    () => toSelectOptions(storages),
    [storages],
  )
  const vendorCodeOptions = useMemo(
    () => searchedProducts.reduce<string[]>((options, product) => {
      if (product.VendorCode) {
        options.push(product.VendorCode)
      }

      return options
    }, []),
    [searchedProducts],
  )

  const selectOrganization = useCallback(
    (value: string | null) => {
      setSelectedOrganizationNetId(value)
      setStorageState(EMPTY_STORAGE_SELECTION)
    },
    [setSelectedOrganizationNetId, setStorageState],
  )

  const selectStorage = useCallback(
    (value: string | null) => {
      setStorageState((current) => ({
        ...current,
        selectedNetId: value,
      }))
    },
    [setStorageState],
  )

  const changeVendorCodeQuery = useCallback(
    (value: string) => {
      searchRequestRef.current += 1
      setVendorCodeQuery(value)
      setSelectedProduct(null)
      setSearchedProducts([])
    },
    [setSearchedProducts, setSelectedProduct, setVendorCodeQuery],
  )

  const selectVendorCode = useCallback(
    (value: string) => {
      const product = searchedProducts.find((searchedProduct) => searchedProduct.VendorCode === value) || null
      setSelectedProduct(product)
      setVendorCodeQuery(value)
    },
    [searchedProducts, setSelectedProduct, setVendorCodeQuery],
  )

  const addItem = useCallback(() => {
    if (isSubmitting || isParsing) {
      return
    }

    const product = resolveProductCapitalizationSelection(selectedProduct, searchedProducts, vendorCodeQuery)

    if (!product || !product.Id || product.Deleted) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Артикул')}` })
      return
    }

    const quantity = toPositiveInteger(itemEntry.quantity)
    const unitPrice = toFiniteNumber(itemEntry.unitPrice)

    if (quantity <= 0) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Кількість')}` })
      return
    }

    if (unitPrice <= 0) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Ціна за одиницю')}` })
      return
    }

    const newItem = toDraftItem({
      Product: {
        Id: product.Id,
        Name: product.Name,
        NetUid: product.NetUid,
        VendorCode: product.VendorCode,
      },
      ProductId: product.Id,
      Qty: quantity,
      UnitPrice: unitPrice,
      Weight: toFiniteNumber(itemEntry.weight),
    })

    setItems((current) => [...current, newItem])
    setItemEntry(EMPTY_ITEM_ENTRY)
    setSelectedProduct(null)
    setVendorCodeQuery('')
    setSearchedProducts([])
  }, [
    itemEntry.quantity,
    itemEntry.unitPrice,
    itemEntry.weight,
    isParsing,
    isSubmitting,
    searchedProducts,
    selectedProduct,
    setItemEntry,
    setItems,
    setSearchedProducts,
    setSelectedProduct,
    setVendorCodeQuery,
    t,
    vendorCodeQuery,
  ])

  const updateItem = useCallback(
    (rowKey: string, field: 'Qty' | 'UnitPrice' | 'Weight', value: number) => {
      if (isSubmitting || isParsing) {
        return
      }

      setItems((current) =>
        current.map((item) => (item.__rowKey === rowKey ? { ...item, [field]: value } : item)),
      )
    },
    [isParsing, isSubmitting, setItems],
  )

  const removeItem = useCallback(
    (rowKey: string) => {
      if (isSubmitting || isParsing) {
        return
      }

      setItems((current) => current.filter((item) => item.__rowKey !== rowKey))
    },
    [isParsing, isSubmitting, setItems],
  )

  const openUploadModal = useCallback(() => {
    if (isSubmitting || isParsing) {
      return
    }

    setUploadError(null)
    setUploadModalOpened(true)
  }, [isParsing, isSubmitting, setUploadError, setUploadModalOpened])

  const closeUploadModal = useCallback(() => {
    if (isParsing) {
      return
    }

    parseRequestRef.current += 1
    setUploadError(null)
    setUploadModalOpened(false)
  }, [isParsing, setUploadError, setUploadModalOpened])

  const resetDraft = useCallback(() => {
    const nextFromDate = toDateTimeLocal(new Date())

    parseRequestRef.current += 1
    searchRequestRef.current += 1
    submitRequestRef.current += 1
    setInitialFromDate(nextFromDate)
    setComment('')
    setFromDate(nextFromDate)
    setItems([])
    setItemEntry(EMPTY_ITEM_ENTRY)
    setSelectedProduct(null)
    setVendorCodeQuery('')
    setSearchedProducts([])
    setError(null)
    setUploadError(null)
    setUploadModalOpened(false)
    setParsing(false)
    setSubmitting(false)
    setMissingVendorCodes([])
    setMissingModalOpened(false)
  }, [
    setComment,
    setError,
    setFromDate,
    setItemEntry,
    setItems,
    setInitialFromDate,
    setMissingModalOpened,
    setMissingVendorCodes,
    setParsing,
    setSearchedProducts,
    setSelectedProduct,
    setSubmitting,
    setUploadError,
    setUploadModalOpened,
    setVendorCodeQuery,
  ])

  const parseFromFiles = useCallback(
    (files: File[], parseConfiguration: ProductCapitalizationParseConfiguration) => {
      if (isSubmitting || isParsing) {
        return
      }

      const requestId = parseRequestRef.current + 1
      parseRequestRef.current = requestId
      const isCurrentParse = () => parseRequestRef.current === requestId
      setParsing(true)
      setUploadError(null)

      void Promise.all(files.map((file) => parseProductCapitalizationItemsFromFile(file, parseConfiguration)))
        .then((results) => {
          if (!isCurrentParse()) {
            return
          }

        const parsedItems: ProductCapitalizationItem[] = []
        const invalidVendorCodes: string[] = []
        const missingVendorCodes: string[] = []

        results.forEach((result) => {
          missingVendorCodes.push(...result.MissingVendorCodes)

          result.Items.forEach((item) => {
            if (isValidCapitalizationItemProduct(item)) {
              parsedItems.push(item)

              return
            }

            const vendorCode = getCapitalizationItemVendorCode(item)

            if (vendorCode) {
              invalidVendorCodes.push(vendorCode)
            }
          })
        })

        const uniqueMissingVendorCodes = Array.from(new Set([...missingVendorCodes, ...invalidVendorCodes]))

        if (isCurrentParse()) {
          setItems((current) => [
            ...current,
            ...parsedItems.map((item) => toDraftItem(item, { priceRequired: parseConfiguration.WithPrice })),
          ])
          setUploadModalOpened(false)
        }

        if (isCurrentParse() && uniqueMissingVendorCodes.length > 0) {
          setMissingVendorCodes(uniqueMissingVendorCodes)
          setMissingModalOpened(true)
        }
        })
        .catch((parseError: unknown) => {
          if (isCurrentParse()) {
            setUploadError(formatExcelArticleColumnError(
              parseError,
              parseConfiguration.VendorCodeColumnNumber,
              t('Не вдалося розпізнати файл'),
            ))
          }
        })
        .finally(() => {
          if (isCurrentParse()) {
            setParsing(false)
          }
        })
    },
    [
      isParsing,
      isSubmitting,
      setItems,
      setMissingModalOpened,
      setMissingVendorCodes,
      setParsing,
      setUploadError,
      setUploadModalOpened,
      t,
    ],
  )

  const submit = useCallback(async () => {
    if (isSubmitting || isParsing) {
      return
    }

    const requestId = submitRequestRef.current + 1
    submitRequestRef.current = requestId
    const isCurrentSubmit = () => submitRequestRef.current === requestId

    if (items.length === 0) {
      notifications.show({ color: 'yellow', message: t('Додайте хоча б один товар') })
      return
    }

    if (items.some((item) => toPositiveInteger(item.Qty) <= 0)) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Кількість')}` })
      return
    }

    if (items.some((item) => item.__priceRequired && toFiniteNumber(item.UnitPrice) <= 0)) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Ціна за одиницю')}` })
      return
    }

    if (items.some((item) => !isValidCapitalizationItemProduct(item))) {
      notifications.show({ color: 'yellow', message: t('Є рядки без активного товару') })
      return
    }

    const organization = organizations.find((candidate) => candidate.NetUid === selectedOrganizationNetId)
    const storage = storages.find((candidate) => candidate.NetUid === selectedStorageNetId)

    if (!storage) {
      notifications.show({ color: 'yellow', message: t('Оберіть склад') })
      return
    }

    if (!organization) {
      notifications.show({ color: 'yellow', message: t('Оберіть організацію') })
      return
    }

    const fromDateIso = toIsoDateTimeOrNull(fromDate)

    if (!fromDateIso) {
      notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату') })
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const productCapitalization = await createProductCapitalization({
        Comment: comment,
        FromDate: fromDateIso,
        Organization: organization,
        ProductCapitalizationItems: items.map(fromDraftItem),
        Storage: storage,
      })

      if (!productCapitalization || (!productCapitalization.NetUid && !productCapitalization.Id)) {
        throw new Error(t('Сервер не повернув створене оприбуткування'))
      }

      if (isCurrentSubmit()) {
        notifications.show({ color: 'green', message: t('Оприбуткування створено') })
        resetDraft()
        onCreated()
        onClose()
      }
    } catch (submitError) {
      if (isCurrentSubmit()) {
        setError(submitError instanceof Error ? submitError.message : t('Не вдалося створити оприбуткування'))
      }
    } finally {
      if (isCurrentSubmit()) {
        setSubmitting(false)
      }
    }
  }, [
    comment,
    fromDate,
    isParsing,
    isSubmitting,
    items,
    onClose,
    onCreated,
    organizations,
    resetDraft,
    selectedOrganizationNetId,
    selectedStorageNetId,
    setError,
    setSubmitting,
    storages,
    t,
  ])

  const hasDraftChanges = useMemo(
    () =>
      Boolean(comment.trim()) ||
      fromDate !== initialFromDate ||
      items.length > 0 ||
      Boolean(vendorCodeQuery.trim()) ||
      Boolean(selectedProduct) ||
      itemEntry.quantity !== '' ||
      itemEntry.unitPrice !== '' ||
      itemEntry.weight !== '',
    [comment, fromDate, initialFromDate, itemEntry.quantity, itemEntry.unitPrice, itemEntry.weight, items.length, selectedProduct, vendorCodeQuery],
  )

  const requestClose = useCallback(() => {
    if (isSubmitting || isParsing) {
      return
    }

    if (hasDraftChanges) {
      setConfirmCloseOpen(true)
      return
    }

    resetDraft()
    onClose()
  }, [hasDraftChanges, isParsing, isSubmitting, onClose, resetDraft, setConfirmCloseOpen])

  const cancelClose = useCallback(() => {
    setConfirmCloseOpen(false)
  }, [setConfirmCloseOpen])

  const confirmClose = useCallback(() => {
    setConfirmCloseOpen(false)
    resetDraft()
    onClose()
  }, [onClose, resetDraft, setConfirmCloseOpen])

  return {
    cancelClose,
    comment,
    confirmClose,
    confirmCloseOpen,
    error,
    fromDate,
    isParsing,
    isLoadingStorages,
    isSubmitting,
    itemEntry,
    items,
    missingModalOpened,
    missingVendorCodes,
    organizationOptions,
    selectedOrganizationNetId,
    selectedStorageNetId,
    storageOptions,
    uploadError,
    uploadModalOpened,
    vendorCodeOptions,
    vendorCodeQuery,
    addItem,
    changeVendorCodeQuery,
    closeUploadModal,
    openUploadModal,
    parseFromFiles,
    removeItem,
    requestClose,
    selectOrganization,
    selectStorage,
    selectVendorCode,
    setComment,
    setFromDate,
    setItemEntry,
    setMissingModalOpened,
    submit,
    updateItem,
  }
}

function useItemColumns(
  items: DraftItem[],
  onUpdate: (rowKey: string, field: 'Qty' | 'UnitPrice' | 'Weight', value: number) => void,
  onRemove: (rowKey: string) => void,
  disabled: boolean,
): DataTableColumn<DraftItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DraftItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (item) => (
          <span className="product-capitalization-cell-num">
            {String(items.findIndex((candidate) => candidate.__rowKey === item.__rowKey) + 1)}
          </span>
        ),
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 160,
        minWidth: 124,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => (
          <span className="product-capitalization-cell-code">
            {displayValue(item.Product?.VendorCode || item.ProductVendorCode)}
          </span>
        ),
      },
      {
        id: 'name',
        header: t('Найменування'),
        width: 320,
        minWidth: 220,
        accessor: (item) => item.Product?.Name,
        cell: (item) => (
          <Text c="gray.8" fw={600} lineClamp={2} size="sm">
            {displayValue(item.Product?.Name || item.ProductName)}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 130,
        minWidth: 110,
        align: 'right',
        enableSorting: false,
        cell: (item) => (
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled}
            hideControls
            min={1}
            size="xs"
            value={item.Qty ?? ''}
            onChange={(value) => onUpdate(item.__rowKey, 'Qty', toPositiveInteger(value))}
          />
        ),
      },
      {
        id: 'unitPrice',
        header: t('Ціна за одиницю'),
        width: 150,
        minWidth: 120,
        align: 'right',
        enableSorting: false,
        cell: (item) => (
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            disabled={disabled}
            hideControls
            min={0}
            size="xs"
            value={item.UnitPrice ?? ''}
            onChange={(value) => onUpdate(item.__rowKey, 'UnitPrice', toFiniteNumber(value))}
          />
        ),
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 130,
        minWidth: 110,
        align: 'right',
        enableSorting: false,
        cell: (item) => (
          <NumberInput
            allowNegative={false}
            disabled={disabled}
            hideControls
            min={0}
            size="xs"
            value={item.Weight ?? ''}
            onChange={(value) => onUpdate(item.__rowKey, 'Weight', toFiniteNumber(value))}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 64,
        minWidth: 56,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        cell: (item) => (
          <TableRowAction
            action="delete"
            disabled={disabled}
            label={t('Видалити')}
            onClick={() => onRemove(item.__rowKey)}
          />
        ),
      },
    ],
    [disabled, items, onRemove, onUpdate, t],
  )
}

function toSelectOption(entity: { NetUid?: string; Name?: string }) {
  return {
    label: entity.Name || entity.NetUid || '',
    value: entity.NetUid as string,
  }
}

function toSelectOptions(entities: { NetUid?: string; Name?: string }[]) {
  return entities.reduce<{ label: string; value: string }[]>((options, entity) => {
    if (entity.NetUid) {
      options.push(toSelectOption(entity))
    }

    return options
  }, [])
}

function toDateTimeLocal(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}

function toIsoDateTimeOrNull(value: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toNumberOrEmpty(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : ''
}

function toIntegerOrEmpty(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : ''
}

function toFiniteNumber(value: number | string | undefined): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function toPositiveInteger(value: number | string | undefined): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0
  }

  return Math.trunc(numberValue)
}

/* Empty values render as blank cells (§5), never a dash. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}
