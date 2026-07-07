import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getProductGroupProducts, getRedirectedProductByNetId } from '../api/productGroupsApi'
import type { ProductProductGroup } from '../types'
import { displayValue } from '../utils'

const PAGE_LIMIT_OPTIONS = ['15', '25', '50', '100', '150', '200']
const DEFAULT_PAGE_LIMIT = 15
const PRODUCT_GROUP_SEARCH_DEBOUNCE_MS = 300

const PRODUCTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'name'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type ProductGroupProductsPanelProps = {
  productGroupNetId: string
}

export function ProductGroupProductsPanel({ productGroupNetId }: ProductGroupProductsPanelProps) {
  const { t } = useI18n()
  const [productLinks, setProductLinks] = useValueState<ProductProductGroup[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue] = useDebouncedValue(searchDraft.trim(), PRODUCT_GROUP_SEARCH_DEBOUNCE_MS)
  const [limit, setLimit] = useValueState(DEFAULT_PAGE_LIMIT)
  const [totalFilteredQty, setTotalFilteredQty] = useValueState(0)
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isRedirecting, setRedirecting] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity(
    `product-group-products-${productGroupNetId}`,
    PRODUCTS_TABLE_DEFAULT_LAYOUT.density,
  )
  const loadSequenceRef = useRef(0)
  const canLoadMore = productLinks.length < totalFilteredQty
  const openProduct = useCallback(
    async (productLink: ProductProductGroup) => {
      const productNetId = productLink.Product?.NetUid?.trim()

      if (!productNetId || isRedirecting) {
        return
      }

      const productWindow = window.open('about:blank', '_blank')

      if (productWindow) {
        productWindow.opener = null
      }

      setRedirecting(true)

      try {
        const product = await getRedirectedProductByNetId(productNetId)
        const targetNetId = product?.NetUid?.trim() || productNetId
        const targetUrl = `/products?netId=${encodeURIComponent(targetNetId)}`

        if (productWindow) {
          productWindow.location.href = targetUrl
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer')
        }
      } catch (redirectError) {
        productWindow?.close()
        notifications.show({
          color: 'red',
          message: redirectError instanceof Error ? redirectError.message : t('Не вдалося відкрити товар'),
        })
      } finally {
        setRedirecting(false)
      }
    },
    [isRedirecting, setRedirecting, t],
  )
  const columns = useMemo<DataTableColumn<ProductProductGroup>[]>(
    () => [
      {
        id: 'vendorCode',
        header: 'Артикул',
        width: 140,
        minWidth: 120,
        accessor: (productLink) => productLink.Product?.VendorCode,
        cell: (productLink) => displayValue(productLink.Product?.VendorCode),
      },
      {
        id: 'name',
        header: 'Назва',
        width: 260,
        minWidth: 220,
        accessor: (productLink) => productLink.Product?.NameUA || productLink.Product?.Name,
        cell: (productLink) => (
          <Text fw={600}>{displayValue(productLink.Product?.NameUA || productLink.Product?.Name)}</Text>
        ),
      },
      {
        id: 'additionalName',
        header: 'Додаткова назва',
        width: 220,
        minWidth: 180,
        accessor: (productLink) => productLink.Product?.Name,
        cell: (productLink) => displayValue(productLink.Product?.Name),
      },
      {
        id: 'measureUnit',
        header: 'Од. виміру',
        width: 128,
        minWidth: 104,
        accessor: (productLink) => productLink.Product?.MeasureUnit?.Name,
        cell: (productLink) => displayValue(productLink.Product?.MeasureUnit?.Name),
      },
      {
        id: 'originalNumber',
        header: 'Ориг. номер',
        width: 170,
        minWidth: 140,
        accessor: (productLink) => productLink.Product?.MainOriginalNumber,
        cell: (productLink) => displayValue(productLink.Product?.MainOriginalNumber),
      },
      {
        id: 'description',
        header: 'Опис',
        width: 300,
        minWidth: 180,
        accessor: (productLink) => productLink.Product?.Description || productLink.Product?.DescriptionUA,
        cell: (productLink) => displayValue(productLink.Product?.Description || productLink.Product?.DescriptionUA),
      },
    ],
    [],
  )
  const toolbarLeft = useMemo(
    () =>
      searchValue ? (
        <Text size="xs" c="dimmed">
          {t('Пошук')}: {searchValue}
        </Text>
      ) : null,
    [searchValue, t],
  )

  const loadProducts = useCallback(
    async (offset: number, append: boolean) => {
      const loadSequence = loadSequenceRef.current + 1

      loadSequenceRef.current = loadSequence

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      setError(null)

      try {
        const response = await getProductGroupProducts({
          limit,
          netId: productGroupNetId,
          offset,
          value: searchValue,
        })

        if (loadSequence === loadSequenceRef.current) {
          setProductLinks((currentProductLinks) =>
            append ? [...currentProductLinks, ...response.ProductProductGroups] : response.ProductProductGroups,
          )
          setTotalFilteredQty(response.TotalFilteredQty)
          setTotalQty(response.TotalQty)
        }
      } catch (loadError) {
        if (loadSequence === loadSequenceRef.current) {
          if (!append) {
            setProductLinks([])
            setTotalFilteredQty(0)
            setTotalQty(0)
          }

          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари'))
        }
      } finally {
        if (loadSequence === loadSequenceRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [limit, productGroupNetId, searchValue, setError, setLoading, setLoadingMore, setProductLinks, setTotalFilteredQty, setTotalQty, t],
  )

  useEffect(() => {
    void loadProducts(0, false)
  }, [loadProducts, reloadKey])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
  }

  function resetSearch() {
    setSearchDraft('')
  }

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
        <TextInput
          leftSection={<Search size={16} />}
          label={t('Пошук')}
          placeholder={t('Назва, артикул або опис')}
          value={searchDraft}
          onChange={(event) => updateSearch(event.currentTarget.value)}
          style={{ flex: '1 1 auto', minWidth: 160 }}
        />
        <Select
          aria-label={t('Кількість')}
          data={PAGE_LIMIT_OPTIONS}
          value={String(limit)}
          w={96}
          onChange={(value) => setLimit(Number(value || DEFAULT_PAGE_LIMIT))}
        />
        <Tooltip label={t('Скинути')}>
          <ActionIcon
            aria-label={t('Скинути')}
            color="gray"
            size={36}
            style={{ flex: '0 0 auto' }}
            variant="light"
            onClick={resetSearch}
          >
            <RotateCcw size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={36}
            style={{ flex: '0 0 auto' }}
            variant="light"
            onClick={() => reload()}
          >
            <RefreshCw size={18} />
          </ActionIcon>
        </Tooltip>
        <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
      </Group>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={productLinks}
        defaultLayout={PRODUCTS_TABLE_DEFAULT_LAYOUT}
        density={density}
        emptyText="Товарів не знайдено"
        getRowId={(productLink, index) => String(productLink.Product?.NetUid || productLink.Id || index)}
        isLoading={isLoading}
        layoutVersion="product-group-products-table-1"
        loadingText="Завантаження товарів"
        maxHeight="calc(100vh - 420px)"
        minWidth={1220}
        tableId={`product-group-products-${productGroupNetId}`}
        toolbarLeft={toolbarLeft}
        onRowClick={(productLink) => void openProduct(productLink)}
      />

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {t('Показано')}: {totalFilteredQty}; {t('Усього')}: {totalQty}
        </Text>
        <Button
          color="gray"
          disabled={!canLoadMore}
          loading={isLoadingMore}
          size="xs"
          variant="light"
          onClick={() => loadProducts(productLinks.length, true)}
        >
          {t('Завантажити ще')}
        </Button>
      </Group>
    </Stack>
  )
}
