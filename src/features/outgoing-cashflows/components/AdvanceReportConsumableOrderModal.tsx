import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Divider,
  FileInput,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  calculateAdvanceReportConsumableOrder,
  searchAdvanceReportSupplyOrganizations,
} from '../api/advanceReportApi'
import type {
  AdvanceReportConsumablesOrder,
  AdvanceReportConsumablesOrderItem,
  AdvanceReportOrder,
  ConsumableProduct,
  ConsumableProductCategory,
  ConsumablesOrderDocument,
  ConsumablesStorage,
  PaymentCostMovement,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../advanceReportTypes'
import {
  getSupplyOrganizations,
  searchConsumableProductCategories,
  searchConsumableProductsByVendorCode,
  searchConsumableStorages,
  searchPaymentCostMovements,
} from '../../consumable-orders/api/consumableOrdersApi'

type FormState = {
  comment: string
  invoiceDate: string
  invoiceNumber: string
  invoiceTime: string
  selectedAgreementValue: string
  selectedStorageValue: string
  selectedSupplierValue: string
  storageSearch: string
  supplierSearch: string
}

type ItemEditorState = {
  articleSearch: string
  costMovementSearch: string
  error: string | null
  index: number | null
  item: AdvanceReportConsumablesOrderItem
  mode: 'create' | 'edit'
  opened: boolean
  productSearch: string
}

type EntityOptionSource = {
  Code?: string
  FullName?: string
  Id?: number
  LastName?: string
  Name?: string
  NetUid?: string
  Number?: string
  OperationName?: string
}

const SEARCH_DEBOUNCE_MS = 300

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function AdvanceReportConsumableOrderModal({
  onAdd,
  onClose,
  opened,
  outcomeOrder,
}: {
  onAdd: (order: AdvanceReportConsumablesOrder, documentFiles: File[]) => void
  onClose: () => void
  opened: boolean
  outcomeOrder: AdvanceReportOrder
}) {
  const { t } = useI18n()
  const [order, setOrder] = useValueState<AdvanceReportConsumablesOrder>(() => createEmptyOrder())
  const [form, setForm] = useValueState<FormState>(() => createEmptyForm())
  const [suppliers, setSuppliers] = useValueState<SupplyOrganization[]>([])
  const [storages, setStorages] = useValueState<ConsumablesStorage[]>([])
  const [itemEditor, setItemEditor] = useValueState<ItemEditorState>(() => createClosedItemEditor())
  const [documentFiles, setDocumentFiles] = useValueState<File[]>([])
  const [productOptions, setProductOptions] = useValueState<ConsumableProduct[]>([])
  const [costMovements, setCostMovements] = useValueState<PaymentCostMovement[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isCalculating, setCalculating] = useValueState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useValueState(false)
  const calcSeq = useRef(0)
  const initialFormRef = useRef<FormState | null>(null)
  const supplierSearchSeq = useRef(0)
  const storageSearchSeq = useRef(0)
  const productSearchSeq = useRef(0)
  const costMovementSearchSeq = useRef(0)

  if (initialFormRef.current === null) {
    initialFormRef.current = createEmptyForm()
  }

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => getEntityValue(supplier) === form.selectedSupplierValue) || null,
    [form.selectedSupplierValue, suppliers],
  )
  const agreementOptions = useMemo(
    () => toAgreementOptions(filterAgreementsForOutcome(selectedSupplier?.SupplyOrganizationAgreements || [], outcomeOrder)),
    [outcomeOrder, selectedSupplier],
  )
  const selectedAgreement = useMemo(
    () =>
      filterAgreementsForOutcome(selectedSupplier?.SupplyOrganizationAgreements || [], outcomeOrder).find(
        (agreement) => getEntityValue(agreement) === form.selectedAgreementValue,
      ) || null,
    [form.selectedAgreementValue, outcomeOrder, selectedSupplier],
  )
  const selectedStorage = useMemo(
    () => storages.find((storage) => getEntityValue(storage) === form.selectedStorageValue) || null,
    [form.selectedStorageValue, storages],
  )
  const activeItems = useMemo(() => order.ConsumablesOrderItems || [], [order.ConsumablesOrderItems])
  const visibleItemRows = useMemo(
    () =>
      activeItems.reduce<Array<{ index: number; item: AdvanceReportConsumablesOrderItem }>>((rows, item, index) => {
        if (!item.Deleted) {
          rows.push({ index, item })
        }

        return rows
      }, []),
    [activeItems],
  )
  const visibleItems = useMemo(() => visibleItemRows.map(({ item }) => item), [visibleItemRows])
  const totals = useMemo(() => calculateLocalTotals(visibleItems), [visibleItems])
  const supplierOptions = useMemo(() => toEntityOptions(suppliers), [suppliers])
  const storageOptions = useMemo(() => toEntityOptions(storages), [storages])
  const productAutocompleteOptions = useMemo(() => toProductOptions(productOptions), [productOptions])
  const costMovementOptions = useMemo(
    () => toEntityOptions(costMovements, (item) => item?.OperationName || ''),
    [costMovements],
  )
  const isBusy = isLoading || isCalculating

  const invalidatePendingRequests = useCallback(() => {
    calcSeq.current += 1
    supplierSearchSeq.current += 1
    storageSearchSeq.current += 1
    productSearchSeq.current += 1
    costMovementSearchSeq.current += 1
  }, [])

  const resetModalState = useCallback(() => {
    setOrder(createEmptyOrder())
    const nextForm = createEmptyForm()
    initialFormRef.current = nextForm
    setForm(nextForm)
    setError(null)
    setItemEditor(createClosedItemEditor())
    setDocumentFiles([])
    setConfirmCloseOpen(false)
    setCalculating(false)
    setProductOptions([])
    setCostMovements([])
    setLoading(true)
  }, [
    setCalculating,
    setConfirmCloseOpen,
    setCostMovements,
    setDocumentFiles,
    setError,
    setForm,
    setItemEditor,
    setLoading,
    setOrder,
    setProductOptions,
  ])

  useEffect(() => {
    invalidatePendingRequests()

    if (!opened) {
      return undefined
    }

    let cancelled = false

    resetModalState()

    async function loadSuppliers() {
      try {
        const nextSuppliers = await getSupplyOrganizations()

        if (!cancelled) {
          setSuppliers(nextSuppliers)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальників'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      invalidatePendingRequests()
      cancelled = true
    }
  }, [
    invalidatePendingRequests,
    opened,
    resetModalState,
    setError,
    setLoading,
    setSuppliers,
    t,
  ])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const value = form.supplierSearch.trim()
    const requestId = (supplierSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchAdvanceReportSupplyOrganizations(value, outcomeOrder.Organization?.NetUid)
        .then((nextSuppliers) => {
          if (supplierSearchSeq.current !== requestId) {
            return
          }

          setSuppliers((current) =>
            includeEntity(nextSuppliers, current.find((item) => getEntityValue(item) === form.selectedSupplierValue) || null),
          )
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.selectedSupplierValue, form.supplierSearch, opened, outcomeOrder.Organization?.NetUid, setSuppliers])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const value = form.storageSearch.trim()
    const requestId = (storageSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchConsumableStorages(value)
        .then((nextStorages) => {
          if (storageSearchSeq.current !== requestId) {
            return
          }

          setStorages((current) =>
            includeEntity(nextStorages, current.find((item) => getEntityValue(item) === form.selectedStorageValue) || null),
          )
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.selectedStorageValue, form.storageSearch, opened, setStorages])

  useEffect(() => {
    if (!itemEditor.opened) {
      return undefined
    }

    const value = itemEditor.productSearch.trim()
    const requestId = (productSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value || itemEditor.articleSearch.trim()) {
        return
      }

      void searchConsumableProductCategories(value)
        .then((categories) => {
          if (productSearchSeq.current === requestId) {
            setProductOptions(flattenConsumableProducts(categories))
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [itemEditor.articleSearch, itemEditor.opened, itemEditor.productSearch, setProductOptions])

  useEffect(() => {
    if (!itemEditor.opened) {
      return undefined
    }

    const value = itemEditor.articleSearch.trim()
    const requestId = (productSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchConsumableProductsByVendorCode(value)
        .then((nextProducts) => {
          if (productSearchSeq.current === requestId) {
            setProductOptions(nextProducts)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [itemEditor.articleSearch, itemEditor.opened, setProductOptions])

  useEffect(() => {
    if (!itemEditor.opened) {
      return undefined
    }

    const value = itemEditor.costMovementSearch.trim()
    const requestId = (costMovementSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchPaymentCostMovements(value)
        .then((nextMovements) => {
          if (costMovementSearchSeq.current === requestId) {
            setCostMovements(nextMovements)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [itemEditor.costMovementSearch, itemEditor.opened, setCostMovements])

  const recalculateOrder = useCallback(
    async (nextOrder: AdvanceReportConsumablesOrder) => {
      const normalizedOrder = normalizeOrderTotals(nextOrder)
      const seq = (calcSeq.current += 1)
      setCalculating(true)

      try {
        const calculated = await calculateAdvanceReportConsumableOrder(normalizedOrder)

        if (calcSeq.current === seq) {
          setOrder(calculated ? normalizeOrderTotals(calculated) : normalizedOrder)
        }
      } catch {
        if (calcSeq.current === seq) {
          setOrder(normalizedOrder)
        }
      } finally {
        if (calcSeq.current === seq) {
          setCalculating(false)
        }
      }
    },
    [setCalculating, setOrder],
  )

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleSupplierSubmit(value: string) {
    const supplier = suppliers.find((item) => getEntityValue(item) === value)

    if (!supplier) {
      return
    }

    updateForm({
      selectedAgreementValue: '',
      selectedSupplierValue: getEntityValue(supplier),
      supplierSearch: getEntityLabel(supplier),
    })
  }

  function handleStorageSubmit(value: string) {
    const storage = storages.find((item) => getEntityValue(item) === value)

    if (!storage) {
      return
    }

    updateForm({
      selectedStorageValue: getEntityValue(storage),
      storageSearch: getEntityLabel(storage),
    })
  }

  function openNewItemEditor() {
    if (isBusy) {
      return
    }

    setProductOptions([])
    setCostMovements([])
    setItemEditor({
      ...createClosedItemEditor(),
      item: createEmptyOrderItem(),
      mode: 'create',
      opened: true,
    })
  }

  function openEditItemEditor(item: AdvanceReportConsumablesOrderItem, index: number) {
    if (isBusy) {
      return
    }

    setProductOptions(item.ConsumableProduct ? [item.ConsumableProduct] : [])
    setCostMovements(item.PaymentCostMovementOperation?.PaymentCostMovement ? [item.PaymentCostMovementOperation.PaymentCostMovement] : [])
    setItemEditor({
      articleSearch: item.ConsumableProduct?.VendorCode || '',
      costMovementSearch: item.PaymentCostMovementOperation?.PaymentCostMovement?.OperationName || '',
      error: null,
      index,
      item: cloneOrderItem(item),
      mode: 'edit',
      opened: true,
      productSearch: item.ConsumableProduct?.Name || '',
    })
  }

  function closeItemEditor() {
    if (isBusy) {
      return
    }

    setItemEditor(createClosedItemEditor())
  }

  async function saveEditorItem() {
    if (isBusy) {
      return
    }

    const validationError = validateItem(itemEditor.item, t)

    if (validationError) {
      setItemEditor((current) => ({ ...current, error: validationError }))
      return
    }

    const item = normalizeCalculatedItem(itemEditor.item)
    const nextItems = [...activeItems]

    if (itemEditor.mode === 'edit' && itemEditor.index !== null) {
      nextItems[itemEditor.index] = item
    } else {
      nextItems.push({ ...item, Id: 0, NetUid: item.NetUid || createLocalId() })
    }

    closeItemEditor()
    await recalculateOrder({
      ...order,
      ConsumablesOrderItems: nextItems,
    })
  }

  async function removeItem(index: number) {
    if (isBusy) {
      return
    }

    await recalculateOrder({
      ...order,
      ConsumablesOrderItems: activeItems.filter((_, currentIndex) => currentIndex !== index),
    })
  }

  function updateEditorItem(patch: Partial<AdvanceReportConsumablesOrderItem>) {
    setItemEditor((current) => ({
      ...current,
      error: null,
      item: normalizeCalculatedItem({ ...current.item, ...patch }),
    }))
  }

  function handleProductSubmit(value: string) {
    const product = productOptions.find((item) => getEntityValue(item) === value)

    if (!product) {
      return
    }

    setItemEditor((current) => ({
      ...current,
      articleSearch: product.VendorCode || '',
      error: null,
      item: normalizeCalculatedItem({
        ...current.item,
        ConsumableProduct: product,
        ConsumableProductCategory: product.ConsumableProductCategory || current.item.ConsumableProductCategory,
      }),
      productSearch: product.Name || '',
    }))
  }

  function handleCostMovementSubmit(value: string) {
    const movement = costMovements.find((item) => getEntityValue(item) === value)

    if (!movement) {
      return
    }

    setItemEditor((current) => ({
      ...current,
      costMovementSearch: movement.OperationName || '',
      error: null,
      item: {
        ...current.item,
        PaymentCostMovementOperation: {
          ...(current.item.PaymentCostMovementOperation || {}),
          PaymentCostMovement: movement,
        },
      },
    }))
  }

  function submitOrder() {
    if (isBusy) {
      return
    }

    const formDateError = validateFormDates(form, t)

    if (formDateError) {
      setError(formDateError)
      return
    }

    const payload = buildOrderPayload({
      form,
      order,
      selectedAgreement,
      selectedStorage,
      selectedSupplier,
    })
    const validationError = validateOrderPayload(payload, outcomeOrder, t)

    if (validationError) {
      setError(validationError)
      return
    }

    onAdd(payload, documentFiles)
    onClose()
  }

  function requestClose() {
    if (isBusy) {
      return
    }

    if (hasConsumableOrderDraft(form, order, documentFiles, initialFormRef.current ?? createEmptyForm())) {
      setConfirmCloseOpen(true)
      return
    }

    onClose()
  }

  function confirmClose() {
    if (isBusy) {
      return
    }

    setConfirmCloseOpen(false)
    onClose()
  }

  function updateDocumentFiles(nextFiles: File[]) {
    setDocumentFiles(nextFiles)
    setOrder((current) => ({
      ...current,
      ConsumablesOrderDocuments: nextFiles.map(toConsumablesOrderDocument),
    }))
  }

  function addDocumentFiles(files: File[] | null) {
    if (!files?.length) {
      return
    }

    updateDocumentFiles(mergeDocumentFiles(documentFiles, files))
  }

  function removeDocumentFile(fileToRemove: File) {
    updateDocumentFiles(documentFiles.filter((file) => getFileKey(file) !== getFileKey(fileToRemove)))
  }

  return (
    <AppModal centered opened={opened} size="90vw" title={t('Додати товар / послугу')} onClose={requestClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <Autocomplete
            data={supplierOptions}
            disabled={isBusy}
            label={t('Постачальник послуг')}
            placeholder={t('Почніть вводити назву')}
            value={form.supplierSearch}
            onChange={(value) => updateForm({ selectedAgreementValue: '', selectedSupplierValue: '', supplierSearch: value })}
            onOptionSubmit={handleSupplierSubmit}
          />
          <Select
            data={agreementOptions}
            disabled={!selectedSupplier || isBusy}
            label={t('Договір')}
            placeholder={t('Оберіть договір')}
            searchable
            value={form.selectedAgreementValue || null}
            onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
          />
          <TextInput disabled label={t('Організація')} value={getEntityLabel(outcomeOrder.Organization)} />
          <TextInput
            disabled={isBusy}
            label={t('Номер накладної')}
            value={form.invoiceNumber}
            onChange={(event) => updateForm({ invoiceNumber: event.currentTarget.value })}
          />
          <TextInput
            disabled={isBusy}
            label={t('Дата входу')}
            type="date"
            value={form.invoiceDate}
            onChange={(event) => updateForm({ invoiceDate: event.currentTarget.value })}
          />
          <TextInput
            disabled={isBusy}
            label={t('Час')}
            type="time"
            value={form.invoiceTime}
            onChange={(event) => updateForm({ invoiceTime: event.currentTarget.value })}
          />
          <Autocomplete
            data={storageOptions}
            disabled={isBusy}
            label={t('Склад')}
            placeholder={t('Почніть вводити склад')}
            value={form.storageSearch}
            onChange={(value) => updateForm({ selectedStorageValue: '', storageSearch: value })}
            onOptionSubmit={handleStorageSubmit}
          />
          <Textarea
            autosize
            disabled={isBusy}
            label={t('Коментар')}
            minRows={1}
            value={form.comment}
            onChange={(event) => updateForm({ comment: event.currentTarget.value })}
          />
          <FileInput
            clearable
            disabled={isBusy}
            label={t('Документи')}
            multiple
            placeholder={t('Завантажити файли')}
            value={[]}
            onChange={addDocumentFiles}
          />
        </SimpleGrid>

        {documentFiles.length > 0 && (
          <Stack gap={4}>
            {documentFiles.map((file) => (
              <Group key={getFileKey(file)} gap="xs" justify="space-between" wrap="nowrap">
                <Text size="sm">{file.name}</Text>
                <Tooltip label={t('Видалити')}>
                  <ActionIcon
                    aria-label={t('Видалити')}
                    color="red"
                    disabled={isBusy}
                    size="sm"
                    variant="subtle"
                    onClick={() => removeDocumentFile(file)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}

        <Divider />

        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={700}>{t('Позиції')}</Text>
            <Badge color="gray" variant="light">
              {visibleItems.length}
            </Badge>
          </Group>
          <Button disabled={isBusy} leftSection={<IconPlus size={16} />} variant="light" onClick={openNewItemEditor}>
            {t('Додати')}
          </Button>
        </Group>

        <Table.ScrollContainer minWidth={980}>
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Артикул')}</Table.Th>
                <Table.Th>{t('Назва')}</Table.Th>
                <Table.Th>{t('Категорія')}</Table.Th>
                <Table.Th>{t('Кількість')}</Table.Th>
                <Table.Th>{t('Ціна')}</Table.Th>
                <Table.Th>{t('Сума')}</Table.Th>
                <Table.Th>{t('ПДВ %')}</Table.Th>
                <Table.Th>{t('ПДВ')}</Table.Th>
                <Table.Th>{t('Разом')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleItemRows.length > 0 ? (
                visibleItemRows.map(({ index, item }) => (
                  <Table.Tr key={getItemKey(item, index)}>
                    <Table.Td>{displayValue(item.ConsumableProduct?.VendorCode)}</Table.Td>
                    <Table.Td>{displayValue(item.ConsumableProduct?.Name)}</Table.Td>
                    <Table.Td>
                      {displayValue(item.ConsumableProductCategory?.Name || item.ConsumableProduct?.ConsumableProductCategory?.Name)}
                    </Table.Td>
                    <Table.Td>
                      {formatAmount(item.Qty)} {item.ConsumableProduct?.MeasureUnit?.Name || ''}
                    </Table.Td>
                    <Table.Td>{formatMoney(item.PricePerItem)}</Table.Td>
                    <Table.Td>{formatMoney(item.TotalPrice)}</Table.Td>
                    <Table.Td>{formatAmount(item.VatPercent)}</Table.Td>
                    <Table.Td>{formatMoney(item.VAT)}</Table.Td>
                    <Table.Td>{formatMoney(item.TotalPriceWithVAT)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label={t('Редагувати')}>
                          <ActionIcon
                            aria-label={t('Редагувати')}
                            disabled={isBusy}
                            size="sm"
                            variant="subtle"
                            onClick={() => openEditItemEditor(item, index)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('Видалити')}>
                          <ActionIcon
                            aria-label={t('Видалити')}
                            color="red"
                            disabled={isBusy}
                            size="sm"
                            variant="subtle"
                            onClick={() => void removeItem(index)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={10}>
                    <Text c="dimmed" ta="center">
                      {t('Позицій немає')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Badge color="gray" variant="light">
              {t('Сума')}: {formatMoney(order.TotalAmountWithoutVAT ?? totals.totalWithoutVat)}
            </Badge>
            <Badge color="gray" variant="light">
              {t('ПДВ')}: {formatMoney(totals.vat)}
            </Badge>
            <Badge color="blue" variant="light">
              {t('Разом')}: {formatMoney(order.TotalAmount ?? totals.totalWithVat)}
            </Badge>
          </Group>
          <Group justify="flex-end">
            <Button color="gray" disabled={isBusy} leftSection={<IconX size={16} />} variant="light" onClick={requestClose}>
              {t('Скасувати')}
            </Button>
            <Button disabled={isBusy} leftSection={<IconDeviceFloppy size={16} />} loading={isCalculating} onClick={submitOrder}>
              {t('Додати')}
            </Button>
          </Group>
        </Group>

        <AppModal
          centered
          opened={itemEditor.opened}
          size="xl"
          title={itemEditor.mode === 'edit' ? t('Редагувати позицію') : t('Додати позицію')}
          onClose={closeItemEditor}
        >
          <Stack gap="md">
            {itemEditor.error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {itemEditor.error}
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Autocomplete
                data={productAutocompleteOptions}
                disabled={isBusy}
                label={t('Назва товару / послуги')}
                value={itemEditor.productSearch}
                onChange={(value) => {
                  setItemEditor((current) => ({
                    ...current,
                    item: clearEditorProduct(current.item),
                    productSearch: value,
                  }))
                }}
                onOptionSubmit={handleProductSubmit}
              />
              <Autocomplete
                data={productAutocompleteOptions}
                disabled={isBusy}
                label={t('Артикул')}
                value={itemEditor.articleSearch}
                onChange={(value) => {
                  setItemEditor((current) => ({
                    ...current,
                    articleSearch: value,
                    item: clearEditorProduct(current.item),
                  }))
                }}
                onOptionSubmit={handleProductSubmit}
              />
              <TextInput
                disabled
                label={t('Категорія')}
                value={itemEditor.item.ConsumableProductCategory?.Name || itemEditor.item.ConsumableProduct?.ConsumableProductCategory?.Name || ''}
              />
              <Autocomplete
                data={costMovementOptions}
                disabled={isBusy}
                label={t('Стаття витрат')}
                value={itemEditor.costMovementSearch}
                onChange={(value) => {
                  setItemEditor((current) => ({
                    ...current,
                    costMovementSearch: value,
                    item: {
                      ...current.item,
                      PaymentCostMovementOperation: null,
                    },
                  }))
                }}
                onOptionSubmit={handleCostMovementSubmit}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={3}
                disabled={isBusy}
                label={t('Кількість')}
                min={0}
                rightSection={<Text c="dimmed" size="xs">{itemEditor.item.ConsumableProduct?.MeasureUnit?.Name}</Text>}
                value={itemEditor.item.Qty || 0}
                onChange={(value) => updateEditorItem({ Qty: toNumber(value) })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={3}
                disabled={isBusy}
                label={t('Ціна за одиницю')}
                min={0}
                value={itemEditor.item.PricePerItem || 0}
                onChange={(value) => updateEditorItem({ PricePerItem: toNumber(value), TotalPriceWithVAT: undefined })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                disabled={isBusy}
                label={`${t('ПДВ')} %`}
                min={0}
                value={itemEditor.item.VatPercent || 0}
                onChange={(value) => updateEditorItem({ VatPercent: toNumber(value) })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                disabled={isBusy}
                label={t('Разом з ПДВ')}
                min={0}
                value={itemEditor.item.TotalPriceWithVAT || 0}
                onChange={(value) => updateEditorItem({ PricePerItem: 0, TotalPriceWithVAT: toNumber(value) })}
              />
            </SimpleGrid>

            <Group justify="flex-end">
              <Button color="gray" disabled={isBusy} leftSection={<IconX size={16} />} variant="light" onClick={closeItemEditor}>
                {t('Скасувати')}
              </Button>
              <Button disabled={isBusy} leftSection={<IconDeviceFloppy size={16} />} onClick={() => void saveEditorItem()}>
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </AppModal>

        <AppModal
          centered
          opened={confirmCloseOpen}
          title={t('Є незбережені зміни')}
          onClose={() => {
            if (!isBusy) {
              setConfirmCloseOpen(false)
            }
          }}
        >
          <Stack gap="md">
            <Text>{t('Якщо закрити форму, введені дані не будуть додані до авансового звіту.')}</Text>
            <Group justify="flex-end">
              <Button color="gray" disabled={isBusy} variant="light" onClick={() => setConfirmCloseOpen(false)}>
                {t('Залишитися')}
              </Button>
              <Button color="red" disabled={isBusy} onClick={confirmClose}>
                {t('Закрити без збереження')}
              </Button>
            </Group>
          </Stack>
        </AppModal>
      </Stack>
    </AppModal>
  )
}

function createEmptyOrder(): AdvanceReportConsumablesOrder {
  return {
    ConsumablesOrderDocuments: [],
    ConsumablesOrderItems: [],
    OutcomePaymentOrderConsumablesOrders: [],
  }
}

function createEmptyForm(): FormState {
  return {
    comment: '',
    invoiceDate: formatLocalDate(new Date()),
    invoiceNumber: '',
    invoiceTime: toTimeValue(new Date()),
    selectedAgreementValue: '',
    selectedStorageValue: '',
    selectedSupplierValue: '',
    storageSearch: '',
    supplierSearch: '',
  }
}

function hasConsumableOrderDraft(
  form: FormState,
  order: AdvanceReportConsumablesOrder,
  documentFiles: File[],
  initialForm: FormState,
): boolean {
  return (
    Boolean(form.comment.trim()) ||
    form.invoiceDate !== initialForm.invoiceDate ||
    form.invoiceTime !== initialForm.invoiceTime ||
    Boolean(form.invoiceNumber.trim()) ||
    Boolean(form.selectedAgreementValue) ||
    Boolean(form.selectedStorageValue) ||
    Boolean(form.selectedSupplierValue) ||
    Boolean(form.storageSearch.trim()) ||
    Boolean(form.supplierSearch.trim()) ||
    documentFiles.length > 0 ||
    (order.ConsumablesOrderItems || []).some((item) => !item.Deleted)
  )
}

function createEmptyOrderItem(): AdvanceReportConsumablesOrderItem {
  return normalizeCalculatedItem({
    ConsumableProduct: null,
    ConsumableProductCategory: null,
    PaymentCostMovementOperation: null,
    PricePerItem: 0,
    Qty: 1,
    TotalPrice: 0,
    TotalPriceWithVAT: 0,
    VAT: 0,
    VatPercent: 0,
  })
}

function createClosedItemEditor(): ItemEditorState {
  return {
    articleSearch: '',
    costMovementSearch: '',
    error: null,
    index: null,
    item: createEmptyOrderItem(),
    mode: 'create',
    opened: false,
    productSearch: '',
  }
}

function toConsumablesOrderDocument(file: File): ConsumablesOrderDocument {
  return {
    ContentType: file.type,
    FileName: file.name,
    Id: 0,
  }
}

function mergeDocumentFiles(currentFiles: File[], nextFiles: File[]): File[] {
  const filesByKey = new Map(currentFiles.map((file) => [getFileKey(file), file]))

  nextFiles.forEach((file) => filesByKey.set(getFileKey(file), file))

  return Array.from(filesByKey.values())
}

function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function buildOrderPayload({
  form,
  order,
  selectedAgreement,
  selectedStorage,
  selectedSupplier,
}: {
  form: FormState
  order: AdvanceReportConsumablesOrder
  selectedAgreement: SupplyOrganizationAgreement | null
  selectedStorage: ConsumablesStorage | null
  selectedSupplier: SupplyOrganization | null
}): AdvanceReportConsumablesOrder {
  const normalizedOrder = normalizeOrderTotals(order)

  return {
    ...normalizedOrder,
    Comment: form.comment.trim(),
    ConsumableProductOrganization: selectedSupplier,
    ConsumablesStorage: selectedStorage,
    Id: normalizedOrder.Id || 0,
    OrganizationFromDate: toIsoDateTime(form.invoiceDate, form.invoiceTime),
    OrganizationNumber: form.invoiceNumber.trim(),
    SupplyOrganizationAgreement: selectedAgreement,
    ConsumablesOrderItems: (normalizedOrder.ConsumablesOrderItems || []).map((item) => ({
      ...normalizeCalculatedItem(item),
      ConsumableProductOrganization: selectedSupplier,
      Id: item.Id === -1 ? 0 : item.Id || 0,
      SupplyOrganizationAgreement: selectedAgreement,
    })),
  }
}

function validateOrderPayload(
  order: AdvanceReportConsumablesOrder,
  outcomeOrder: AdvanceReportOrder,
  t: (value: string) => string,
): string | null {
  if (!order.ConsumableProductOrganization) {
    return t('Оберіть постачальника послуг')
  }

  if (!order.SupplyOrganizationAgreement?.Organization) {
    return t('Оберіть договір з організацією')
  }

  if (
    outcomeOrder.Organization?.NetUid &&
    order.SupplyOrganizationAgreement.Organization.NetUid !== outcomeOrder.Organization.NetUid
  ) {
    return t('Договір має бути для організації авансового звіту')
  }

  if (!order.ConsumablesStorage) {
    return t('Оберіть склад')
  }

  if (!(order.ConsumablesOrderItems || []).some((item) => !item.Deleted)) {
    return t('Додайте хоча б одну позицію')
  }

  return null
}

function validateFormDates(form: FormState, t: (value: string) => string): string | null {
  if (!isValidDateInput(form.invoiceDate)) {
    return t('Вкажіть дату входу')
  }

  if (!isValidTimeInput(form.invoiceTime)) {
    return t('Вкажіть час накладної')
  }

  return null
}

function validateItem(item: AdvanceReportConsumablesOrderItem, t: (value: string) => string): string | null {
  if (!item.ConsumableProduct) {
    return t('Оберіть товар або послугу')
  }

  if (!item.ConsumableProductCategory && !item.ConsumableProduct.ConsumableProductCategory) {
    return t('Оберіть товар з категорією')
  }

  if (!item.PaymentCostMovementOperation?.PaymentCostMovement) {
    return t('Оберіть статтю витрат')
  }

  if (!item.Qty || item.Qty <= 0) {
    return t('Вкажіть кількість')
  }

  if (!item.TotalPriceWithVAT || item.TotalPriceWithVAT <= 0) {
    return t('Вкажіть суму')
  }

  return null
}

function normalizeOrderTotals(order: AdvanceReportConsumablesOrder): AdvanceReportConsumablesOrder {
  const items = (order.ConsumablesOrderItems || []).map(normalizeCalculatedItem)
  const totals = calculateLocalTotals(items.filter((item) => !item.Deleted))

  return {
    ...order,
    ConsumablesOrderItems: items,
    TotalAmount: totals.totalWithVat,
    TotalAmountWithoutVAT: totals.totalWithoutVat,
  }
}

function normalizeCalculatedItem(item: AdvanceReportConsumablesOrderItem): AdvanceReportConsumablesOrderItem {
  const qty = item.Qty || 0
  const vatPercent = item.VatPercent || 0
  let pricePerItem = item.PricePerItem || 0
  let totalWithVat = item.TotalPriceWithVAT || 0
  let vatAmount = item.VAT || 0

  if (pricePerItem > 0 && qty > 0) {
    totalWithVat = roundMoney(pricePerItem * qty)
  } else if (totalWithVat > 0) {
    pricePerItem = qty > 0 ? roundMoney(totalWithVat / qty) : totalWithVat
  }

  if (vatPercent > 0) {
    vatAmount = roundMoney((totalWithVat * vatPercent) / (100 + vatPercent))
  }

  const totalWithoutVat = roundMoney(totalWithVat - vatAmount)

  if (vatPercent === 0 && vatAmount > 0 && totalWithoutVat > 0) {
    return {
      ...item,
      PricePerItem: pricePerItem,
      Qty: qty,
      TotalPrice: totalWithoutVat,
      TotalPriceWithVAT: totalWithVat,
      VAT: vatAmount,
      VatPercent: roundMoney((vatAmount / totalWithoutVat) * 100),
    }
  }

  return {
    ...item,
    PricePerItem: pricePerItem,
    Qty: qty,
    TotalPrice: totalWithoutVat,
    TotalPriceWithVAT: totalWithVat,
    VAT: vatAmount,
    VatPercent: vatPercent,
  }
}

function calculateLocalTotals(items: AdvanceReportConsumablesOrderItem[]) {
  return items.reduce(
    (total, item) => ({
      totalWithVat: total.totalWithVat + (item.TotalPriceWithVAT || 0),
      totalWithoutVat: total.totalWithoutVat + (item.TotalPrice || 0),
      vat: total.vat + (item.VAT || 0),
    }),
    { totalWithVat: 0, totalWithoutVat: 0, vat: 0 },
  )
}

function flattenConsumableProducts(categories: ConsumableProductCategory[]): ConsumableProduct[] {
  return categories.flatMap((category) =>
    (category.ConsumableProducts || []).map((product) => ({
      ...product,
      ConsumableProductCategory: product.ConsumableProductCategory || {
        ...category,
        ConsumableProducts: undefined,
      },
    })),
  )
}

function filterAgreementsForOutcome(
  agreements: SupplyOrganizationAgreement[],
  outcomeOrder: AdvanceReportOrder,
): SupplyOrganizationAgreement[] {
  const organizationNetUid = outcomeOrder.Organization?.NetUid

  if (!organizationNetUid) {
    return agreements
  }

  return agreements.filter((agreement) => agreement.Organization?.NetUid === organizationNetUid)
}

function toEntityOptions<T extends EntityOptionSource>(
  entities: T[],
  labelGetter: (entity: T) => string = (entity) => getEntityLabel(entity),
) {
  return entities.reduce<Array<{ label: string; value: string }>>((options, entity) => {
    const value = getEntityValue(entity)

    if (!value) {
      return options
    }

    options.push({
      label: labelGetter(entity) || value,
      value,
    })

    return options
  }, [])
}

function toProductOptions(products: ConsumableProduct[]) {
  return products.reduce<Array<{ label: string; value: string }>>((options, product) => {
    const value = getEntityValue(product)

    if (!value) {
      return options
    }

    const label = [product.VendorCode, product.Name].filter(Boolean).join(' - ')

    options.push({
      label: label || value,
      value,
    })

    return options
  }, [])
}

function toAgreementOptions(agreements: SupplyOrganizationAgreement[]) {
  return agreements.reduce<Array<{ label: string; value: string }>>((options, agreement) => {
    const value = getEntityValue(agreement)

    if (!value) {
      return options
    }

    const parts = [agreement.Name || agreement.Number, agreement.Currency?.Code || agreement.Currency?.Name, agreement.Organization?.Name].filter(Boolean)

    options.push({
      label: parts.join(' / ') || value,
      value,
    })

    return options
  }, [])
}

function includeEntity<T extends EntityOptionSource>(entities: T[], entity: T | null): T[] {
  if (!entity) {
    return entities
  }

  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function cloneOrderItem(item: AdvanceReportConsumablesOrderItem): AdvanceReportConsumablesOrderItem {
  return {
    ...item,
    ConsumableProduct: item.ConsumableProduct ? { ...item.ConsumableProduct } : null,
    ConsumableProductCategory: item.ConsumableProductCategory ? { ...item.ConsumableProductCategory } : null,
    PaymentCostMovementOperation: item.PaymentCostMovementOperation
      ? {
          ...item.PaymentCostMovementOperation,
          PaymentCostMovement: item.PaymentCostMovementOperation.PaymentCostMovement
            ? { ...item.PaymentCostMovementOperation.PaymentCostMovement }
            : null,
        }
      : null,
  }
}

function clearEditorProduct(item: AdvanceReportConsumablesOrderItem): AdvanceReportConsumablesOrderItem {
  return {
    ...item,
    ConsumableProduct: null,
    ConsumableProductCategory: null,
  }
}

function getEntityValue(entity?: EntityOptionSource | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityLabel(entity?: EntityOptionSource | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

function getItemKey(item: AdvanceReportConsumablesOrderItem, index: number): string {
  return String(item.NetUid || item.Id || `${item.ConsumableProduct?.NetUid || item.ConsumableProduct?.Id || 'item'}-${index}`)
}

function createLocalId(): string {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function toIsoDateTime(dateValue: string, timeValue: string): string {
  return formatLocalInputDateTime(dateValue, timeValue)
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}

function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string): string {
  return value ? value : '—'
}
