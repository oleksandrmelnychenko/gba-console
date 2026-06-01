import {
  ActionIcon,
  Alert,
  Autocomplete,
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import type { ClientResourceOrganization, ClientResourceStorage } from '../../client-resources/types'
import {
  createProductCapitalization,
  getProductCapitalizationOrganizations,
  getProductCapitalizationStoragesByOrganization,
  parseProductCapitalizationItemsFromFile,
  recordProductCapitalizationHistory,
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

const VENDOR_CODE_DEBOUNCE_MS = 280

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

type DraftItem = ProductCapitalizationItem & { __rowKey: string }

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

function toDraftItem(item: ProductCapitalizationItem): DraftItem {
  return { ...item, __rowKey: nextRowKey() }
}

function fromDraftItem({ __rowKey, ...item }: DraftItem): ProductCapitalizationItem {
  void __rowKey

  return {
    ...item,
    ProductId: item.ProductId || item.Product?.Id,
    Qty: toPositiveInteger(item.Qty),
    UnitPrice: toFiniteNumber(item.UnitPrice),
    Weight: toFiniteNumber(item.Weight),
  }
}

export type NewProductCapitalizationPanelProps = {
  opened: boolean
  onClose: () => void
  onCreated: () => void
}

export function NewProductCapitalizationPanel({ opened, onClose, onCreated }: NewProductCapitalizationPanelProps) {
  const { t } = useI18n()
  const model = useNewProductCapitalizationModel(opened, onClose, onCreated)
  const itemColumns = useItemColumns(model.items, model.updateItem, model.removeItem)

  return (
    <AppDrawer
      opened={opened}
      padding="lg"
      position="right"
      size="78rem"
      title={t('Нове оприбуткування')}
      onClose={model.requestClose}
    >
      <Stack gap="md">
        {model.error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {model.error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          <TextInput
            label={t('Коментар')}
            value={model.comment}
            onChange={(event) => model.setComment(event.currentTarget.value)}
          />
          <TextInput
            label={t('Дата')}
            type="datetime-local"
            value={model.fromDate}
            onChange={(event) => model.setFromDate(event.currentTarget.value)}
          />
          <Select
            data={model.organizationOptions}
            label={t('Організація')}
            searchable
            value={model.selectedOrganizationNetId}
            onChange={model.selectOrganization}
          />
          <Select
            data={model.storageOptions}
            disabled={!model.selectedOrganizationNetId || model.isLoadingStorages}
            label={t('Склад')}
            placeholder={model.isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
            searchable
            value={model.selectedStorageNetId}
            onChange={model.selectStorage}
          />
        </SimpleGrid>

        <Divider />

        <Group align="end" gap="sm" wrap="nowrap">
          <Autocomplete
            data={model.vendorCodeOptions}
            label={t('Артикул')}
            style={{ flex: 1.4 }}
            value={model.vendorCodeQuery}
            onChange={model.changeVendorCodeQuery}
            onOptionSubmit={model.selectVendorCode}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            label={t('Кількість')}
            min={1}
            style={{ flex: 1 }}
            value={model.itemEntry.quantity}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, quantity: toIntegerOrEmpty(value) }))}
          />
          <NumberInput
            allowNegative={false}
            label={t('Вага за одиницю')}
            min={0}
            style={{ flex: 1 }}
            value={model.itemEntry.weight}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, weight: toNumberOrEmpty(value) }))}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            label={t('Ціна за одиницю')}
            min={0}
            style={{ flex: 1 }}
            value={model.itemEntry.unitPrice}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, unitPrice: toNumberOrEmpty(value) }))}
          />
          <Button leftSection={<IconPlus size={16} />} mb={1} onClick={model.addItem}>
            {t('Додати рядок')}
          </Button>
        </Group>

        <Group justify="space-between">
          <Button
            leftSection={<IconFileSpreadsheet size={16} />}
            variant="light"
            onClick={model.openUploadModal}
          >
            {t('Імпорт з Excel')}
          </Button>
          <Button color="green" loading={model.isSubmitting} onClick={model.submit}>
            {t('Провести')}
          </Button>
        </Group>

        <DataTable
          columns={itemColumns}
          data={model.items}
          defaultLayout={ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Додайте хоча б один товар')}
          getRowId={(item) => item.__rowKey}
          layoutVersion="new-product-capitalization-items-1"
          maxHeight="calc(100vh - 360px)"
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
          onSubmit={model.parseFromFile}
        />
      )}

      <ProductCapitalizationMissingItemsModal
        items={model.missingVendorCodes}
        opened={model.missingModalOpened}
        onClose={() => model.setMissingModalOpened(false)}
      />

      <AppModal centered opened={model.confirmCloseOpen} title={t('Є незбережені зміни')} onClose={model.cancelClose}>
        <Stack gap="md">
          <Text>{t('Якщо закрити форму, документ оприбуткування не буде створено.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={model.cancelClose}>
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

    async function searchProducts() {
      try {
        const products = await searchProductsByVendorCode(query)

        if (!cancelled) {
          setSearchedProducts(products)
        }
      } catch {
        if (!cancelled) {
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
      setVendorCodeQuery(value)
      setSelectedProduct(null)

      if (!value.trim()) {
        setSearchedProducts([])
      }
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
    const product = resolveProductCapitalizationSelection(selectedProduct, searchedProducts, vendorCodeQuery)

    if (!product || !product.Id) {
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
      setItems((current) =>
        current.map((item) => (item.__rowKey === rowKey ? { ...item, [field]: value } : item)),
      )
    },
    [setItems],
  )

  const removeItem = useCallback(
    (rowKey: string) => {
      setItems((current) => current.filter((item) => item.__rowKey !== rowKey))
    },
    [setItems],
  )

  const openUploadModal = useCallback(() => {
    setUploadError(null)
    setUploadModalOpened(true)
  }, [setUploadError, setUploadModalOpened])

  const closeUploadModal = useCallback(() => {
    setUploadError(null)
    setUploadModalOpened(false)
  }, [setUploadError, setUploadModalOpened])

  const resetDraft = useCallback(() => {
    const nextFromDate = toDateTimeLocal(new Date())

    parseRequestRef.current += 1
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

  const parseFromFile = useCallback(
    async (file: File, parseConfiguration: ProductCapitalizationParseConfiguration) => {
      const requestId = parseRequestRef.current + 1
      parseRequestRef.current = requestId
      const isCurrentParse = () => parseRequestRef.current === requestId
      setParsing(true)
      setUploadError(null)

      try {
        const result = await parseProductCapitalizationItemsFromFile(file, parseConfiguration)

        if (isCurrentParse()) {
          setItems((current) => [...current, ...result.Items.map(toDraftItem)])
          setUploadModalOpened(false)
        }

        if (isCurrentParse() && result.MissingVendorCodes.length > 0) {
          setMissingVendorCodes(result.MissingVendorCodes)
          setMissingModalOpened(true)
        }
      } catch (parseError) {
        if (isCurrentParse()) {
          setUploadError(parseError instanceof Error ? parseError.message : t('Не вдалося розпізнати файл'))
        }
      } finally {
        if (isCurrentParse()) {
          setParsing(false)
        }
      }
    },
    [setItems, setMissingModalOpened, setMissingVendorCodes, setParsing, setUploadError, setUploadModalOpened, t],
  )

  const submit = useCallback(async () => {
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

    if (items.some((item) => toFiniteNumber(item.UnitPrice) <= 0)) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Ціна за одиницю')}` })
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

    setSubmitting(true)
    setError(null)

    try {
      const productCapitalization = await createProductCapitalization({
        Comment: comment,
        FromDate: new Date(fromDate).toISOString(),
        Organization: organization,
        ProductCapitalizationItems: items.map(fromDraftItem),
        Storage: storage,
      })

      if (isCurrentSubmit() && productCapitalization) {
        await recordHistoryUpdate(
          () => recordProductCapitalizationHistory(productCapitalization),
          t('Оприбуткування створено, але історію руху товару не оновлено'),
        )
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
    parseFromFile,
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

async function recordHistoryUpdate(record: () => Promise<void>, warningMessage: string): Promise<void> {
  try {
    await record()
  } catch {
    notifications.show({
      color: 'yellow',
      message: warningMessage,
    })
  }
}

function useItemColumns(
  items: DraftItem[],
  onUpdate: (rowKey: string, field: 'Qty' | 'UnitPrice' | 'Weight', value: number) => void,
  onRemove: (rowKey: string) => void,
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
        cell: (item) => String(items.findIndex((candidate) => candidate.__rowKey === item.__rowKey) + 1),
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 160,
        minWidth: 124,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => <Text fw={700}>{displayValue(item.Product?.VendorCode || item.ProductVendorCode)}</Text>,
      },
      {
        id: 'name',
        header: t('Найменування'),
        width: 320,
        minWidth: 220,
        accessor: (item) => item.Product?.Name,
        cell: (item) => (
          <Text fw={600} lineClamp={2}>
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
          <Tooltip label={t('Видалити')}>
            <ActionIcon
              aria-label={t('Видалити')}
              color="red"
              size="sm"
              variant="subtle"
              onClick={() => onRemove(item.__rowKey)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [items, onRemove, onUpdate, t],
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
