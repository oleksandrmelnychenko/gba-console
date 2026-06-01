import { notifications } from '@mantine/notifications'
import { type KeyboardEvent, useCallback, useEffect, useReducer, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getProductByNetId, getProductReservationByNetId, getProducts } from '../api/productsApi'
import type { Product, ProductSearchMode, ProductSortMode } from '../types'
import type { ProductDetailPanel } from '../pages/ProductDetailPage'
import {
  type CarouselMode,
  DEFAULT_SEARCH_MODE,
  DEFAULT_SORT_MODE,
  dedupeProductsBySet,
  getNextSearchedProducts,
  getProductIdentity,
  inlineDetailReducer,
  isEditableKeyboardTarget,
  PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  VIRTUAL_PAGE_SIZE,
} from '../assortmentModel'

export function useAssortment() {
  const { t } = useI18n()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const routeProductNetId = urlSearchParams.get('netId')?.trim() || ''
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
  const [searchMode, setSearchMode] = useValueState<ProductSearchMode>(DEFAULT_SEARCH_MODE)
  const [sortMode, setSortMode] = useValueState<ProductSortMode>(DEFAULT_SORT_MODE)
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
  const routeProductRequestRef = useRef(0)
  const loadedIdsRef = useRef<Set<string>>(new Set())
  const hasMoreRef = useRef(true)
  const selectedProductRef = useRef<Product | null>(selectedProduct)
  const selectedProductNetUid = selectedProduct?.NetUid?.trim() || ''
  const productForView = detailState.product || selectedProduct
  const canMoveBack = topProducts.length > 0
  const canMoveForward = bottomProducts.length > 0
  selectedProductRef.current = selectedProduct

  const clearRouteProductParam = useCallback(() => {
    routeProductRequestRef.current += 1

    if (!routeProductNetId) {
      return
    }

    setUrlSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      nextParams.delete('netId')

      return nextParams
    }, { replace: true })
  }, [routeProductNetId, setUrlSearchParams])

  const applySearchResults = useCallback(
    (nextProducts: Product[]) => {
      setActivePanel(null)
      dispatchDetail({ type: 'clear' })

      if (nextProducts.length === 0) {
        loadedIdsRef.current = new Set()
        hasMoreRef.current = false
        setTopProducts([])
        setBottomProducts([])
        setSelectedProduct(null)
        setCarouselMode('search')
        setLoadedProductsCount(0)
        return
      }

      setLoadedProductsCount(nextProducts.length)

      const seen = new Set<string>()
      const unique = dedupeProductsBySet(nextProducts, seen)

      if (unique.length === 1) {
        const nextProduct = unique[0]
        const tail = dedupeProductsBySet(getNextSearchedProducts(nextProduct), seen)

        loadedIdsRef.current = seen
        hasMoreRef.current = false // a single match → bottom is the curated "next" list, not offset-paged
        setTopProducts([])
        setBottomProducts(tail)
        setSelectedProduct(nextProduct)
        setCarouselMode('selection')
        return
      }

      loadedIdsRef.current = seen
      hasMoreRef.current = true
      const halfLength = Math.ceil(unique.length / 2)

      setTopProducts(unique.slice(0, halfLength))
      setBottomProducts(unique.slice(halfLength))
      setSelectedProduct(null)
      setCarouselMode('search')
    },
    [
      setActivePanel,
      setBottomProducts,
      setCarouselMode,
      setLoadedProductsCount,
      setSelectedProduct,
      setTopProducts,
    ],
  )

  const loadProducts = useCallback(
    async ({
      append,
      limit,
      offset,
      searchMode: nextSearchMode,
      sortMode: nextSortMode,
      value,
    }: {
      append: boolean
      limit: number
      offset: number
      searchMode: ProductSearchMode
      sortMode: ProductSortMode
      value: string
    }) => {
      const requestId = ++searchRequestRef.current

      setLoading(true)
      setError(null)

      try {
        const nextProducts = await getProducts({
          limit,
          offset,
          searchMode: nextSearchMode,
          sortMode: nextSortMode,
          value,
        })

        if (requestId === searchRequestRef.current) {
          if (append) {
            const uniqueProducts = dedupeProductsBySet(nextProducts, loadedIdsRef.current)
            hasMoreRef.current = nextProducts.length >= limit && uniqueProducts.length > 0

            if (uniqueProducts.length > 0) {
              setBottomProducts((currentProducts) => [...currentProducts, ...uniqueProducts])
            }

            setLoadedProductsCount((currentCount) => currentCount + nextProducts.length)
            setVirtualLoad(false)
          } else {
            applySearchResults(nextProducts)
          }
        }
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
        searchMode,
        sortMode,
        value: searchValue,
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasRequestedProducts, loadProducts, reloadKey, searchValue, searchMode, sortMode])

  useEffect(() => {
    function handleArrowNavigation(event: globalThis.KeyboardEvent) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return
      }

      const target = event.target instanceof Element ? event.target : null
      const insideCarousel = !!target && !!target.closest('.product-assortment-carousel')

      // Outside the drum: only while actively browsing a selection, and never while typing in another field.
      // Inside the drum (incl. the search box) arrows always drive the wheel.
      if (!insideCarousel && (carouselMode !== 'selection' || isEditableKeyboardTarget(event.target))) {
        return
      }

      event.preventDefault()

      if (event.key === 'ArrowUp') {
        selectPreviousProduct()
      } else {
        selectNextProduct()
      }
    }

    window.addEventListener('keydown', handleArrowNavigation)

    return () => {
      window.removeEventListener('keydown', handleArrowNavigation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselMode, selectNextProduct, selectPreviousProduct])

  useEffect(() => {
    if (!routeProductNetId) {
      return
    }

    const requestId = ++routeProductRequestRef.current

    searchRequestRef.current += 1
    detailRequestRef.current += 1

    async function loadRouteProduct() {
      if (requestId !== routeProductRequestRef.current) {
        return
      }

      try {
        const nextProduct = await getProductByNetId(routeProductNetId)

        if (requestId === routeProductRequestRef.current) {
          setVirtualLoad(false)

          if (!nextProduct) {
            setTopProducts([])
            setBottomProducts([])
            setSelectedProduct(null)
            dispatchDetail({ type: 'clear' })
            setActivePanel(null)
            setCarouselMode('search')
            setLoadedProductsCount(0)
            setHasRequestedProducts(false)
            setSearchDraft('')
            setSearchValue('')
            setError(t('Товар не знайдено'))
          } else {
            const seen = new Set<string>([getProductIdentity(nextProduct)])
            const tail = dedupeProductsBySet(getNextSearchedProducts(nextProduct), seen)

            loadedIdsRef.current = seen
            hasMoreRef.current = false
            setTopProducts([])
            setBottomProducts(tail)
            setLoadedProductsCount(1)
            setSelectedProduct(nextProduct)
            dispatchDetail({ type: 'clear' })
            setActivePanel(null)
            setCarouselMode('selection')
            setHasRequestedProducts(false)
            setSearchDraft('')
            setSearchValue('')
            setError(null)
          }
        }
      } catch (loadError) {
        if (requestId === routeProductRequestRef.current) {
          setTopProducts([])
          setBottomProducts([])
          setSelectedProduct(null)
          dispatchDetail({ type: 'clear' })
          setActivePanel(null)
          setCarouselMode('search')
          setLoadedProductsCount(0)
          setHasRequestedProducts(false)
          setSearchDraft('')
          setSearchValue('')
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'))
        }
      } finally {
        if (requestId === routeProductRequestRef.current) {
          setLoading(false)
        }
      }
    }

    void loadRouteProduct()
  }, [
    routeProductNetId,
    setActivePanel,
    setBottomProducts,
    setCarouselMode,
    setError,
    setHasRequestedProducts,
    setLoadedProductsCount,
    setLoading,
    setSearchDraft,
    setSearchValue,
    setSelectedProduct,
    setTopProducts,
    setVirtualLoad,
    t,
  ])

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
            product: nextProduct || selectedProductRef.current,
            reservation: nextReservationResult.value,
            reservationError: nextReservationResult.error,
            type: 'success',
          })
        }
      } catch (loadError) {
        if (requestId === detailRequestRef.current) {
          dispatchDetail({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'),
            product: selectedProductRef.current,
            type: 'error',
          })
        }
      }
    }

    void loadProductDetails()
  }, [
    detailReloadKey,
    selectedProductNetUid,
    t,
  ])

  function updateSearchDraft(nextValue: string) {
    clearRouteProductParam()
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
    setHasRequestedProducts(true)
    setCarouselMode('search')
    setSelectedProduct(null)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
  }

  function commitSearch() {
    clearRouteProductParam()
    setSearchValue(searchDraft.trim())
    setHasRequestedProducts(true)
    reload()
  }

  function resetSearch() {
    clearRouteProductParam()
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

  function changeSearchMode(nextValue: string | null) {
    clearRouteProductParam()
    setSearchMode((nextValue || DEFAULT_SEARCH_MODE) as ProductSearchMode)
    setSearchDraft(searchValue) // re-run with the last committed query, keep the box in sync
    setHasRequestedProducts(true)
  }

  function changeSortMode(nextValue: string | null) {
    clearRouteProductParam()
    setSortMode((nextValue || DEFAULT_SORT_MODE) as ProductSortMode)
    setSearchDraft(searchValue) // re-run with the last committed query, keep the box in sync
    setHasRequestedProducts(true)
  }

  function loadMoreProducts() {
    if (!hasRequestedProducts || isLoading || isVirtualLoad || !hasMoreRef.current) {
      return
    }

    setVirtualLoad(true)
    void loadProducts({
      append: true,
      limit: VIRTUAL_PAGE_SIZE,
      offset: loadedProductsCount,
      searchMode,
      sortMode,
      value: searchValue,
    })
  }

  function selectProduct(product: Product) {
    clearRouteProductParam()
    const productId = getProductIdentity(product)

    setTopProducts((currentProducts) => currentProducts.filter((item) => getProductIdentity(item) !== productId))
    setBottomProducts((currentProducts) => currentProducts.filter((item) => getProductIdentity(item) !== productId))
    setSelectedProduct(product)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectRelatedProduct(product: Partial<Product>) {
    clearRouteProductParam()
    const netUid = product.NetUid?.trim()

    if (!netUid) {
      notifications.show({ color: 'yellow', message: t('Не вдалося відкрити повʼязаний товар') })
      return
    }

    const nextProduct = { ...product, NetUid: netUid } as Product
    const seen = new Set<string>([getProductIdentity(nextProduct)])
    const tail = dedupeProductsBySet(getNextSearchedProducts(nextProduct), seen)

    loadedIdsRef.current = seen
    hasMoreRef.current = false
    setTopProducts([])
    setBottomProducts(tail)
    setLoadedProductsCount(1)
    setSelectedProduct(nextProduct)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectPreviousProduct() {
    clearRouteProductParam()
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
    clearRouteProductParam()
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

    if (bottomProducts.length - 1 <= 6) {
      loadMoreProducts()
    }
  }

  function returnToSearchMode() {
    clearRouteProductParam()
    setCarouselMode('search')
    setSearchDraft('')
    setSelectedProduct(null)
    dispatchDetail({ type: 'clear' })
    setActivePanel(null)
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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

  function handleAssortmentUploadSuccess() {
    setHasRequestedProducts(true)
    reload()

    if (selectedProductNetUid) {
      reloadProductDetail()
    }
  }

  return {
    activePanel,
    bottomProducts,
    canMoveBack,
    canMoveForward,
    carouselMode,
    changeSearchMode,
    changeSortMode,
    commitSearch,
    detailState,
    error,
    handleAssortmentUploadSuccess,
    handleCarouselKeyDown,
    handleProductSaved,
    isLoading,
    isVirtualLoad,
    productForView,
    reloadProductDetail,
    resetSearch,
    searchDraft,
    searchMode,
    selectNextProduct,
    selectPreviousProduct,
    selectProduct,
    selectRelatedProduct,
    selectedProduct,
    setActivePanel,
    sortMode,
    topProducts,
    updateSearchDraft,
  }
}
