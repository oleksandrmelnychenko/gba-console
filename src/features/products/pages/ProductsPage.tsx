import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconEdit,
  IconFileDescription,
  IconHistory,
  IconPackage,
  IconPhoto,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getProductByNetId,
  getProductMovements,
  getProductReservationByNetId,
  getProducts,
} from '../api/productsApi'
import type { Product, ProductMovement, ProductReservation } from '../types'
import {
  displayValue,
  formatAmount,
  formatPrice,
  getBooleanBadgeColor,
  getProductCode,
  getProductGroupNames,
  getProductMainImage,
  getProductMainOriginalNumber,
  getProductOriginalNumbers,
  getProductTitle,
} from '../utils'
import { ProductActionDrawer, ProductStockSummary, type ProductDetailPanel } from './ProductDetailPage'
import './products.css'

const PAGE_SIZE = 20
const VIRTUAL_PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const SEARCH_MODE = '5'
const SORT_MODE = '2'
const movementItemTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const inlineMovementLabels = {
  income: {
    empty: 'Приходів не знайдено',
    loading: 'Завантаження приходів',
  },
  outcome: {
    empty: 'Виходів не знайдено',
    loading: 'Завантаження виходів',
  },
} as const

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type CarouselMode = 'search' | 'selection'
type InlineMovementDirection = 'income' | 'outcome'
type InlineMovementState = {
  error: string | null
  isLoading: boolean
  rows: ProductMovement[]
}
type InlineDetailState = {
  error: string | null
  isLoading: boolean
  product: Product | null
  reservation: ProductReservation
  reservationError: string | null
}
type InlineMovementAction =
  | { type: 'error'; error: string }
  | { type: 'loading' }
  | { type: 'success'; rows: ProductMovement[] }
type InlineDetailAction =
  | { type: 'clear' }
  | { type: 'error'; error: string; product: Product | null }
  | { type: 'loading' }
  | { type: 'saved'; product: Product }
  | { type: 'success'; product: Product | null; reservation: ProductReservation; reservationError: string | null }

export function ProductsPage() {
  const { t } = useI18n()
  const [topProducts, setTopProducts] = useValueState<Product[]>([])
  const [bottomProducts, setBottomProducts] = useValueState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useValueState<Product | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [hasRequestedProducts, setHasRequestedProducts] = useValueState(false)
  const [isVirtualLoad, setVirtualLoad] = useValueState(false)
  const [loadedProductsCount, setLoadedProductsCount] = useValueState(0)
  const [carouselMode, setCarouselMode] = useValueState<CarouselMode>('search')
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [activePanel, setActivePanel] = useValueState<ProductDetailPanel | null>(null)
  const [detailState, dispatchDetail] = useReducer(inlineDetailReducer, {
    error: null,
    isLoading: false,
    product: null,
    reservation: {},
    reservationError: null,
  })
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [detailReloadKey, reloadProductDetail] = useReducer((key: number) => key + 1, 0)
  const searchRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const selectedProductNetUid = selectedProduct?.NetUid?.trim() || ''
  const productForView = detailState.product || selectedProduct
  const canMoveBack = topProducts.length > 0
  const canMoveForward = bottomProducts.length > 0

  const applySearchResults = useCallback(
    (nextProducts: Product[]) => {
      setActivePanel(null)
      dispatchDetail({ type: 'clear' })

      if (nextProducts.length === 0) {
        setTopProducts([])
        setBottomProducts([])
        setSelectedProduct(null)
        setCarouselMode('search')
        setLoadedProductsCount(0)
        return
      }

      setLoadedProductsCount(nextProducts.length)

      if (nextProducts.length === 1) {
        const nextProduct = nextProducts[0]

        setTopProducts([])
        setBottomProducts(getNextSearchedProducts(nextProduct))
        setSelectedProduct(nextProduct)
        setCarouselMode('selection')
        setSearchDraft('')
        return
      }

      const halfLength = Math.ceil(nextProducts.length / 2)

      setTopProducts(nextProducts.slice(0, halfLength))
      setBottomProducts(nextProducts.slice(halfLength))
      setSelectedProduct(null)
      setCarouselMode('search')
    },
    [
      setActivePanel,
      setBottomProducts,
      setCarouselMode,
      setLoadedProductsCount,
      setSearchDraft,
      setSelectedProduct,
      setTopProducts,
    ],
  )

  const loadProducts = useCallback(
    async ({
      append,
      limit,
      offset,
      value,
    }: {
      append: boolean
      limit: number
      offset: number
      value: string
    }) => {
      const requestId = ++searchRequestRef.current

      setLoading(true)
      setError(null)

      try {
        const nextProducts = await getProducts({
          limit,
          offset,
          searchMode: SEARCH_MODE,
          sortMode: SORT_MODE,
          value,
        })

        if (requestId !== searchRequestRef.current) {
          return
        }

        if (append) {
          setBottomProducts((currentProducts) => [...currentProducts, ...nextProducts])
          setLoadedProductsCount((currentCount) => currentCount + nextProducts.length)
          setVirtualLoad(false)
          return
        }

        applySearchResults(nextProducts)
      } catch (loadError) {
        if (requestId === searchRequestRef.current) {
          setTopProducts([])
          setBottomProducts([])
          setSelectedProduct(null)
          dispatchDetail({ type: 'clear' })
          setCarouselMode('search')
          setLoadedProductsCount(0)
          setVirtualLoad(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари'))
        }
      } finally {
        if (requestId === searchRequestRef.current) {
          setLoading(false)
        }
      }
    },
    [
      applySearchResults,
      setBottomProducts,
      setCarouselMode,
      setError,
      setLoadedProductsCount,
      setLoading,
      setSelectedProduct,
      setTopProducts,
      setVirtualLoad,
      t,
    ],
  )

  useEffect(() => {
    if (!hasRequestedProducts) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadProducts({
        append: false,
        limit: PAGE_SIZE,
        offset: 0,
        value: searchValue,
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasRequestedProducts, loadProducts, reloadKey, searchValue])

  useEffect(() => {
    if (!selectedProductNetUid) {
      return
    }

    const requestId = ++detailRequestRef.current

    dispatchDetail({ type: 'loading' })

    async function loadProductDetails() {
      try {
        const [nextProduct, nextReservationResult] = await Promise.all([
          getProductByNetId(selectedProductNetUid),
          getProductReservationByNetId(selectedProductNetUid)
            .then((value) => ({ error: null, value }))
            .catch((reservationLoadError: unknown) => ({
              error: reservationLoadError instanceof Error ? reservationLoadError.message : t('Не вдалося завантажити резерви товару'),
              value: {},
            })),
        ])

        if (requestId === detailRequestRef.current) {
          dispatchDetail({
            product: nextProduct || selectedProduct,
            reservation: nextReservationResult.value,
            reservationError: nextReservationResult.error,
            type: 'success',
          })
        }
      } catch (loadError) {
        if (requestId === detailRequestRef.current) {
          dispatchDetail({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'),
            product: selectedProduct,
            type: 'error',
          })
        }
      }
    }

    void loadProductDetails()
  }, [
    detailReloadKey,
    selectedProduct,
    selectedProductNetUid,
    t,
  ])

  function updateSearchDraft(nextValue: string) {
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
    setHasRequestedProducts(true)
    setCarouselMode('search')
    setSelectedProduct(null)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
  }

  function commitSearch() {
    setSearchValue(searchDraft.trim())
    setHasRequestedProducts(true)
    reload()
  }

  function resetSearch() {
    searchRequestRef.current += 1
    setTopProducts([])
    setBottomProducts([])
    setSelectedProduct(null)
    dispatchDetail({ type: 'clear' })
    setError(null)
    setLoading(false)
    setVirtualLoad(false)
    setLoadedProductsCount(0)
    setHasRequestedProducts(false)
    setCarouselMode('search')
    setSearchDraft('')
    setSearchValue('')
    setActivePanel(null)
  }

  function loadMoreProducts() {
    if (!hasRequestedProducts || isLoading || isVirtualLoad) {
      return
    }

    setVirtualLoad(true)
    void loadProducts({
      append: true,
      limit: VIRTUAL_PAGE_SIZE,
      offset: loadedProductsCount,
      value: searchValue,
    })
  }

  function selectProduct(product: Product) {
    const productId = getProductIdentity(product)

    setTopProducts((currentProducts) => currentProducts.filter((item) => getProductIdentity(item) !== productId))
    setBottomProducts((currentProducts) => currentProducts.filter((item) => getProductIdentity(item) !== productId))
    setSelectedProduct(product)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectPreviousProduct() {
    const nextProduct = topProducts[topProducts.length - 1]

    if (!nextProduct) {
      return
    }

    if (selectedProduct) {
      setBottomProducts((currentProducts) => [selectedProduct, ...currentProducts])
    }

    setTopProducts((currentProducts) => currentProducts.slice(0, -1))
    setSelectedProduct(nextProduct)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectNextProduct() {
    const nextProduct = bottomProducts[0]

    if (!nextProduct) {
      return
    }

    if (selectedProduct) {
      setTopProducts((currentProducts) => [...currentProducts, selectedProduct])
    }

    setBottomProducts((currentProducts) => currentProducts.slice(1))
    setSelectedProduct(nextProduct)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')

    if (bottomProducts.length === 1) {
      loadMoreProducts()
    }
  }

  function returnToSearchMode() {
    setCarouselMode('search')
    setSearchDraft('')
    setSelectedProduct(null)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectPreviousProduct()
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectNextProduct()
    }

    if (event.key === 'Escape' && carouselMode === 'selection') {
      event.preventDefault()
      returnToSearchMode()
    }

    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      commitSearch()
    }
  }

  function handleProductSaved(nextProduct: Product | null) {
    if (nextProduct) {
      dispatchDetail({ product: nextProduct, type: 'saved' })
      setSelectedProduct(nextProduct)
      return
    }

    reloadProductDetail()
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Box className="product-assortment-workspace">
        <ProductAssortmentCarousel
          bottomProducts={bottomProducts}
          canMoveBack={canMoveBack}
          canMoveForward={canMoveForward}
          isLoading={isLoading}
          isSelectionMode={carouselMode === 'selection'}
          isVirtualLoad={isVirtualLoad}
          searchDraft={searchDraft}
          selectedProduct={selectedProduct}
          topProducts={topProducts}
          onKeyDown={handleCarouselKeyDown}
          onNext={selectNextProduct}
          onPrevious={selectPreviousProduct}
          onRefresh={commitSearch}
          onReset={resetSearch}
          onSearchDraftChange={updateSearchDraft}
          onSelectProduct={selectProduct}
        />

        <ProductInlineView
          detailError={detailState.error}
          isLoading={detailState.isLoading}
          product={productForView}
          reservation={detailState.reservation}
          reservationError={detailState.reservationError}
          onOpenPanel={setActivePanel}
          onReload={reloadProductDetail}
        />
      </Box>

      {productForView && (
        <ProductActionDrawer
          activePanel={activePanel}
          product={productForView}
          onClose={() => setActivePanel(null)}
          onProductSaved={handleProductSaved}
          onReload={reloadProductDetail}
        />
      )}
    </Stack>
  )
}

function ProductAssortmentCarousel({
  bottomProducts,
  canMoveBack,
  canMoveForward,
  isLoading,
  isSelectionMode,
  isVirtualLoad,
  onKeyDown,
  onNext,
  onPrevious,
  onRefresh,
  onReset,
  onSearchDraftChange,
  onSelectProduct,
  searchDraft,
  selectedProduct,
  topProducts,
}: {
  bottomProducts: Product[]
  canMoveBack: boolean
  canMoveForward: boolean
  isLoading: boolean
  isSelectionMode: boolean
  isVirtualLoad: boolean
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onNext: () => void
  onPrevious: () => void
  onRefresh: () => void
  onReset: () => void
  onSearchDraftChange: (value: string) => void
  onSelectProduct: (product: Product) => void
  searchDraft: string
  selectedProduct: Product | null
  topProducts: Product[]
}) {
  const { t } = useI18n()

  return (
    <Box className="product-assortment-carousel" role="region" tabIndex={0} onKeyDown={onKeyDown}>
      <Group justify="space-between" className="product-assortment-carousel-header">
        <Text size="xs" c="dimmed" fw={600}>
          {t('Весь асортимент')}
        </Text>
        <Group gap={6}>
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="gray"
              disabled={isLoading}
              variant="light"
              onClick={onReset}
            >
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              variant="light"
              onClick={onRefresh}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Попередній товар')}>
            <ActionIcon
              aria-label={t('Попередній товар')}
              color="gray"
              disabled={!canMoveBack || isLoading}
              variant="light"
              onClick={onPrevious}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Наступний товар')}>
            <ActionIcon
              aria-label={t('Наступний товар')}
              color="gray"
              disabled={!canMoveForward || isLoading}
              variant="light"
              onClick={onNext}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Box className="product-assortment-rail product-assortment-rail-top">
        {isLoading && !isVirtualLoad ? (
          <Stack align="center" justify="center" h="100%">
            <Loader size="sm" />
          </Stack>
        ) : (
          topProducts.slice(-10).map((product) => (
            <ProductCarouselRow
              key={getProductRowKey(product)}
              product={product}
              onSelect={onSelectProduct}
            />
          ))
        )}
      </Box>

      <Box className="product-assortment-drum">
        <TextInput
          autoFocus
          aria-label={t('Пошук товару')}
          leftSection={<IconSearch size={17} />}
          placeholder={t('Код, назва, опис, розмір або оригінальний номер')}
          value={searchDraft}
          className="product-assortment-search-input"
          onChange={(event) => onSearchDraftChange(event.currentTarget.value)}
        />
        {isSelectionMode && selectedProduct ? (
          <>
            <button
              type="button"
              className="product-assortment-selected-code"
              onClick={() => copyToClipboard(getProductCode(selectedProduct))}
            >
              {getProductCode(selectedProduct)}
            </button>
            <ProductMiniDetails product={selectedProduct} />
          </>
        ) : null}
      </Box>

      <Box className="product-assortment-rail product-assortment-rail-bottom">
        {bottomProducts.slice(0, 10).map((product) => (
          <ProductCarouselRow
            key={getProductRowKey(product)}
            product={product}
            onSelect={onSelectProduct}
          />
        ))}
        {isVirtualLoad ? (
          <Group justify="center" py="xs">
            <Loader size="xs" />
          </Group>
        ) : null}
      </Box>
    </Box>
  )
}

function ProductCarouselRow({
  onSelect,
  product,
}: {
  onSelect: (product: Product) => void
  product: Product
}) {
  return (
    <button
      type="button"
      className={`product-carousel-row ${getProductRowToneClass(product)}`}
      onClick={() => onSelect(product)}
    >
      <span className="product-carousel-row-code">{getProductCode(product)}</span>
      <span className="product-carousel-row-name">{getProductTitle(product)}</span>
    </button>
  )
}

function ProductMiniDetails({ product }: { product: Product }) {
  return (
    <Box className="product-mini-details">
      <button
        type="button"
        className={`product-mini-code ${getProductRowToneClass(product)}`}
        onClick={() => copyToClipboard(getProductCode(product))}
      >
        {getProductCode(product)}
      </button>
      <Text component="span" className={`product-mini-name ${getProductRowToneClass(product)}`}>
        {getProductTitle(product)}
      </Text>
      <Text component="span" className={`product-mini-top ${product.Top?.toLowerCase().startsWith('x') ? 'is-critical' : ''}`}>
        {displayValue(product.Top)}
      </Text>
    </Box>
  )
}

function ProductInlineView({
  detailError,
  isLoading,
  onOpenPanel,
  onReload,
  product,
  reservation,
  reservationError,
}: {
  detailError: string | null
  isLoading: boolean
  onOpenPanel: (panel: ProductDetailPanel) => void
  onReload: () => void
  product: Product | null
  reservation: ProductReservation
  reservationError: string | null
}) {
  const { t } = useI18n()

  if (!product) {
    return (
      <Box className="product-inline-view product-inline-view-empty">
        <Text c="dimmed" size="sm">{t('Оберіть товар у барабанчику')}</Text>
      </Box>
    )
  }

  const mainImage = getProductMainImage(product)
  const productImages = product.ProductImages?.filter((image) => image.ImageUrl && !image.Deleted) || []
  const prices = product.CalculatedPrices || []

  return (
    <Box className="product-inline-view">
      <Group align="flex-start" justify="space-between" gap="sm" className="product-inline-title">
        <Box className="product-inline-title-text">
          <Text component="span" fw={800} className="product-inline-code">{getProductCode(product)}</Text>
          <Text component="span" fw={650} className="product-inline-name">{getProductTitle(product)}</Text>
        </Box>
        <Group gap="xs" justify="flex-end" className="product-inline-title-actions">
          <ProductInlineActions disabled={isLoading} onOpenPanel={onOpenPanel} />
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} variant="light" onClick={onReload}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {detailError && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {detailError}
        </Alert>
      )}

      <Box className="product-inline-main">
        <Box className="product-inline-info">
          <Box className="product-inline-image" onClick={() => onOpenPanel('images')}>
            {mainImage?.ImageUrl ? (
              <Image src={mainImage.ImageUrl} alt={getProductTitle(product)} fit="contain" h="100%" w="100%" />
            ) : (
              <IconPackage size={42} stroke={1.5} />
            )}
          </Box>
          {productImages.length > 1 ? (
            <Group gap={6} className="product-inline-thumbs">
              {productImages.slice(0, 8).map((image, index) => (
                <button
                  type="button"
                  className="product-inline-thumb"
                  key={`${image.NetUid || image.ImageUrl || index}`}
                  onClick={() => onOpenPanel('images')}
                >
                  <Image src={image.ImageUrl} alt={image.FileName || getProductTitle(product)} fit="cover" h="100%" w="100%" />
                </button>
              ))}
            </Group>
          ) : null}

          <Box className="product-inline-description">
            <InfoBlock label="Опис" value={product.DescriptionUA || product.Description} wide />
            <InfoBlock label="Нотатки" value={product.NotesUA || product.Notes} wide />
            <InfoBlock label="Top" value={product.Top} />
            <InfoBlock label="Вага" value={formatAmount(product.Weight)} />
            <InfoBlock label="Розмір" value={product.Size} />
            <InfoBlock label="Об'єм" value={product.Volume} />
            <InfoBlock label="Норма пакування" value={product.OrderStandard} />
            <InfoBlock label="Пакування" value={product.PackingStandard} />
            <InfoBlock label="Оригінальний номер" value={getProductMainOriginalNumber(product)} />
            <InfoBlock label="Синоніми UA" value={product.SynonymsUA} />
            <InfoBlock label="Група товару" value={getProductGroupNames(product)} />
            <InfoBlock label="Одиниця" value={product.MeasureUnit?.Name} />
          </Box>
        </Box>

        <Box className="product-inline-stock">
          <ProductStockSummary product={product} reservation={reservation} reservationError={reservationError} />
        </Box>

        <Box className="product-inline-prices">
          <Group justify="space-between" mb="xs">
            <Text fw={700}>{t('Тип ціни')}</Text>
            <Group gap="lg">
              <Text c="dimmed" size="sm">{t('EUR')}</Text>
              <Text c="dimmed" size="sm">{t('UAH')}</Text>
            </Group>
          </Group>
          <Stack gap={4}>
            {prices.length > 0 ? (
              prices.map((price, index) => (
                <Group
                  key={`${price.Pricing?.NetUid || price.Pricing?.Name || index}`}
                  justify="space-between"
                  gap="sm"
                  wrap="nowrap"
                  className="product-inline-price-row"
                >
                  <Text size="sm" lineClamp={1}>{displayValue(price.Pricing?.Name)}</Text>
                  <Group gap="md" wrap="nowrap">
                    <Text size="sm" fw={650}>{formatPrice(price.RetailPriceEUR)}</Text>
                    <Text size="sm" fw={650}>{formatPrice(price.RetailPriceLocal)}</Text>
                  </Group>
                </Group>
              ))
            ) : (
              <Text c="dimmed" size="sm">{t('Цін не знайдено')}</Text>
            )}
          </Stack>
          <Divider my="sm" />
          <Group gap="xs">
            <Badge color={getBooleanBadgeColor(product.IsForZeroSale)} variant="light">{t('Нульовий продаж')}</Badge>
            <Badge color={getBooleanBadgeColor(product.IsForSale)} variant="light">{t('Продаж')}</Badge>
            <Badge color={getBooleanBadgeColor(product.IsForWeb)} variant="light">{t('Сайт')}</Badge>
          </Group>
        </Box>
      </Box>

      <ProductInlineTabs product={product} />
    </Box>
  )
}

function ProductInlineActions({
  disabled,
  onOpenPanel,
}: {
  disabled: boolean
  onOpenPanel: (panel: ProductDetailPanel) => void
}) {
  const { t } = useI18n()

  return (
    <Group gap={6} className="product-inline-actions">
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconHistory size={15} />} onClick={() => onOpenPanel('storage-history')}>
        {t('Історія місця зберігання')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconFileDescription size={15} />} onClick={() => onOpenPanel('specification')}>
        {t('Специфікація')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconPhoto size={15} />} onClick={() => onOpenPanel('images')}>
        {t('Зображення')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconPackage size={15} />} onClick={() => onOpenPanel('remains')}>
        {t('Залишки по партіям')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconEdit size={15} />} onClick={() => onOpenPanel('edit')}>
        {t('Редагувати')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconArrowsExchange size={15} />} onClick={() => onOpenPanel('movement')}>
        {t('Рух товару')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconClipboardList size={15} />} onClick={() => onOpenPanel('writeoff')}>
        {t('Правила списання')}
      </Button>
    </Group>
  )
}

function InfoBlock({
  label,
  value,
  wide,
}: {
  label: string
  value?: ReactNode
  wide?: boolean
}) {
  const { t } = useI18n()

  return (
    <Box className={`product-inline-info-block ${wide ? 'is-wide' : ''}`}>
      <Text c="dimmed" size="xs">{t(label)}</Text>
      <Text size="sm" fw={600}>{displayValue(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined)}</Text>
    </Box>
  )
}

function ProductInlineTabs({ product }: { product: Product }) {
  const { t } = useI18n()
  const originalNumbers = getProductOriginalNumbers(product)

  return (
    <Tabs defaultValue="numbers" className="product-inline-tabs">
      <Tabs.List>
        <Tabs.Tab value="numbers">{t('Оригінальні номери')}</Tabs.Tab>
        <Tabs.Tab value="analogues">{t('Аналоги')}</Tabs.Tab>
        <Tabs.Tab value="components">{t('Комплектуючі')}</Tabs.Tab>
        <Tabs.Tab value="income">{t('Прихід')}</Tabs.Tab>
        <Tabs.Tab value="outcome">{t('Вихід')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="numbers" pt="sm">
        {originalNumbers.length > 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
            {originalNumbers.map((item, index) => (
              <Card withBorder radius="sm" padding="xs" key={`${item.NetUid || item.OriginalNumber?.NetUid || index}`}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={650} size="sm" lineClamp={1}>
                    {displayValue(item.OriginalNumber?.MainNumber || item.OriginalNumber?.Number)}
                  </Text>
                  {item.IsMainOriginalNumber ? <Badge size="xs" color="green" variant="light">{t('Основний')}</Badge> : null}
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        ) : (
          <Text c="dimmed" size="sm">{t('Номерів не знайдено')}</Text>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="analogues" pt="sm">
        <RelatedProductsList items={product.BaseAnalogueProducts || []} emptyLabel={t('Аналогів не знайдено')} />
      </Tabs.Panel>

      <Tabs.Panel value="components" pt="sm">
        <RelatedProductsList items={product.ComponentProducts || product.BaseSetProducts || []} emptyLabel={t('Комплектуючих не знайдено')} />
      </Tabs.Panel>

      <Tabs.Panel value="income" pt="sm">
        <ProductInlineMovementsTab direction="income" product={product} />
      </Tabs.Panel>

      <Tabs.Panel value="outcome" pt="sm">
        <ProductInlineMovementsTab direction="outcome" product={product} />
      </Tabs.Panel>
    </Tabs>
  )
}

function ProductInlineMovementsTab({
  direction,
  product,
}: {
  direction: InlineMovementDirection
  product: Product
}) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const [dateFrom, setDateFrom] = useState(getTodayDate)
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [state, dispatch] = useReducer(inlineMovementReducer, {
    error: null,
    isLoading: Boolean(productNetUid),
    rows: [],
  })
  const labels = inlineMovementLabels[direction]

  useEffect(() => {
    if (!productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid

    async function loadRows() {
      dispatch({ type: 'loading' })

      try {
        const nextRows = await getProductMovements({
          from: dateFrom,
          movementType: 0,
          productNetId: netUid,
          to: dateTo,
          types: movementItemTypes,
        })

        if (!cancelled) {
          dispatch({
            rows: nextRows.filter((row) => (direction === 'income' ? toNumber(row.IncomeQty) > 0 : toNumber(row.OutcomeQty) > 0)),
            type: 'success',
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'),
            type: 'error',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, direction, productNetUid, reloadKey, t])

  return (
    <Stack gap="sm">
      <Group align="end" gap="sm" wrap="wrap">
        <TextInput label={t('З')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <TextInput label={t('По')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Button leftSection={<IconRefresh size={16} />} loading={state.isLoading} variant="light" onClick={() => reload()}>
          {t('Оновити')}
        </Button>
      </Group>

      {!productNetUid ? (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {t('У товару немає NetUid для завантаження руху товару')}
        </Alert>
      ) : state.error ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {state.error}
        </Alert>
      ) : state.isLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">{t(labels.loading)}</Text>
        </Group>
      ) : state.rows.length === 0 ? (
        <Text c="dimmed" size="sm">{t(labels.empty)}</Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder miw={920}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Дата')}</Table.Th>
                <Table.Th>{t('Документ')}</Table.Th>
                <Table.Th>{t('Номер')}</Table.Th>
                <Table.Th>{t('Склад')}</Table.Th>
                <Table.Th>{t('Клієнт')}</Table.Th>
                <Table.Th ta="right">{direction === 'income' ? t('Прихід') : t('Вихід')}</Table.Th>
                <Table.Th ta="right">{t('Кількість')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {state.rows.map((row) => (
                <Table.Tr key={getMovementRowKey(row)}>
                  <Table.Td>{formatInlineDateTime(row.DocumentFromDate || row.FromDate || row.Created)}</Table.Td>
                  <Table.Td>{displayValue(row.DocumentType || row.MovementType)}</Table.Td>
                  <Table.Td>{displayValue(row.DocumentNumber)}</Table.Td>
                  <Table.Td>{displayValue(row.StorageName)}</Table.Td>
                  <Table.Td>{displayValue(row.ClientName)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(direction === 'income' ? row.IncomeQty : row.OutcomeQty)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(row.Qty)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  )
}

function RelatedProductsList({ emptyLabel, items }: { emptyLabel: string; items: unknown[] }) {
  if (items.length === 0) {
    return <Text c="dimmed" size="sm">{emptyLabel}</Text>
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
      {items.map((item) => (
        <Card withBorder radius="sm" padding="xs" key={getRelatedProductKey(item)}>
          <Text fw={650} size="sm" lineClamp={1}>{getRelatedProductCode(item)}</Text>
          <Text c="dimmed" size="xs" lineClamp={2}>{getRelatedProductName(item)}</Text>
        </Card>
      ))}
    </SimpleGrid>
  )
}

function inlineMovementReducer(state: InlineMovementState, action: InlineMovementAction): InlineMovementState {
  switch (action.type) {
    case 'error':
      return {
        error: action.error,
        isLoading: false,
        rows: [],
      }
    case 'loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'success':
      return {
        error: null,
        isLoading: false,
        rows: action.rows,
      }
  }
}

function inlineDetailReducer(state: InlineDetailState, action: InlineDetailAction): InlineDetailState {
  switch (action.type) {
    case 'clear':
      return {
        error: null,
        isLoading: false,
        product: null,
        reservation: {},
        reservationError: null,
      }
    case 'error':
      return {
        error: action.error,
        isLoading: false,
        product: action.product,
        reservation: {},
        reservationError: null,
      }
    case 'loading':
      return {
        ...state,
        error: null,
        isLoading: true,
        reservationError: null,
      }
    case 'saved':
      return {
        ...state,
        error: null,
        isLoading: false,
        product: action.product,
      }
    case 'success':
      return {
        error: null,
        isLoading: false,
        product: action.product,
        reservation: action.reservation,
        reservationError: action.reservationError,
      }
  }
}

function getProductRowKey(product: Product): string {
  return getProductIdentity(product)
}

function getProductIdentity(product: Product): string {
  return String(product.NetUid || product.Id || product.VendorCode || product.Name || 'product')
}

function getProductRowToneClass(product: Product): string {
  const top = product.Top?.trim().toLowerCase()

  if (top === 'x9' || top === 'х9') {
    return 'is-critical'
  }

  if (product.IsForSale) {
    return 'is-sale'
  }

  if (product.IsForZeroSale) {
    return 'is-zero-sale'
  }

  return ''
}

function getNextSearchedProducts(product: Product): Product[] {
  const nextProducts = (product as Product & { NextSearchedProducts?: Product[] }).NextSearchedProducts

  return Array.isArray(nextProducts) ? nextProducts : []
}

function copyToClipboard(value: string) {
  if (!value || !navigator.clipboard) {
    return
  }

  void navigator.clipboard.writeText(value)
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function toNumber(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatInlineDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '-' : dateTimeFormatter.format(date)
}

function getMovementRowKey(row: ProductMovement): string {
  return String(row.NetUid || row.Id || `${row.DocumentNumber || 'movement'}-${row.DocumentFromDate || row.FromDate || row.Created || ''}`)
}

function getRelatedProductKey(item: unknown): string {
  const product = readRelatedProduct(item)

  return String(product?.NetUid || product?.Id || product?.VendorCode || product?.Name || 'related-product')
}

function getRelatedProductCode(item: unknown): string {
  const product = readRelatedProduct(item)

  return displayValue(product?.VendorCode || product?.MainOriginalNumber || product?.NetUid)
}

function getRelatedProductName(item: unknown): string {
  const product = readRelatedProduct(item)

  return displayValue(product?.NameUA || product?.Name || product?.Description)
}

function readRelatedProduct(item: unknown): Partial<Product> | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>
  const nestedProduct = record.Product || record.AnalogueProduct || record.ComponentProduct || record.BaseProduct || record.RelatedProduct

  if (nestedProduct && typeof nestedProduct === 'object') {
    return nestedProduct as Partial<Product>
  }

  return record as Partial<Product>
}
