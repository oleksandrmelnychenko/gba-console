import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Menu,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFileDescription,
  IconHistory,
  IconPackage,
  IconPhoto,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getProducts } from '../api/productsApi'
import type { Product, ProductSearchMode, ProductSortMode } from '../types'
import {
  displayValue,
  formatAmount,
  formatPrice,
  getBooleanBadgeColor,
  getProductAvailableQty,
  getProductCode,
  getProductGroupNames,
  getProductMainOriginalNumber,
  getProductTitle,
  PRODUCT_SEARCH_MODE_OPTIONS,
  PRODUCT_SORT_MODE_OPTIONS,
} from '../utils'

const PRODUCTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'vendorCode', 'name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const pageSizeOptions = ['20', '40', '80']
type ProductDetailPanel = 'edit' | 'images' | 'movement' | 'remains' | 'specification' | 'storage-history' | 'writeoff'

export function ProductsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [products, setProducts] = useValueState<Product[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(20)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [searchMode, setSearchMode] = useValueState<ProductSearchMode>('5')
  const [sortMode, setSortMode] = useValueState<ProductSortMode>('2')
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const canMoveBack = page > 1
  const canMoveForward = products.length === pageSize
  const openProduct = useCallback(
    (product: Product, panel?: ProductDetailPanel) => {
      if (!product.NetUid) {
        return
      }

      navigate(`/products/${product.NetUid}${panel ? `?panel=${panel}` : ''}`, {
        state: {
          nodeTitle: getProductCode(product),
        },
      })
    },
    [navigate],
  )
  const columns = useProductsColumns(openProduct)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      setLoading(true)
      setError(null)

      try {
        const nextProducts = await getProducts({
          limit: pageSize,
          offset,
          searchMode,
          sortMode,
          value: searchValue,
        })

        if (!cancelled) {
          setProducts(nextProducts)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProducts([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      cancelled = true
    }
  }, [offset, pageSize, reloadKey, searchMode, searchValue, setError, setLoading, setProducts, sortMode, t])

  function updateSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetSearch() {
    setPage(1)
    setSearchDraft('')
    setSearchValue('')
    setSearchMode('5')
    setSortMode('2')
  }

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Код, назва, опис, розмір або оригінальний номер')}
              value={searchDraft}
              style={{ flex: '1 1 260px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <Select
              label={t('Поле')}
              data={PRODUCT_SEARCH_MODE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
              value={searchMode}
              w={210}
              onChange={(value) => {
                setPage(1)
                setSearchMode((value as ProductSearchMode | null) || '5')
              }}
            />
            <Select
              label={t('Сортування')}
              data={PRODUCT_SORT_MODE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
              value={sortMode}
              w={160}
              onChange={(value) => {
                setPage(1)
                setSortMode((value as ProductSortMode | null) || '2')
              }}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetSearch}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Показано')} {products.length}, {t('сторінка')} {page}
              {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={84}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value || 20))
                }}
              />
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={!canMoveBack || isLoading}
                variant="light"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={!canMoveForward || isLoading}
                variant="light"
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={products}
            defaultLayout={PRODUCTS_TABLE_DEFAULT_LAYOUT}
            emptyText="Товарів не знайдено"
            getRowId={(product, index) => String(product.NetUid || product.Id || index)}
            isLoading={isLoading}
            layoutVersion="products-table-1"
            loadingText="Завантаження товарів"
            maxHeight="calc(100vh - 330px)"
            minWidth={1590}
            tableId="products"
            onRowClick={openProduct}
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function useProductsColumns(openProduct: (product: Product, panel?: ProductDetailPanel) => void): DataTableColumn<Product>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        id: 'status',
        header: 'Статус',
        width: 112,
        minWidth: 104,
        accessor: (product) => (product.Deleted ? t('Видалений') : t('Активний')),
        cell: (product) => (
          <Badge color={product.Deleted ? 'gray' : 'green'} variant="light">
            {product.Deleted ? t('Видалений') : t('Активний')}
          </Badge>
        ),
      },
      {
        id: 'vendorCode',
        header: 'Код',
        width: 150,
        minWidth: 132,
        accessor: (product) => product.VendorCode,
        cell: (product) => (
          <Text fw={700}>{getProductCode(product)}</Text>
        ),
      },
      {
        id: 'name',
        header: 'Назва',
        width: 300,
        minWidth: 230,
        accessor: getProductTitle,
        cell: (product) => (
          <>
            <Text fw={600}>{getProductTitle(product)}</Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {displayValue(product.DescriptionUA || product.Description)}
            </Text>
          </>
        ),
      },
      {
        id: 'group',
        header: 'Групи',
        width: 230,
        minWidth: 180,
        accessor: getProductGroupNames,
        cell: (product) => displayValue(getProductGroupNames(product)),
      },
      {
        id: 'originalNumber',
        header: 'Оригінальний номер',
        width: 180,
        minWidth: 150,
        accessor: getProductMainOriginalNumber,
        cell: (product) => displayValue(getProductMainOriginalNumber(product)),
      },
      {
        id: 'qty',
        header: 'Доступно',
        width: 126,
        minWidth: 108,
        align: 'right',
        accessor: getProductAvailableQty,
        cell: (product) => formatAmount(getProductAvailableQty(product)),
      },
      {
        id: 'price',
        header: 'Ціна EUR',
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (product) => product.CurrentPrice,
        cell: (product) => formatPrice(product.CurrentPrice),
      },
      {
        id: 'localPrice',
        header: 'Ціна лок.',
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (product) => product.CurrentLocalPrice,
        cell: (product) => formatPrice(product.CurrentLocalPrice),
      },
      {
        id: 'unit',
        header: 'Од.',
        width: 90,
        minWidth: 80,
        accessor: (product) => product.MeasureUnit?.Name,
        cell: (product) => displayValue(product.MeasureUnit?.Name),
      },
      {
        id: 'top',
        header: 'Top',
        width: 90,
        minWidth: 80,
        accessor: (product) => product.Top,
        cell: (product) => displayValue(product.Top),
      },
      {
        id: 'flags',
        header: 'Ознаки',
        width: 230,
        minWidth: 190,
        enableSorting: false,
        cell: (product) => (
          <Group gap={4} wrap="wrap">
            <Badge color={getBooleanBadgeColor(product.IsForSale)} variant="light" size="xs">
              {t('Продаж')}
            </Badge>
            <Badge color={getBooleanBadgeColor(product.IsForWeb)} variant="light" size="xs">
              {t('Сайт')}
            </Badge>
            <Badge color={getBooleanBadgeColor(product.HasImage)} variant="light" size="xs">
              {t('Фото')}
            </Badge>
          </Group>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (product) => <ProductActionsMenu product={product} openProduct={openProduct} />,
      },
    ],
    [openProduct, t],
  )
}

function ProductActionsMenu({
  openProduct,
  product,
}: {
  openProduct: (product: Product, panel?: ProductDetailPanel) => void
  product: Product
}) {
  const { t } = useI18n()
  const productCode = getProductCode(product)

  return (
    <Box onClick={(event) => event.stopPropagation()}>
      <Menu withinPortal position="bottom-end" shadow="xl" radius="md" width={304} offset={5}>
        <Menu.Target>
          <ActionIcon
            aria-label={`${t('Дії товару')}: ${productCode}`}
            color="violet"
            disabled={!product.NetUid}
            size={34}
            title={t('Дії товару')}
            variant="light"
          >
            <IconDotsVertical size={18} stroke={2.2} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{productCode}</Menu.Label>
          <Menu.Item
            color="violet"
            leftSection={<ProductMenuIcon color="violet"><IconEye size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product)}
          >
            {t('Відкрити картку')}
          </Menu.Item>

          <Menu.Divider />
          <Menu.Label>{t('Дані товару')}</Menu.Label>
          <Menu.Item
            leftSection={<ProductMenuIcon color="blue"><IconHistory size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'storage-history')}
          >
            {t('Історія місця зберігання')}
          </Menu.Item>
          <Menu.Item
            leftSection={<ProductMenuIcon color="cyan"><IconFileDescription size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'specification')}
          >
            {t('Специфікація')}
          </Menu.Item>
          <Menu.Item
            leftSection={<ProductMenuIcon color="grape"><IconPhoto size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'images')}
          >
            {t('Зображення')}
          </Menu.Item>
          <Menu.Item
            leftSection={<ProductMenuIcon color="teal"><IconPackage size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'remains')}
          >
            {t('Залишки по партіям')}
          </Menu.Item>

          <Menu.Divider />
          <Menu.Label>{t('Операції')}</Menu.Label>
          <Menu.Item
            leftSection={<ProductMenuIcon color="orange"><IconEdit size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'edit')}
          >
            {t('Редагувати')}
          </Menu.Item>
          <Menu.Item
            leftSection={<ProductMenuIcon color="indigo"><IconArrowsExchange size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'movement')}
          >
            {t('Рух товару')}
          </Menu.Item>
          <Menu.Item
            leftSection={<ProductMenuIcon color="red"><IconClipboardList size={16} /></ProductMenuIcon>}
            onClick={() => openProduct(product, 'writeoff')}
          >
            {t('Правила списання')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Box>
  )
}

function ProductMenuIcon({ children, color }: { children: ReactNode; color: string }) {
  return (
    <ThemeIcon color={color} radius="xl" size={24} variant="light">
      {children}
    </ThemeIcon>
  )
}
