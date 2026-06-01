import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef } from 'react'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  createConsumableProduct,
  createConsumableProductCategory,
  deleteConsumableProduct,
  deleteConsumableProductCategory,
  getConsumableProductCategories,
  searchConsumableProductCategories,
  searchMeasureUnits,
  updateConsumableProduct,
  updateConsumableProductCategory,
} from '../api/consumableProductsApi'
import type {
  ConsumableProduct,
  ConsumableProductCategory,
  ConsumableProductCategoryDraft,
  ConsumableProductDraft,
  MeasureUnit,
} from '../types'

const PRODUCT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

type CategoryEditor =
  | { mode: 'create'; category?: undefined }
  | { mode: 'edit'; category: ConsumableProductCategory }

type ProductEditor =
  | { category: ConsumableProductCategory; mode: 'create'; product?: undefined }
  | { category: ConsumableProductCategory; mode: 'edit'; product: ConsumableProduct }

type DeleteTarget =
  | { category: ConsumableProductCategory; kind: 'category' }
  | { category: ConsumableProductCategory; kind: 'product'; product: ConsumableProduct }

export function ConsumableProductsPage() {
  const { t } = useI18n()
  const [categories, setCategories] = useValueState<ConsumableProductCategory[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [hasSearchInput, setHasSearchInput] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [categoryEditor, setCategoryEditor] = useValueState<CategoryEditor | null>(null)
  const [productEditor, setProductEditor] = useValueState<ProductEditor | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<DeleteTarget | null>(null)
  const requestRef = useRef(0)
  const totalProducts = useMemo(
    () => categories.reduce((total, category) => total + (category.ConsumableProducts?.length || 0), 0),
    [categories],
  )

  useEffect(() => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    const timeoutId = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      async function loadCategories() {
        try {
          const nextCategories = hasSearchInput
            ? await searchConsumableProductCategories(searchValue)
            : await getConsumableProductCategories()

          if (requestRef.current === requestId) {
            setCategories(nextCategories)
          }
        } catch (loadError) {
          if (requestRef.current === requestId) {
            setCategories([])
            setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити побутові товари'))
          }
        } finally {
          if (requestRef.current === requestId) {
            setLoading(false)
          }
        }
      }

      void loadCategories()
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasSearchInput, searchValue, setCategories, setError, setLoading, t])

  async function reloadCategories(options: { serviceCategory?: ConsumableProductCategory | null } = {}) {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const nextCategories = hasSearchInput
        ? await searchConsumableProductCategories(searchValue)
        : await getConsumableProductCategories()

      if (requestRef.current === requestId) {
        setCategories(applySupplyServiceCategoryExclusivity(nextCategories, options.serviceCategory))
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося оновити побутові товари'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  async function saveCategory(draft: ConsumableProductCategoryDraft) {
    if (!draft.name.trim()) {
      setError(t('Вкажіть назву категорії'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (categoryEditor?.mode === 'edit') {
        const categoryToSave = {
          ...categoryEditor.category,
          IsSupplyServiceCategory: draft.isSupplyServiceCategory,
          Name: draft.name.trim(),
        }
        const savedCategory = await updateConsumableProductCategory(categoryToSave)
        await reloadCategories({ serviceCategory: draft.isSupplyServiceCategory ? savedCategory || categoryToSave : null })
      } else {
        const categoryToSave = {
          ConsumableProducts: [],
          IsSupplyServiceCategory: draft.isSupplyServiceCategory,
          Name: draft.name.trim(),
        }
        const savedCategory = await createConsumableProductCategory(categoryToSave)
        await reloadCategories({ serviceCategory: draft.isSupplyServiceCategory ? savedCategory || categoryToSave : null })
      }

      notifications.show({
        color: 'green',
        message: categoryEditor?.mode === 'edit' ? t('Категорію оновлено') : t('Категорію створено'),
      })
      setCategoryEditor(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти категорію'))
    } finally {
      setSaving(false)
    }
  }

  async function saveProduct(editor: ProductEditor, draft: ConsumableProductDraft) {
    if (!draft.name.trim()) {
      setError(t('Вкажіть назву товару'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const category = editor.category

      if (editor.mode === 'edit') {
        await updateConsumableProduct({
          ...editor.product,
          MeasureUnit: draft.measureUnit || editor.product.MeasureUnit || null,
          Name: draft.name.trim(),
          VendorCode: draft.vendorCode.trim(),
        })
      } else {
        await createConsumableProduct({
          ConsumableProductCategory: category,
          ConsumableProductCategoryId: category.Id,
          MeasureUnit: draft.measureUnit,
          Name: draft.name.trim(),
          VendorCode: draft.vendorCode.trim(),
        })
      }

      notifications.show({
        color: 'green',
        message: editor.mode === 'edit' ? t('Товар оновлено') : t('Товар створено'),
      })
      setProductEditor(null)
      await reloadCategories()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти товар'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    const netId = deleteTarget.kind === 'category' ? deleteTarget.category.NetUid : deleteTarget.product.NetUid

    if (!netId) {
      setError(t('Запис не має NetUid для видалення'))
      setDeleteTarget(null)
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (deleteTarget.kind === 'category') {
        await deleteConsumableProductCategory(netId)
      } else {
        await deleteConsumableProduct(netId)
      }

      notifications.show({ color: 'green', message: t('Запис видалено') })
      setDeleteTarget(null)
      await reloadCategories()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити запис'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end" gap="sm">
        <TextInput
          leftSection={<IconSearch size={16} />}
          label={t('Пошук')}
          placeholder={t('Категорія або товар')}
          value={searchValue}
          style={{ flex: '1 1 320px' }}
          onChange={(event) => {
            setHasSearchInput(true)
            setSearchValue(event.currentTarget.value)
            setCategories([])
          }}
        />
        <Group gap="xs">
          <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_AddBtn_PKEY">
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCategoryEditor({ mode: 'create' })}>
              {t('Додати категорію')}
            </Button>
          </PermissionGate>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void reloadCategories()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Group gap="xs">
        <Badge color="violet" variant="light">
          {t('Категорій')}: {categories.length}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Товарів')}: {totalProducts}
        </Badge>
      </Group>

      <Stack gap="md">
        {categories.map((category) => (
          <ConsumableCategoryPanel
            key={category.NetUid || category.Id || category.Name}
            category={category}
            onAddProduct={() => setProductEditor({ category, mode: 'create' })}
            onDeleteCategory={() => setDeleteTarget({ category, kind: 'category' })}
            onDeleteProduct={(product) => setDeleteTarget({ category, kind: 'product', product })}
            onEditCategory={() => setCategoryEditor({ category, mode: 'edit' })}
            onEditProduct={(product) => setProductEditor({ category, mode: 'edit', product })}
          />
        ))}

        {!isLoading && categories.length === 0 && (
          <Card withBorder radius="md" padding="lg">
            <Text c="dimmed">{t('Побутових товарів не знайдено')}</Text>
          </Card>
        )}
      </Stack>

      <CategoryEditorModal
        editor={categoryEditor}
        isSubmitting={isSaving}
        onClose={() => setCategoryEditor(null)}
        onSubmit={saveCategory}
      />

      <ProductEditorModal
        editor={productEditor}
        isSubmitting={isSaving}
        onClose={() => setProductEditor(null)}
        onSubmit={saveProduct}
      />

      <DeleteModal
        isSubmitting={isSaving}
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

function ConsumableCategoryPanel({
  category,
  onAddProduct,
  onDeleteCategory,
  onDeleteProduct,
  onEditCategory,
  onEditProduct,
}: {
  category: ConsumableProductCategory
  onAddProduct: () => void
  onDeleteCategory: () => void
  onDeleteProduct: (product: ConsumableProduct) => void
  onEditCategory: () => void
  onEditProduct: (product: ConsumableProduct) => void
}) {
  const { t } = useI18n()
  const products = category.ConsumableProducts || []
  const columns = useConsumableProductColumns(onEditProduct, onDeleteProduct)

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={4}>
            <Group gap="xs">
              <Text fw={700}>{displayValue(category.Name)}</Text>
              {category.IsSupplyServiceCategory && (
                <Badge color="teal" variant="light">
                  {t('Деталі послуг')}
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              {t('Товарів')}: {products.length}
            </Text>
          </Stack>
          <Group gap="xs">
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_addSupCategoryBtn_PKEY">
              <Button leftSection={<IconPlus size={16} />} size="xs" variant="light" onClick={onAddProduct}>
                {t('Товар')}
              </Button>
            </PermissionGate>
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_edit_categoryBtn_PKEY">
              <Tooltip label={t('Редагувати')}>
                <ActionIcon aria-label={t('Редагувати категорію')} color="gray" variant="light" onClick={onEditCategory}>
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Видалити')}>
                <ActionIcon aria-label={t('Видалити категорію')} color="red" variant="light" onClick={onDeleteCategory}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
          </Group>
        </Group>

        <DataTable
          columns={columns}
          data={products}
          defaultLayout={PRODUCT_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Товарів у категорії немає')}
          getRowId={(product, index) => String(product.NetUid || product.Id || index)}
          layoutVersion="consumable-products-category-products-1"
          maxHeight={360}
          minWidth={760}
          tableId={`consumable-products-${category.NetUid || category.Id || category.Name || 'category'}`}
        />
      </Stack>
    </Card>
  )
}

function useConsumableProductColumns(
  onEditProduct: (product: ConsumableProduct) => void,
  onDeleteProduct: (product: ConsumableProduct) => void,
): DataTableColumn<ConsumableProduct>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ConsumableProduct>[]>(
    () => [
      {
        id: 'name',
        header: t('Назва'),
        width: 300,
        minWidth: 220,
        accessor: (product) => product.Name,
        cell: (product) => <Text fw={600}>{displayValue(product.Name)}</Text>,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 160,
        minWidth: 120,
        accessor: (product) => product.VendorCode,
        cell: (product) => displayValue(product.VendorCode),
      },
      {
        id: 'measureUnit',
        header: t('Одиниця виміру'),
        width: 170,
        minWidth: 140,
        accessor: (product) => product.MeasureUnit?.Name,
        cell: (product) => displayValue(product.MeasureUnit?.Name),
      },
      {
        id: 'qty',
        header: t('Залишок'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (product) => product.TotalQty,
        cell: (product) => displayValue(product.TotalQty),
      },
      {
        id: 'actions',
        header: '',
        width: 90,
        minWidth: 82,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (product) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_editBtn_PKEY">
              <Tooltip label={t('Редагувати')}>
                <ActionIcon aria-label={t('Редагувати товар')} color="gray" size="sm" variant="subtle" onClick={() => onEditProduct(product)}>
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_removeBtn_PKEY">
              <Tooltip label={t('Видалити')}>
                <ActionIcon aria-label={t('Видалити товар')} color="red" size="sm" variant="subtle" onClick={() => onDeleteProduct(product)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
          </Group>
        ),
      },
    ],
    [onDeleteProduct, onEditProduct, t],
  )
}

function CategoryEditorModal({
  editor,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  editor: CategoryEditor | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (draft: ConsumableProductCategoryDraft) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={Boolean(editor)}
      title={editor?.mode === 'edit' ? t('Редагувати категорію') : t('Нова категорія')}
      onClose={onClose}
    >
      {editor && (
        <CategoryEditorForm
          key={getCategoryEditorKey(editor)}
          editor={editor}
          isSubmitting={isSubmitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </AppModal>
  )
}

function CategoryEditorForm({
  editor,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  editor: CategoryEditor
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (draft: ConsumableProductCategoryDraft) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useValueState(editor.category?.Name || '')
  const [isSupplyServiceCategory, setSupplyServiceCategory] = useValueState(Boolean(editor.category?.IsSupplyServiceCategory))

  return (
    <Stack gap="md">
      <TextInput label={t('Назва')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <Checkbox
        checked={isSupplyServiceCategory}
        label={t('Деталі послуг')}
        onChange={(event) => setSupplyServiceCategory(event.currentTarget.checked)}
      />
      <Group justify="flex-end">
        <Button color="gray" leftSection={<IconX size={16} />} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          loading={isSubmitting}
          onClick={() => onSubmit({ isSupplyServiceCategory, name })}
        >
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}

function ProductEditorModal({
  editor,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  editor: ProductEditor | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (editor: ProductEditor, draft: ConsumableProductDraft) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={Boolean(editor)}
      title={editor?.mode === 'edit' ? t('Редагувати товар') : t('Новий товар')}
      onClose={onClose}
    >
      {editor && (
        <ProductEditorForm
          key={getProductEditorKey(editor)}
          editor={editor}
          isSubmitting={isSubmitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </AppModal>
  )
}

function ProductEditorForm({
  editor,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  editor: ProductEditor
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (editor: ProductEditor, draft: ConsumableProductDraft) => void
}) {
  const { t } = useI18n()
  const product = editor.product
  const [name, setName] = useValueState(product?.Name || '')
  const [vendorCode, setVendorCode] = useValueState(product?.VendorCode || '')
  const [measureUnitSearch, setMeasureUnitSearch] = useValueState(product?.MeasureUnit?.Name || '')
  const [measureUnits, setMeasureUnits] = useValueState<MeasureUnit[]>(product?.MeasureUnit ? [product.MeasureUnit] : [])
  const [selectedMeasureUnit, setSelectedMeasureUnit] = useValueState<MeasureUnit | null>(product?.MeasureUnit || null)

  useEffect(() => {
    const value = measureUnitSearch.trim()

    if (value.length === 0 || (selectedMeasureUnit && getMeasureUnitLabel(selectedMeasureUnit) === value)) {
      return
    }

    let cancelled = false

    const timeoutId = window.setTimeout(() => {
      searchMeasureUnits(value)
        .then((nextMeasureUnits) => {
          if (!cancelled) {
            setMeasureUnits(nextMeasureUnits)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMeasureUnits([])
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [measureUnitSearch, selectedMeasureUnit, setMeasureUnits])

  const measureUnitOptions = useMemo(
    () =>
      measureUnits.map((measureUnit, index) => ({
        label: getMeasureUnitLabel(measureUnit),
        value: getMeasureUnitOptionValue(measureUnit, index),
      })),
    [measureUnits],
  )

  function submit() {
    const measureUnit = resolveMeasureUnit(measureUnits, measureUnitSearch, selectedMeasureUnit)

    onSubmit(editor, {
      measureUnit,
      name,
      vendorCode,
    })
  }

  return (
    <Stack gap="md">
      <TextInput label={t('Назва')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <TextInput label={t('Артикул')} value={vendorCode} onChange={(event) => setVendorCode(event.currentTarget.value)} />
      <Autocomplete
        data={measureUnitOptions}
        label={t('Одиниця виміру')}
        value={measureUnitSearch}
        onChange={(value) => {
          setMeasureUnitSearch(value)
          setSelectedMeasureUnit(null)
          setMeasureUnits([])
        }}
        onOptionSubmit={(value) => {
          const measureUnit = measureUnits.find((item, index) => getMeasureUnitOptionValue(item, index) === value) || null
          setMeasureUnitSearch(measureUnit ? getMeasureUnitLabel(measureUnit) : value)
          setSelectedMeasureUnit(measureUnit)
        }}
        onBlur={() => {
          const measureUnit = resolveSingleFilteredMeasureUnit(measureUnits, measureUnitSearch)

          if (measureUnit) {
            setMeasureUnitSearch(getMeasureUnitLabel(measureUnit))
            setSelectedMeasureUnit(measureUnit)
          }
        }}
      />
      <Group justify="flex-end">
        <Button color="gray" leftSection={<IconX size={16} />} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button leftSection={<IconPlus size={16} />} loading={isSubmitting} onClick={submit}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}

function getCategoryEditorKey(editor: CategoryEditor): string {
  if (editor.mode === 'create') {
    return 'create'
  }

  return `edit-${getCategoryKey(editor.category)}`
}

function getProductEditorKey(editor: ProductEditor): string {
  const categoryKey = getCategoryKey(editor.category)

  if (editor.mode === 'create') {
    return `create-${categoryKey}`
  }

  return `edit-${categoryKey}-${getProductKey(editor.product)}`
}

function getCategoryKey(category: ConsumableProductCategory): string {
  return String(category.NetUid || category.Id || category.Name || 'category')
}

function getProductKey(product: ConsumableProduct): string {
  return String(product.NetUid || product.Id || product.Name || 'product')
}

function DeleteModal({
  isSubmitting,
  target,
  onClose,
  onConfirm,
}: {
  isSubmitting: boolean
  target: DeleteTarget | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()
  const targetName = target?.kind === 'product' ? target.product.Name : target?.category.Name

  return (
    <AppModal centered opened={Boolean(target)} title={t('Видалити запис')} onClose={onClose}>
      <Stack gap="md">
        <Text>
          {t('Видалити')} <Text span fw={700}>{displayValue(targetName)}</Text>?
        </Text>
        <Group justify="flex-end">
          <Button color="gray" variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" loading={isSubmitting} onClick={onConfirm}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function applySupplyServiceCategoryExclusivity(
  categories: ConsumableProductCategory[],
  serviceCategory?: ConsumableProductCategory | null,
): ConsumableProductCategory[] {
  if (!serviceCategory?.IsSupplyServiceCategory) {
    return categories
  }

  return categories.map((category) => ({
    ...category,
    IsSupplyServiceCategory: categoriesMatch(category, serviceCategory),
  }))
}

function categoriesMatch(category: ConsumableProductCategory, serviceCategory: ConsumableProductCategory): boolean {
  if (category.NetUid && serviceCategory.NetUid) {
    return category.NetUid === serviceCategory.NetUid
  }

  if (category.Id && serviceCategory.Id) {
    return category.Id === serviceCategory.Id
  }

  return Boolean(category.Name && serviceCategory.Name && category.Name === serviceCategory.Name)
}

function resolveMeasureUnit(
  measureUnits: MeasureUnit[],
  value: string,
  selectedMeasureUnit: MeasureUnit | null,
): MeasureUnit | null {
  if (selectedMeasureUnit && getMeasureUnitLabel(selectedMeasureUnit) === value) {
    return selectedMeasureUnit
  }

  const exactMatches = measureUnits.filter((measureUnit) => getMeasureUnitLabel(measureUnit) === value)

  if (exactMatches.length === 1) {
    return exactMatches[0]
  }

  return resolveSingleFilteredMeasureUnit(measureUnits, value)
}

function resolveSingleFilteredMeasureUnit(measureUnits: MeasureUnit[], value: string): MeasureUnit | null {
  const normalizedValue = value.trim().toLocaleLowerCase()

  if (!normalizedValue) {
    return null
  }

  const matches = measureUnits.filter((measureUnit) => {
    const name = getMeasureUnitLabel(measureUnit).toLocaleLowerCase()
    const code = measureUnit.CodeOneC?.toLocaleLowerCase() || ''

    return name.includes(normalizedValue) || code.includes(normalizedValue)
  })

  return matches.length === 1 ? matches[0] : null
}

function getMeasureUnitLabel(measureUnit: MeasureUnit): string {
  return measureUnit.Name || measureUnit.CodeOneC || displayValue(measureUnit.Id)
}

function getMeasureUnitOptionValue(measureUnit: MeasureUnit, index: number): string {
  return measureUnit.NetUid || String(measureUnit.Id || `${getMeasureUnitLabel(measureUnit)}-${index}`)
}
