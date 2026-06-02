import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRestore,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { calculateConsumableOrderItemTotals } from '../consumableOrderCalculations'
import {
  calculateConsumableOrder,
  createConsumableOrder,
  getConsumableOrder,
  getFinanceDirectorUsers,
  getSupplyOrganizations,
  searchConsumableProductCategories,
  searchConsumableProductsByVendorCode,
  searchConsumableStorages,
  searchPaymentCostMovements,
  searchSupplyOrganizations,
  updateConsumableOrder,
} from '../api/consumableOrdersApi'
import type {
  ConsumableProduct,
  ConsumableProductCategory,
  ConsumablesOrder,
  ConsumablesOrderDocument,
  ConsumablesOrderItem,
  ConsumablesStorage,
  NamedEntity,
  PaymentCostMovement,
  SupplyOrganization,
  SupplyOrganizationAgreement,
  User,
} from '../types'

type LocationState = {
  returnPath?: string
}

type FormState = {
  comment: string
  invoiceDate: string
  invoiceNumber: string
  invoiceTime: string
  paymentTaskComment: string
  paymentTaskEnabled: boolean
  paymentTaskPayToDate: string
  responsibleUserValue: string
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
  item: ConsumablesOrderItem
  mode: 'create' | 'edit'
  opened: boolean
  productSearch: string
}

type SelectOption = {
  label: string
  value: string
}

const ORDERS_PATH = '/accounting/consumable-orders'
const SEARCH_DEBOUNCE_MS = 300

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function ConsumableOrderFormPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ORDERS_PATH
  const isEditMode = Boolean(id)
  const [order, setOrder] = useValueState<ConsumablesOrder>(() => createEmptyOrder())
  const [form, setForm] = useValueState<FormState>(() => createEmptyForm())
  const [suppliers, setSuppliers] = useValueState<SupplyOrganization[]>([])
  const [storages, setStorages] = useValueState<ConsumablesStorage[]>([])
  const [responsibleUsers, setResponsibleUsers] = useValueState<User[]>([])
  const [newDocuments, setNewDocuments] = useValueState<File[]>([])
  const [itemEditor, setItemEditor] = useValueState<ItemEditorState>(() => createClosedItemEditor())
  const [productOptions, setProductOptions] = useValueState<ConsumableProduct[]>([])
  const [costMovements, setCostMovements] = useValueState<PaymentCostMovement[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isCalculating, setCalculating] = useValueState(false)
  const recalculateRequestRef = useRef(0)
  const searchRequestRef = useRef<Record<string, number>>({})

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => getEntityValue(supplier) === form.selectedSupplierValue) || null,
    [form.selectedSupplierValue, suppliers],
  )
  const agreementOptions = useMemo(() => toAgreementOptions(selectedSupplier?.SupplyOrganizationAgreements || []), [selectedSupplier])
  const selectedAgreement = useMemo(
    () =>
      (selectedSupplier?.SupplyOrganizationAgreements || []).find(
        (agreement) => getEntityValue(agreement) === form.selectedAgreementValue,
      ) || null,
    [form.selectedAgreementValue, selectedSupplier],
  )
  const selectedStorage = useMemo(
    () => storages.find((storage) => getEntityValue(storage) === form.selectedStorageValue) || null,
    [form.selectedStorageValue, storages],
  )
  const selectedResponsibleUser = useMemo(
    () => responsibleUsers.find((user) => getEntityValue(user) === form.responsibleUserValue) || null,
    [form.responsibleUserValue, responsibleUsers],
  )
  const activeItems = useMemo(() => order.ConsumablesOrderItems || [], [order.ConsumablesOrderItems])
  const visibleItems = useMemo(() => activeItems.filter((item) => !item.Deleted), [activeItems])
  const totals = useMemo(() => calculateLocalTotals(visibleItems), [visibleItems])
  const isPaid = Boolean(order.IsPayed)
  const isFormLocked = isLoading || isSaving || isCalculating
  const isMutationLocked = isSaving || isCalculating
  const canSave = !isFormLocked

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      setLoading(true)
      setError(null)

      try {
        const [nextUsers, nextSuppliers, nextOrder] = await Promise.all([
          getFinanceDirectorUsers(),
          getSupplyOrganizations(),
          id ? getConsumableOrder(id) : Promise.resolve(null),
        ])

        if (cancelled) {
          return
        }

        const initialOrder = nextOrder || createEmptyOrder()
        const currentSupplier = normalizeSupplyOrganization(initialOrder.ConsumableProductOrganization)
        const currentAgreement = initialOrder.SupplyOrganizationAgreement || null
        const nextSuppliersWithCurrentAgreement = includeSupplierAgreement(nextSuppliers, currentSupplier, currentAgreement)
        const initialSupplier =
          (currentSupplier && nextSuppliersWithCurrentAgreement.find((supplier) => getEntityValue(supplier) === getEntityValue(currentSupplier))) ||
          nextSuppliersWithCurrentAgreement[0] ||
          null
        const initialAgreement = currentAgreement || initialSupplier?.SupplyOrganizationAgreements?.[0] || null
        const initialStorage = initialOrder.ConsumablesStorage || null
        const initialResponsibleUser = initialOrder.SupplyPaymentTask?.User || nextUsers[0] || null

        setOrder(normalizeOrderForForm(initialOrder))
        setSuppliers(nextSuppliersWithCurrentAgreement)
        setStorages(initialStorage ? [initialStorage] : [])
        setResponsibleUsers(includeEntity(nextUsers, initialResponsibleUser))
        setForm(toFormState(initialOrder, initialSupplier, initialAgreement, initialStorage, initialResponsibleUser))
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити накладну'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialData()

    return () => {
      cancelled = true
    }
  }, [id, setError, setForm, setLoading, setOrder, setResponsibleUsers, setStorages, setSuppliers, t])

  useEffect(() => {
    const value = form.supplierSearch.trim()
    const requestId = (searchRequestRef.current.supplier || 0) + 1
    searchRequestRef.current.supplier = requestId
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchSupplyOrganizations(value).then((nextSuppliers) => {
        if (searchRequestRef.current.supplier === requestId) {
          setSuppliers((current) => includeEntity(nextSuppliers, current.find((item) => getEntityValue(item) === form.selectedSupplierValue) || null))
        }
      }).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.selectedSupplierValue, form.supplierSearch, setSuppliers])

  useEffect(() => {
    const value = form.storageSearch.trim()
    const requestId = (searchRequestRef.current.storage || 0) + 1
    searchRequestRef.current.storage = requestId
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchConsumableStorages(value).then((nextStorages) => {
        if (searchRequestRef.current.storage === requestId) {
          setStorages((current) => includeEntity(nextStorages, current.find((item) => getEntityValue(item) === form.selectedStorageValue) || null))
        }
      }).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.selectedStorageValue, form.storageSearch, setStorages])

  useEffect(() => {
    if (!itemEditor.opened) {
      return undefined
    }

    const value = itemEditor.productSearch.trim()
    const requestId = (searchRequestRef.current.productName || 0) + 1
    searchRequestRef.current.productName = requestId
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchConsumableProductCategories(value).then((categories) => {
        if (searchRequestRef.current.productName === requestId) {
          setProductOptions(flattenConsumableProducts(categories))
        }
      }).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [itemEditor.opened, itemEditor.productSearch, setProductOptions])

  useEffect(() => {
    if (!itemEditor.opened) {
      return undefined
    }

    const value = itemEditor.articleSearch.trim()
    const requestId = (searchRequestRef.current.productArticle || 0) + 1
    searchRequestRef.current.productArticle = requestId
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchConsumableProductsByVendorCode(value).then((nextProducts) => {
        if (searchRequestRef.current.productArticle === requestId) {
          setProductOptions(nextProducts)
        }
      }).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [itemEditor.articleSearch, itemEditor.opened, setProductOptions])

  useEffect(() => {
    if (!itemEditor.opened) {
      return undefined
    }

    const value = itemEditor.costMovementSearch.trim()
    const requestId = (searchRequestRef.current.costMovement || 0) + 1
    searchRequestRef.current.costMovement = requestId
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchPaymentCostMovements(value).then((nextMovements) => {
        if (searchRequestRef.current.costMovement === requestId) {
          setCostMovements(nextMovements)
        }
      }).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [itemEditor.costMovementSearch, itemEditor.opened, setCostMovements])

  const recalculateOrder = useCallback(
    async (nextOrder: ConsumablesOrder) => {
      const requestId = recalculateRequestRef.current + 1
      recalculateRequestRef.current = requestId
      setCalculating(true)

      try {
        const calculation = await calculateConsumableOrder(nextOrder)
        const calculatedOrder = calculation.Collection[0]
        if (recalculateRequestRef.current === requestId) {
          setOrder(calculatedOrder ? normalizeOrderForForm(calculatedOrder) : nextOrder)
        }
      } catch {
        if (recalculateRequestRef.current === requestId) {
          setOrder(nextOrder)
        }
      } finally {
        if (recalculateRequestRef.current === requestId) {
          setCalculating(false)
        }
      }
    },
    [setCalculating, setOrder],
  )

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleCancel() {
    if (isMutationLocked) {
      return
    }

    navigate(returnPath, { replace: true })
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

  function handleFilesAdded(files: File[] | null) {
    if (!files?.length) {
      return
    }

    setNewDocuments((current) => [...current, ...files])
    setOrder((current) => ({
      ...current,
      ConsumablesOrderDocuments: [
        ...(current.ConsumablesOrderDocuments || []),
        ...files.map((file) => ({
          ContentType: file.type,
          FileName: file.name,
          NetUid: createLocalId(),
        })),
      ],
    }))
  }

  function toggleDocumentDeleted(document: ConsumablesOrderDocument) {
    setOrder((current) => {
      const documents = current.ConsumablesOrderDocuments || []

      if (!document.Id && document.NetUid) {
        setNewDocuments((files) => removeFirstMatchingFile(files, document))

        return {
          ...current,
          ConsumablesOrderDocuments: documents.filter((item) => item.NetUid !== document.NetUid),
        }
      }

      return {
        ...current,
        ConsumablesOrderDocuments: documents.map((item) =>
          isSameDocument(item, document) ? { ...item, Deleted: !item.Deleted } : item,
        ),
      }
    })
  }

  function openNewItemEditor() {
    if (isPaid || isMutationLocked) {
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

  function openEditItemEditor(item: ConsumablesOrderItem, index: number) {
    if (isPaid || item.Deleted || isMutationLocked) {
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
    if (isMutationLocked) {
      return
    }

    setItemEditor(createClosedItemEditor())
  }

  async function saveEditorItem() {
    if (isMutationLocked) {
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
      nextItems.push({ ...item, Id: -1, NetUid: item.NetUid || createLocalId() })
    }

    const nextOrder = {
      ...order,
      ConsumablesOrderItems: nextItems,
    }

    closeItemEditor()
    await recalculateOrder(nextOrder)
  }

  async function toggleItemDeleted(item: ConsumablesOrderItem, index: number) {
    if (isMutationLocked) {
      return
    }

    const nextItems = toggleDeletedItemAtIndex(activeItems, index)

    const nextOrder = {
      ...order,
      ConsumablesOrderItems: nextItems,
    }

    if (item.Deleted) {
      setOrder(nextOrder)
      return
    }

    await recalculateOrder(nextOrder)
  }

  function updateEditorItem(patch: Partial<ConsumablesOrderItem>) {
    setItemEditor((current) => {
      const nextItem = normalizeCalculatedItem({ ...current.item, ...patch })

      return {
        ...current,
        error: null,
        item: nextItem,
      }
    })
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isMutationLocked) {
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
      selectedResponsibleUser,
      selectedStorage,
      selectedSupplier,
    })
    const validationError = validateOrderPayload(payload, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const savedOrder = isEditMode
        ? await updateConsumableOrder(payload, newDocuments)
        : await createConsumableOrder(payload, newDocuments)

      if (savedOrder) {
        setOrder(normalizeOrderForForm(savedOrder))
      }

      notifications.show({
        color: 'green',
        message: isEditMode ? t('Прибуткову накладну оновлено') : t('Прибуткову накладну створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти прибуткову накладну'))
    } finally {
      setSaving(false)
    }
  }

  const supplierOptions = useMemo(() => toEntityOptions(suppliers), [suppliers])
  const storageOptions = useMemo(() => toEntityOptions(storages), [storages])
  const responsibleOptions = useMemo(() => toEntityOptions(responsibleUsers), [responsibleUsers])
  const productAutocompleteOptions = useMemo(() => toProductOptions(productOptions), [productOptions])
  const costMovementOptions = useMemo(() => toEntityOptions(costMovements, (item) => item?.OperationName || ''), [costMovements])
  const documentRows = order.ConsumablesOrderDocuments || []

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Group gap="xs">
                  <Text fw={700} size="xl">
                    {isEditMode ? t('Редагування прибуткової накладної') : t('Нова прибуткова накладна')}
                  </Text>
                  {isPaid && (
                    <Badge color="green" variant="light">
                      {t('Оплачено')}
                    </Badge>
                  )}
                </Group>
                <Text c="dimmed" size="sm">
                  {order.Number ? `${t('Номер')}: ${order.Number}` : t('Накладна ще не має внутрішнього номера')}
                </Text>
              </div>

              <Group gap="xs">
                <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={handleCancel}>
                  {t('Назад')}
                </Button>
                <Button
                  color="violet"
                  disabled={!canSave}
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSaving || isCalculating}
                  type="submit"
                >
                  {t('Зберегти')}
                </Button>
              </Group>
            </Group>

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Autocomplete
                data={supplierOptions}
                disabled={isFormLocked}
                label={t('Постачальник послуг')}
                placeholder={t('Почніть вводити назву')}
                value={form.supplierSearch}
                onChange={(value) => updateForm({ selectedSupplierValue: '', supplierSearch: value })}
                onOptionSubmit={handleSupplierSubmit}
              />
              <Select
                data={agreementOptions}
                disabled={!selectedSupplier || isFormLocked}
                label={t('Договір')}
                placeholder={t('Оберіть договір')}
                searchable
                value={form.selectedAgreementValue || null}
                onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
              />
              <TextInput
                disabled
                label={t('Організація')}
                value={getEntityLabel(selectedAgreement?.Organization) || ''}
              />
              <TextInput
                disabled={isFormLocked}
                label={t('Номер накладної')}
                value={form.invoiceNumber}
                onChange={(event) => updateForm({ invoiceNumber: event.currentTarget.value })}
              />
              <TextInput
                disabled={isFormLocked}
                label={t('Дата входу')}
                type="date"
                value={form.invoiceDate}
                onChange={(event) => updateForm({ invoiceDate: event.currentTarget.value })}
              />
              <TextInput
                disabled={isFormLocked}
                label={t('Час')}
                type="time"
                value={form.invoiceTime}
                onChange={(event) => updateForm({ invoiceTime: event.currentTarget.value })}
              />
              <Autocomplete
                data={storageOptions}
                disabled={isFormLocked}
                label={t('Склад')}
                placeholder={t('Почніть вводити склад')}
                value={form.storageSearch}
                onChange={(value) => updateForm({ selectedStorageValue: '', storageSearch: value })}
                onOptionSubmit={handleStorageSubmit}
              />
              <FileInput
                clearable
                disabled={isFormLocked}
                label={t('Файли')}
                leftSection={<IconUpload size={16} />}
                multiple
                placeholder={t('Додати документи')}
                onChange={handleFilesAdded}
              />
              <Textarea
                autosize
                disabled={isFormLocked}
                label={t('Коментар')}
                minRows={1}
                value={form.comment}
                onChange={(event) => updateForm({ comment: event.currentTarget.value })}
              />
            </SimpleGrid>

            <Checkbox
              checked={form.paymentTaskEnabled}
              disabled={isFormLocked || Boolean(isEditMode && order.SupplyPaymentTask?.Id)}
              label={t('Новий платіжний протокол')}
              onChange={(event) => updateForm({ paymentTaskEnabled: event.currentTarget.checked })}
            />

            {form.paymentTaskEnabled && (
              <SimpleGrid cols={{ base: 1, md: 3 }}>
                <TextInput
                  disabled={isFormLocked}
                  label={t('Сплатити до')}
                  type="date"
                  value={form.paymentTaskPayToDate}
                  onChange={(event) => updateForm({ paymentTaskPayToDate: event.currentTarget.value })}
                />
                <Select
                  data={responsibleOptions}
                  disabled={isFormLocked}
                  label={t('Відповідальний')}
                  searchable
                  value={form.responsibleUserValue || null}
                  onChange={(value) => updateForm({ responsibleUserValue: value || '' })}
                />
                <TextInput
                  disabled={isFormLocked}
                  label={t('Коментар до платежу')}
                  value={form.paymentTaskComment}
                  onChange={(event) => updateForm({ paymentTaskComment: event.currentTarget.value })}
                />
              </SimpleGrid>
            )}
          </Stack>
        </form>
      </Card>

      <Card withBorder radius="md" shadow="sm">
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={700}>{t('Позиції')}</Text>
              <Badge color="gray" variant="light">
                {visibleItems.length}
              </Badge>
            </Group>
            <Button disabled={isPaid || isFormLocked} leftSection={<IconPlus size={16} />} variant="light" onClick={openNewItemEditor}>
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
                {activeItems.length > 0 ? (
                  activeItems.map((item, index) => (
                    <Table.Tr key={getItemKey(item, index)} opacity={item.Deleted ? 0.45 : 1}>
                      <Table.Td>{displayValue(item.ConsumableProduct?.VendorCode)}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Text size="sm">{displayValue(item.ConsumableProduct?.Name)}</Text>
                          {item.Deleted && (
                            <Badge color="red" size="xs" variant="light">
                              {t('Буде видалено')}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{displayValue(item.ConsumableProductCategory?.Name || item.ConsumableProduct?.ConsumableProductCategory?.Name)}</Table.Td>
                      <Table.Td>{formatAmount(item.Qty)} {item.ConsumableProduct?.MeasureUnit?.Name || ''}</Table.Td>
                      <Table.Td>{formatMoney(item.PricePerItem)}</Table.Td>
                      <Table.Td>{formatMoney(item.TotalPrice)}</Table.Td>
                      <Table.Td>{formatAmount(item.VatPercent)}</Table.Td>
                      <Table.Td>{formatMoney(item.VAT)}</Table.Td>
                      <Table.Td>{formatMoney(item.TotalPriceWithVAT)}</Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          {!item.Deleted && (
                            <Tooltip label={t('Редагувати')}>
                              <ActionIcon
                                aria-label={t('Редагувати')}
                                disabled={isPaid || isMutationLocked}
                                size="sm"
                                variant="subtle"
                                onClick={() => openEditItemEditor(item, index)}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          <Tooltip label={item.Deleted ? t('Відновити') : t('Видалити')}>
                            <ActionIcon
                              aria-label={item.Deleted ? t('Відновити') : t('Видалити')}
                              color={item.Deleted ? 'green' : 'red'}
                              disabled={isPaid || isMutationLocked}
                              size="sm"
                              variant="subtle"
                              onClick={() => void toggleItemDeleted(item, index)}
                            >
                              {item.Deleted ? <IconRestore size={16} /> : <IconTrash size={16} />}
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

          <Divider />

          <Group justify="flex-end" gap="xs">
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
        </Stack>
      </Card>

      {documentRows.length > 0 && (
        <Card withBorder radius="md" shadow="sm">
          <Stack gap="sm">
            <Text fw={700}>{t('Документи')}</Text>
            {documentRows.map((document, index) => {
              const documentUrl = getDocumentUrl(document)

              return (
                <Group key={getDocumentKey(document, index)} justify="space-between" opacity={document.Deleted ? 0.45 : 1}>
                  <div>
                    {documentUrl && !document.Deleted ? (
                      <Anchor href={upgradeHttpToHttps(documentUrl)} rel="noreferrer" size="sm" target="_blank">
                        {displayValue(document.FileName || document.Name)}
                      </Anchor>
                    ) : (
                      <Text size="sm">{displayValue(document.FileName || document.Name)}</Text>
                    )}
                    <Text c="dimmed" size="xs">
                      {document.ContentType || t('Файл')}
                    </Text>
                  </div>
                  <ActionIcon
                    aria-label={document.Deleted ? t('Відновити файл') : t('Видалити файл')}
                    color={document.Deleted ? 'green' : 'red'}
                    disabled={isMutationLocked}
                    variant="subtle"
                    onClick={() => toggleDocumentDeleted(document)}
                  >
                    {document.Deleted ? <IconRestore size={16} /> : <IconTrash size={16} />}
                  </ActionIcon>
                </Group>
              )
            })}
          </Stack>
        </Card>
      )}

      <AppModal centered opened={itemEditor.opened} size="xl" title={itemEditor.mode === 'edit' ? t('Редагувати позицію') : t('Додати позицію')} onClose={closeItemEditor}>
        <Stack gap="md">
          {itemEditor.error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {itemEditor.error}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Autocomplete
              data={productAutocompleteOptions}
              disabled={isMutationLocked}
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
              disabled={isMutationLocked}
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
              disabled={isMutationLocked}
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
              disabled={isMutationLocked}
              label={t('Кількість')}
              min={0}
              rightSection={<Text c="dimmed" size="xs">{itemEditor.item.ConsumableProduct?.MeasureUnit?.Name}</Text>}
              value={itemEditor.item.Qty || 0}
              onChange={(value) => updateEditorItem({ Qty: toNumber(value) })}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={3}
              disabled={isMutationLocked}
              label={t('Ціна за одиницю')}
              min={0}
              value={itemEditor.item.PricePerItem || 0}
              onChange={(value) => updateEditorItem({ PricePerItem: toNumber(value), TotalPriceWithVAT: undefined })}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isMutationLocked}
              label={`${t('ПДВ')} %`}
              min={0}
              value={itemEditor.item.VatPercent || 0}
              onChange={(value) => updateEditorItem({ VatPercent: toNumber(value) })}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isMutationLocked}
              label={t('Разом з ПДВ')}
              min={0}
              value={itemEditor.item.TotalPriceWithVAT || 0}
              onChange={(value) => updateEditorItem({ PricePerItem: 0, TotalPriceWithVAT: toNumber(value) })}
            />
          </SimpleGrid>

          <Group justify="flex-end">
            <Button color="gray" disabled={isMutationLocked} leftSection={<IconX size={16} />} variant="light" onClick={closeItemEditor}>
              {t('Скасувати')}
            </Button>
            <Button disabled={isMutationLocked} leftSection={<IconDeviceFloppy size={16} />} onClick={() => void saveEditorItem()}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function createEmptyOrder(): ConsumablesOrder {
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
    paymentTaskComment: '',
    paymentTaskEnabled: false,
    paymentTaskPayToDate: formatLocalDate(new Date()),
    responsibleUserValue: '',
    selectedAgreementValue: '',
    selectedStorageValue: '',
    selectedSupplierValue: '',
    storageSearch: '',
    supplierSearch: '',
  }
}

function createEmptyOrderItem(): ConsumablesOrderItem {
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

function normalizeOrderForForm(order: ConsumablesOrder): ConsumablesOrder {
  return {
    ...order,
    ConsumablesOrderDocuments: Array.isArray(order.ConsumablesOrderDocuments) ? order.ConsumablesOrderDocuments : [],
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems.map(normalizeCalculatedItem)
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
      : [],
  }
}

function normalizeSupplyOrganization(entity?: NamedEntity | null): SupplyOrganization | null {
  if (!entity) {
    return null
  }

  return entity as SupplyOrganization
}

function toFormState(
  order: ConsumablesOrder,
  supplier: SupplyOrganization | null,
  agreement: SupplyOrganizationAgreement | null,
  storage: ConsumablesStorage | null,
  responsibleUser: User | null,
): FormState {
  const organizationDate = order.OrganizationFromDate ? new Date(order.OrganizationFromDate) : new Date()
  const paymentTaskDate = order.SupplyPaymentTask?.PayToDate ? new Date(order.SupplyPaymentTask.PayToDate) : new Date()

  return {
    comment: order.Comment || '',
    invoiceDate: formatLocalDate(Number.isNaN(organizationDate.getTime()) ? new Date() : organizationDate),
    invoiceNumber: order.OrganizationNumber || '',
    invoiceTime: toTimeValue(Number.isNaN(organizationDate.getTime()) ? new Date() : organizationDate),
    paymentTaskComment: order.SupplyPaymentTask?.Comment || '',
    paymentTaskEnabled: Boolean(order.SupplyPaymentTask?.Id),
    paymentTaskPayToDate: formatLocalDate(Number.isNaN(paymentTaskDate.getTime()) ? new Date() : paymentTaskDate),
    responsibleUserValue: responsibleUser ? getEntityValue(responsibleUser) : '',
    selectedAgreementValue: agreement ? getEntityValue(agreement) : '',
    selectedStorageValue: storage ? getEntityValue(storage) : '',
    selectedSupplierValue: supplier ? getEntityValue(supplier) : '',
    storageSearch: storage ? getEntityLabel(storage) : '',
    supplierSearch: supplier ? getEntityLabel(supplier) : '',
  }
}

function buildOrderPayload({
  form,
  order,
  selectedAgreement,
  selectedResponsibleUser,
  selectedStorage,
  selectedSupplier,
}: {
  form: FormState
  order: ConsumablesOrder
  selectedAgreement: SupplyOrganizationAgreement | null
  selectedResponsibleUser: User | null
  selectedStorage: ConsumablesStorage | null
  selectedSupplier: SupplyOrganization | null
}): ConsumablesOrder {
  const payload: ConsumablesOrder = {
    ...order,
    Comment: form.comment.trim(),
    ConsumableProductOrganization: selectedSupplier,
    ConsumablesStorage: selectedStorage,
    OrganizationFromDate: toIsoDateTime(form.invoiceDate, form.invoiceTime),
    OrganizationNumber: form.invoiceNumber.trim(),
    SupplyOrganizationAgreement: selectedAgreement,
    TotalAmount: order.TotalAmount,
    TotalAmountWithoutVAT: order.TotalAmountWithoutVAT,
  }

  payload.ConsumablesOrderItems = (order.ConsumablesOrderItems || []).map((item) => ({
    ...normalizeCalculatedItem(item),
    ConsumableProductOrganization: selectedSupplier,
    Id: item.Id === -1 ? 0 : item.Id,
    SupplyOrganizationAgreement: selectedAgreement,
  }))

  if (form.paymentTaskEnabled) {
    payload.SupplyPaymentTask = {
      ...(order.SupplyPaymentTask || {}),
      Comment: form.paymentTaskComment.trim(),
      PayToDate: toIsoDateTime(form.paymentTaskPayToDate, '00:00'),
      User: selectedResponsibleUser,
    }
  } else if (!order.SupplyPaymentTask?.Id) {
    payload.SupplyPaymentTask = undefined
  }

  return payload
}

function validateOrderPayload(order: ConsumablesOrder, t: (value: string) => string): string | null {
  if (!order.ConsumableProductOrganization) {
    return t('Оберіть постачальника послуг')
  }

  if (!order.SupplyOrganizationAgreement?.Organization) {
    return t('Оберіть договір з організацією')
  }

  if (!order.ConsumablesStorage) {
    return t('Оберіть склад')
  }

  if (!(order.ConsumablesOrderItems || []).some((item) => !item.Deleted)) {
    return t('Додайте хоча б одну позицію')
  }

  if (order.SupplyPaymentTask && !order.SupplyPaymentTask.User) {
    return t('Оберіть відповідального за платіжний протокол')
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

  if (form.paymentTaskEnabled && !isValidDateInput(form.paymentTaskPayToDate)) {
    return t('Вкажіть дату оплати')
  }

  return null
}

function validateItem(item: ConsumablesOrderItem, t: (value: string) => string): string | null {
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

function normalizeCalculatedItem(item: ConsumablesOrderItem): ConsumablesOrderItem {
  const totals = calculateConsumableOrderItemTotals(item)

  return {
    ...item,
    ...totals,
  }
}

function calculateLocalTotals(items: ConsumablesOrderItem[]) {
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
  const products: ConsumableProduct[] = []

  for (const category of categories) {
    for (const product of category.ConsumableProducts || []) {
      products.push({
        ...product,
        ConsumableProductCategory: product.ConsumableProductCategory || {
          ...category,
          ConsumableProducts: undefined,
        },
      })
    }
  }

  return products
}

function toEntityOptions<T extends NamedEntity>(entities: T[], labelGetter = getEntityLabel): SelectOption[] {
  const options: SelectOption[] = []

  for (const entity of entities) {
    const value = getEntityValue(entity)
    const label = labelGetter(entity) || value

    if (value) {
      options.push({ label, value })
    }
  }

  return options
}

function toProductOptions(products: ConsumableProduct[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const product of products) {
    const value = getEntityValue(product)
    const label = joinTruthyParts([product.VendorCode, product.Name], ' - ') || value

    if (value) {
      options.push({ label, value })
    }
  }

  return options
}

function toAgreementOptions(agreements: SupplyOrganizationAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const agreement of agreements) {
    const value = getEntityValue(agreement)
    const label =
      joinTruthyParts([agreement.Name || agreement.Number, agreement.Currency?.Code || agreement.Currency?.Name, agreement.Organization?.Name], ' / ') ||
      value

    if (value) {
      options.push({ label, value })
    }
  }

  return options
}

function joinTruthyParts(parts: Array<string | undefined>, separator: string): string {
  const truthyParts: string[] = []

  for (const part of parts) {
    if (part) {
      truthyParts.push(part)
    }
  }

  return truthyParts.join(separator)
}

function toggleDeletedItemAtIndex(items: ConsumablesOrderItem[], index: number): ConsumablesOrderItem[] {
  return items.reduce<ConsumablesOrderItem[]>((nextItems, currentItem, currentIndex) => {
    if (currentIndex !== index) {
      nextItems.push(currentItem)
      return nextItems
    }

    if (!currentItem.Id || currentItem.Id < 0) {
      return nextItems
    }

    nextItems.push({
      ...currentItem,
      Deleted: !currentItem.Deleted,
    })

    return nextItems
  }, [])
}

function includeEntity<T extends NamedEntity>(entities: T[], entity: T | null): T[] {
  if (!entity) {
    return entities
  }

  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function includeSupplierAgreement(
  suppliers: SupplyOrganization[],
  supplier: SupplyOrganization | null,
  agreement: SupplyOrganizationAgreement | null,
): SupplyOrganization[] {
  if (!supplier) {
    return suppliers
  }

  const supplierValue = getEntityValue(supplier)
  const baseSuppliers = includeEntity(suppliers, supplier)

  if (!agreement) {
    return baseSuppliers
  }

  return baseSuppliers.map((item) => {
    if (getEntityValue(item) !== supplierValue) {
      return item
    }

    const agreements = item.SupplyOrganizationAgreements || []
    const agreementValue = getEntityValue(agreement)

    if (!agreementValue || agreements.some((currentAgreement) => getEntityValue(currentAgreement) === agreementValue)) {
      return item
    }

    return {
      ...item,
      SupplyOrganizationAgreements: [agreement, ...agreements],
    }
  })
}

function cloneOrderItem(item: ConsumablesOrderItem): ConsumablesOrderItem {
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

function clearEditorProduct(item: ConsumablesOrderItem): ConsumablesOrderItem {
  return {
    ...item,
    ConsumableProduct: null,
    ConsumableProductCategory: null,
  }
}

function getEntityValue(entity?: NamedEntity | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityLabel(entity?: NamedEntity | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

function getItemKey(item: ConsumablesOrderItem, index: number): string {
  return String(item.NetUid || item.Id || `${item.ConsumableProduct?.NetUid || item.ConsumableProduct?.Id || 'item'}-${index}`)
}

function isSameDocument(first: ConsumablesOrderDocument, second: ConsumablesOrderDocument): boolean {
  if (first.NetUid && second.NetUid) {
    return first.NetUid === second.NetUid
  }

  if (first.Id && second.Id) {
    return first.Id === second.Id
  }

  const firstKey = getDocumentFallbackKey(first)

  return Boolean(firstKey && firstKey === getDocumentFallbackKey(second))
}

function getDocumentKey(document: ConsumablesOrderDocument, index: number): string {
  return String(document.NetUid || document.Id || getDocumentFallbackKey(document) || `document-${index}`)
}

function getDocumentFallbackKey(document: ConsumablesOrderDocument): string {
  return [
    getDocumentUrl(document),
    document.FileName || document.Name,
    document.ContentType,
  ].filter(Boolean).join(':')
}

function getDocumentUrl(document: ConsumablesOrderDocument): string | undefined {
  return (
    document.DocumentUrl ||
    document.DocumentURL ||
    document.PdfDocumentURL ||
    document.PdfDocumentUrl ||
    document.URL ||
    document.Url ||
    document.url
  )
}

function createLocalId(): string {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function removeFirstMatchingFile(files: File[], document: ConsumablesOrderDocument): File[] {
  let removed = false

  return files.filter((file) => {
    const isMatch =
      !removed &&
      file.name === document.FileName &&
      (!document.ContentType || file.type === document.ContentType)

    if (isMatch) {
      removed = true
      return false
    }

    return true
  })
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

function toIsoDateTime(dateValue: string, timeValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T${timeValue || '00:00'}`)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
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

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
