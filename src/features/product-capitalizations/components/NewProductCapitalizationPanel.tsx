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
import { useCallback, useEffect, useMemo } from 'react'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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
  searchProductsByVendorCode,
} from '../api/productCapitalizationsApi'
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

  return item
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
      onClose={onClose}
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
            disabled={!model.selectedOrganizationNetId}
            label={t('Склад')}
            placeholder={t('Оберіть склад')}
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
            allowNegative={false}
            label={t('Кількість')}
            min={0}
            style={{ flex: 1 }}
            value={model.itemEntry.quantity}
            onChange={(value) => model.setItemEntry((current) => ({ ...current, quantity: toNumberOrEmpty(value) }))}
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
            onClick={() => model.setUploadModalOpened(true)}
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

      <ProductCapitalizationUploadModal
        isSubmitting={model.isParsing}
        opened={model.uploadModalOpened}
        submitError={model.uploadError}
        onClose={() => model.setUploadModalOpened(false)}
        onSubmit={model.parseFromFile}
      />

      <ProductCapitalizationMissingItemsModal
        items={model.missingVendorCodes}
        opened={model.missingModalOpened}
        onClose={() => model.setMissingModalOpened(false)}
      />
    </AppDrawer>
  )
}

function useNewProductCapitalizationModel(opened: boolean, onClose: () => void, onCreated: () => void) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useValueState<ClientResourceOrganization[]>([])
  const [selectedOrganizationNetId, setSelectedOrganizationNetId] = useValueState<string | null>(null)
  const [storages, setStorages] = useValueState<ClientResourceStorage[]>([])
  const [selectedStorageNetId, setSelectedStorageNetId] = useValueState<string | null>(null)
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
  const [previousOpened, setPreviousOpened] = useValueState(opened)

  const resetState = useCallback(() => {
    setSelectedOrganizationNetId(null)
    setStorages([])
    setSelectedStorageNetId(null)
    setComment('')
    setFromDate(toDateTimeLocal(new Date()))
    setItems([])
    setItemEntry(EMPTY_ITEM_ENTRY)
    setSelectedProduct(null)
    setVendorCodeQuery('')
    setSearchedProducts([])
    setError(null)
    setUploadModalOpened(false)
    setUploadError(null)
    setMissingVendorCodes([])
    setMissingModalOpened(false)
  }, [
    setComment,
    setError,
    setFromDate,
    setItemEntry,
    setItems,
    setMissingModalOpened,
    setMissingVendorCodes,
    setSearchedProducts,
    setSelectedOrganizationNetId,
    setSelectedProduct,
    setSelectedStorageNetId,
    setStorages,
    setUploadError,
    setUploadModalOpened,
    setVendorCodeQuery,
  ])

  if (opened !== previousOpened) {
    setPreviousOpened(opened)

    if (opened) {
      resetState()
    }
  }

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
      return
    }

    let cancelled = false

    async function loadStorages() {
      try {
        const loadedStorages = await getProductCapitalizationStoragesByOrganization(selectedOrganizationNetId as string)

        if (cancelled) {
          return
        }

        setStorages(loadedStorages)
        setSelectedStorageNetId(loadedStorages.find((storage) => storage.NetUid)?.NetUid || null)
      } catch {
        if (!cancelled) {
          setError(t('Не вдалося завантажити склади'))
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [opened, selectedOrganizationNetId, setError, setSelectedStorageNetId, setStorages, t])

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
    () => organizations.filter((organization) => organization.NetUid).map(toSelectOption),
    [organizations],
  )
  const storageOptions = useMemo(
    () => storages.filter((storage) => storage.NetUid).map(toSelectOption),
    [storages],
  )
  const vendorCodeOptions = useMemo(
    () =>
      searchedProducts
        .map((product) => product.VendorCode)
        .filter((vendorCode): vendorCode is string => Boolean(vendorCode)),
    [searchedProducts],
  )

  const selectOrganization = useCallback(
    (value: string | null) => {
      setSelectedOrganizationNetId(value)
      setSelectedStorageNetId(null)
    },
    [setSelectedOrganizationNetId, setSelectedStorageNetId],
  )

  const selectStorage = useCallback(
    (value: string | null) => {
      setSelectedStorageNetId(value)
    },
    [setSelectedStorageNetId],
  )

  const changeVendorCodeQuery = useCallback(
    (value: string) => {
      setVendorCodeQuery(value)
      setSelectedProduct(null)
    },
    [setSelectedProduct, setVendorCodeQuery],
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
    if (!selectedProduct || !selectedProduct.Id) {
      notifications.show({ color: 'yellow', message: `${t('Заповніть поле')} - ${t('Артикул')}` })
      return
    }

    const quantity = toFiniteNumber(itemEntry.quantity)
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
        Id: selectedProduct.Id,
        Name: selectedProduct.Name,
        NetUid: selectedProduct.NetUid,
        VendorCode: selectedProduct.VendorCode,
      },
      ProductId: selectedProduct.Id,
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
    selectedProduct,
    setItemEntry,
    setItems,
    setSearchedProducts,
    setSelectedProduct,
    setVendorCodeQuery,
    t,
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

  const parseFromFile = useCallback(
    async (file: File, parseConfiguration: ProductCapitalizationParseConfiguration) => {
      setParsing(true)
      setUploadError(null)

      try {
        const result = await parseProductCapitalizationItemsFromFile(file, parseConfiguration)

        setItems((current) => [...current, ...result.Items.map(toDraftItem)])
        setUploadModalOpened(false)

        if (result.MissingVendorCodes.length > 0) {
          setMissingVendorCodes(result.MissingVendorCodes)
          setMissingModalOpened(true)
        }
      } catch (parseError) {
        setUploadError(parseError instanceof Error ? parseError.message : t('Не вдалося розпізнати файл'))
      } finally {
        setParsing(false)
      }
    },
    [setItems, setMissingModalOpened, setMissingVendorCodes, setParsing, setUploadError, setUploadModalOpened, t],
  )

  const submit = useCallback(async () => {
    if (items.length === 0) {
      notifications.show({ color: 'yellow', message: t('Додайте хоча б один товар') })
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
      await createProductCapitalization({
        Comment: comment,
        FromDate: new Date(fromDate).toISOString(),
        Organization: organization,
        ProductCapitalizationItems: items.map(fromDraftItem),
        Storage: storage,
      })

      notifications.show({ color: 'green', message: t('Оприбуткування створено') })
      onCreated()
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('Не вдалося створити оприбуткування'))
    } finally {
      setSubmitting(false)
    }
  }, [
    comment,
    fromDate,
    items,
    onClose,
    onCreated,
    organizations,
    selectedOrganizationNetId,
    selectedStorageNetId,
    setError,
    setSubmitting,
    storages,
    t,
  ])

  return {
    comment,
    error,
    fromDate,
    isParsing,
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
    parseFromFile,
    removeItem,
    selectOrganization,
    selectStorage,
    selectVendorCode,
    setComment,
    setFromDate,
    setItemEntry,
    setMissingModalOpened,
    setUploadModalOpened,
    submit,
    updateItem,
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
            allowNegative={false}
            hideControls
            min={0}
            size="xs"
            value={item.Qty ?? ''}
            onChange={(value) => onUpdate(item.__rowKey, 'Qty', toFiniteNumber(value))}
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

function toDateTimeLocal(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}

function toNumberOrEmpty(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : ''
}

function toFiniteNumber(value: number | string | undefined): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
