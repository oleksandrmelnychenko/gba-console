import {
  ActionIcon,
  Alert,
  Autocomplete,
  Button,
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
  IconBarcode,
  IconBox,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { createConsoleTableMarker } from '../../../shared/ui/console-table-utils'
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
import '../../online-shop-seo/pages/online-shop-seo-page.css'
import './consumable-products-page.css'

const PRODUCT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['actions'],
  },
  density: 'compact',
}

type CategoryEditor =
  | { mode: 'create'; category?: undefined }
  | { mode: 'edit'; category: ConsumableProductCategory }

type ProductEditor =
  | { category: ConsumableProductCategory; mode: 'create'; product?: undefined }
  | { category: ConsumableProductCategory; mode: 'edit'; product: ConsumableProduct }

type DeleteTarget =
  | { category: ConsumableProductCategory; kind: 'category' }
  | { category: ConsumableProductCategory; kind: 'product'; product: ConsumableProduct }

type ConsumableProductSortId = 'measureUnit' | 'name' | 'vendorCode'
type ConsumableProductSortState = {
  direction: 'asc' | 'desc'
  id: ConsumableProductSortId
} | null

export function ConsumableProductsPage() {
  const { t } = useI18n()
  const [categories, setCategories] = useValueState<ConsumableProductCategory[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [hasSearchInput, setHasSearchInput] = useValueState(false)
  const [selectedCategoryKey, setSelectedCategoryKey] = useValueState<string | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [categoryEditor, setCategoryEditor] = useValueState<CategoryEditor | null>(null)
  const [productEditor, setProductEditor] = useValueState<ProductEditor | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<DeleteTarget | null>(null)
  const requestRef = useRef(0)
  const selectedCategory = useMemo(
    () => categories.find((category) => getCategoryKey(category) === selectedCategoryKey) || categories[0] || null,
    [categories, selectedCategoryKey],
  )

  useEffect(() => {
    const nextCategoryKey = categories[0] ? getCategoryKey(categories[0]) : null

    if (!nextCategoryKey) {
      if (selectedCategoryKey !== null) {
        setSelectedCategoryKey(null)
      }

      return
    }

    if (!selectedCategoryKey || !categories.some((category) => getCategoryKey(category) === selectedCategoryKey)) {
      setSelectedCategoryKey(nextCategoryKey)
    }
  }, [categories, selectedCategoryKey, setSelectedCategoryKey])

  useEffect(() => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    const timeoutId = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      async function loadCategories() {
        try {
          const nextCategories = await requestCategories(searchValue, hasSearchInput)

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
      const nextCategories = await requestCategories(searchValue, hasSearchInput, Date.now())

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
    <Stack className="consumable-products-page seo-page" gap="md">
      <PageHeaderActions>
        <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_AddBtn_PKEY">
          <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={() => setCategoryEditor({ mode: 'create' })}>
            {t('Додати категорію')}
          </Button>
        </PermissionGate>
      </PageHeaderActions>

      <div className="seo-page-shell">
        <div className="seo-page-command-bar">
          <TextInput
            className="seo-page-search-input"
            leftSection={<IconSearch size={15} />}
            label={t('Пошук')}
            placeholder={t('Категорія або товар')}
            value={searchValue}
            onChange={(event) => {
              setHasSearchInput(true)
              setSearchValue(event.currentTarget.value)
              setCategories([])
              setSelectedCategoryKey(null)
            }}
          />
          <div className="seo-page-toolbar-actions">
            <Tooltip label={t('РЎРєРёРЅСѓС‚Рё')}>
              <ActionIcon
                aria-label={t('РЎРєРёРЅСѓС‚Рё')}
                color="gray"
                disabled={!searchValue}
                size={34}
                type="button"
                variant="light"
                onClick={() => {
                  setHasSearchInput(false)
                  setSearchValue('')
                  setSelectedCategoryKey(null)
                }}
              >
                <IconRestore size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void reloadCategories()}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="seo-page-workspace consumable-products-workspace">
            <aside className="seo-page-rail">
              <div className="consumable-products-sidebar__header">
                <span className="consumable-products-sidebar__label">{t('Категорії')}</span>
              </div>
              <div className="seo-page-nav">
                {categories.map((category) => {
                  const categoryKey = getCategoryKey(category)
                  const productsCount = category.ConsumableProducts?.length || 0

                  return (
                    <button
                      key={categoryKey}
                      className={`seo-page-nav-item consumable-products-nav-item${selectedCategory && getCategoryKey(selectedCategory) === categoryKey ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => setSelectedCategoryKey(categoryKey)}
                    >
                      <span className="consumable-products-category-button__marker">
                        {createConsoleTableMarker(category.Name)}
                      </span>
                      <span className="consumable-products-category-button__copy">
                        <span className="consumable-products-category-button__name">{displayValue(category.Name)}</span>
                        <span className="consumable-products-category-button__meta">
                          {category.IsSupplyServiceCategory ? t('Послуги') : t('Категорія')}
                        </span>
                      </span>
                      <span className="consumable-products-category-button__count">{productsCount}</span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="seo-page-panel">
              {selectedCategory ? (
                <ConsumableCategoryPanel
                  key={getCategoryKey(selectedCategory)}
                  category={selectedCategory}
                  onAddProduct={() => setProductEditor({ category: selectedCategory, mode: 'create' })}
                  onDeleteCategory={() => setDeleteTarget({ category: selectedCategory, kind: 'category' })}
                  onDeleteProduct={(product) => setDeleteTarget({ category: selectedCategory, kind: 'product', product })}
                  onEditCategory={() => setCategoryEditor({ category: selectedCategory, mode: 'edit' })}
                  onEditProduct={(product) => setProductEditor({ category: selectedCategory, mode: 'edit', product })}
                />
              ) : isLoading ? (
                <div className="consumable-products-empty-state">{t('Завантаження побутових товарів')}</div>
              ) : (
              <div className="consumable-products-empty-state">
                {t('Побутових товарів не знайдено')}
              </div>
              )}
            </section>
        </div>
      </div>

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
  const products = useMemo(() => category.ConsumableProducts || [], [category.ConsumableProducts])
  const [sortState, setSortState] = useValueState<ConsumableProductSortState>(null)
  const sortedProducts = useMemo(() => sortConsumableProducts(products, sortState), [products, sortState])
  const columns = useConsumableProductColumns(onEditProduct, onDeleteProduct)

  function toggleSort(id: ConsumableProductSortId) {
    setSortState((current) => {
      if (current?.id !== id) {
        return { direction: 'asc', id }
      }

      return { direction: current.direction === 'asc' ? 'desc' : 'asc', id }
    })
  }

  return (
    <section className="consumable-category-panel">
      <div className="consumable-category-panel__header">
        <div className="consumable-category-panel__title">
          <div className="consumable-category-panel__heading">
            <Text className="consumable-category-panel__name">{displayValue(category.Name)}</Text>
          </div>
          <Text className="consumable-category-panel__meta">
            {t('Товарів')}: {products.length}
          </Text>
        </div>
        <Group className="consumable-category-panel__actions" gap="xs">
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_addSupCategoryBtn_PKEY">
              <Button leftSection={<IconPlus size={16} />} size="xs" variant="light" onClick={onAddProduct}>
                {t('Товар')}
              </Button>
            </PermissionGate>
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_edit_categoryBtn_PKEY">
              <Tooltip label={t('Редагувати')}>
                <ActionIcon aria-label={t('Редагувати категорію')} color="gray" variant="light" onClick={onEditCategory}>
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Видалити')}>
                <ActionIcon aria-label={t('Видалити категорію')} color="red" variant="light" onClick={onDeleteCategory}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
          </Group>
      </div>

      <div className="consumable-category-panel__table">
        <ConsumableProductsRoster
          columns={columns}
          data={sortedProducts}
          defaultLayout={PRODUCT_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Товарів у категорії немає')}
          getRowId={(product, index) => String(product.NetUid || product.Id || index)}
          layoutVersion="consumable-products-category-products-1"
          maxHeight="calc(100vh - var(--app-shell-header-offset, 108px) - var(--app-shell-footer-offset, 36px) - 220px)"
          minWidth={640}
          sortState={sortState}
          showLayoutControls={false}
          tableId={`consumable-products-${category.NetUid || category.Id || category.Name || 'category'}`}
          onSort={toggleSort}
        />
      </div>
    </section>
  )
}

function ConsumableProductsRoster({
  columns,
  data,
  emptyText,
  getRowId,
  maxHeight,
  minWidth = 720,
  sortState,
  onSort,
}: {
  columns: DataTableColumn<ConsumableProduct>[]
  data: ConsumableProduct[]
  defaultLayout?: unknown
  emptyText?: ReactNode
  getRowId?: (product: ConsumableProduct, index: number) => string
  layoutVersion?: string
  maxHeight?: number | string
  minWidth?: number
  showLayoutControls?: boolean
  sortState?: ConsumableProductSortState
  tableId?: string
  onSort?: (id: ConsumableProductSortId) => void
}) {
  const tableStyle = {
    '--seo-roster-columns': 'minmax(340px, 1fr) minmax(98px, 0.24fr) minmax(98px, 0.22fr) 76px',
    '--seo-roster-min-width': `${minWidth}px`,
    maxHeight,
  } as CSSProperties

  return (
    <div className="seo-roster-table consumable-products-roster" style={tableStyle}>
      <div className="seo-roster-head">
        {columns.map((column) =>
          isConsumableProductSortId(column.id) ? (
            <button
              className={`seo-roster-head-cell consumable-products-roster-sort${sortState?.id === column.id ? ' is-active' : ''}`}
              key={column.id}
              type="button"
              onClick={() => onSort?.(column.id as ConsumableProductSortId)}
            >
              {column.header}
              {sortState?.id === column.id ? (
                <span className="consumable-products-roster-sort__direction">
                  {sortState.direction === 'asc' ? '↑' : '↓'}
                </span>
              ) : null}
            </button>
          ) : (
            <span className={`seo-roster-head-cell is-${column.id}`} key={column.id}>
              {column.header}
            </span>
          ),
        )}
      </div>

      <div className="seo-roster-body">
        {data.length === 0 ? (
          <div className="seo-roster-empty">{emptyText}</div>
        ) : (
          data.map((product, index) => (
            <div className="seo-roster-row-frame" key={getRowId?.(product, index) || getProductKey(product)}>
              <div className="seo-roster-row is-hoverable consumable-product-row">
                {columns.map((column) => (
                  <div className={`seo-roster-cell is-${column.id}`} key={column.id}>
                    {column.cell ? column.cell(product) : displayValue(column.accessor?.(product) as string | number | null)}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
        cell: (product) => <ConsumableProductNameCell product={product} />,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 100,
        minWidth: 92,
        accessor: (product) => product.VendorCode,
        cell: (product) => <ConsumableProductCodeCell value={displayValue(product.VendorCode)} />,
      },
      {
        id: 'measureUnit',
        header: t('Одиниця виміру'),
        width: 100,
        minWidth: 92,
        accessor: (product) => product.MeasureUnit?.Name,
        cell: (product) => <ConsumableProductUnitCell value={displayValue(product.MeasureUnit?.Name)} />,
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
          <Group className="consumable-product-row-actions" gap={4} justify="flex-end" wrap="nowrap">
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_editBtn_PKEY">
              <Tooltip label={t('Редагувати')}>
                <ActionIcon aria-label={t('Редагувати товар')} color="gray" size="sm" variant="subtle" onClick={() => onEditProduct(product)}>
                  <IconPencil size={15} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
            <PermissionGate permissionKey="SERVICE_Accounting_Consumable_Product_removeBtn_PKEY">
              <Tooltip label={t('Видалити')}>
                <ActionIcon aria-label={t('Видалити товар')} color="gray" size="sm" variant="subtle" onClick={() => onDeleteProduct(product)}>
                  <IconTrash size={15} />
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

function ConsumableProductCodeCell({ value }: { value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <span className="seo-table-role-like-cell consumable-product-code">
        <span className="seo-table-role-like-icon" aria-hidden>
          <IconBarcode size={12} />
        </span>
        <span className="seo-table-muted-cell is-default">{value}</span>
      </span>
    </Tooltip>
  )
}

function ConsumableProductNameCell({ product }: { product: ConsumableProduct }) {
  const title = displayValue(product.Name)

  return (
    <Tooltip label={title} openDelay={350} withArrow>
      <span className="seo-table-primary-cell">
        <span className="seo-table-primary-icon" aria-hidden>
          <IconBox size={15} />
        </span>
        <span className="seo-table-primary-copy">
          <span className="seo-table-primary-title">{title}</span>
        </span>
      </span>
    </Tooltip>
  )
}

function ConsumableProductUnitCell({ value }: { value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <span className="seo-table-tag is-neutral consumable-product-unit">{value}</span>
    </Tooltip>
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
        label={t('Послуги')}
        onChange={(event) => setSupplyServiceCategory(event.currentTarget.checked)}
      />
      <Group justify="flex-end">
        <Button color="gray" leftSection={<IconX size={16} />} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button
          color={CREATE_ACTION_COLOR}
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
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} loading={isSubmitting} onClick={submit}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}

function isConsumableProductSortId(id: string): id is ConsumableProductSortId {
  return id === 'name' || id === 'vendorCode' || id === 'measureUnit'
}

function sortConsumableProducts(
  products: ConsumableProduct[],
  sortState: ConsumableProductSortState,
): ConsumableProduct[] {
  if (!sortState) {
    return products
  }

  const direction = sortState.direction === 'asc' ? 1 : -1

  return [...products].sort(
    (firstProduct, secondProduct) =>
      getConsumableProductSortValue(firstProduct, sortState.id).localeCompare(
        getConsumableProductSortValue(secondProduct, sortState.id),
        'uk',
        {
          numeric: true,
          sensitivity: 'base',
        },
      ) * direction,
  )
}

function getConsumableProductSortValue(product: ConsumableProduct, id: ConsumableProductSortId): string {
  switch (id) {
    case 'measureUnit':
      return product.MeasureUnit?.Name || ''
    case 'name':
      return product.Name || ''
    case 'vendorCode':
      return product.VendorCode || ''
  }
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

function requestCategories(
  searchValue: string,
  hasSearchInput: boolean,
  refreshToken?: number,
): Promise<ConsumableProductCategory[]> {
  const normalizedSearchValue = searchValue.trim()
  const requestOptions = { refreshToken }

  if (hasSearchInput && normalizedSearchValue) {
    return searchConsumableProductCategories(normalizedSearchValue, requestOptions)
  }

  return getConsumableProductCategories(requestOptions)
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
