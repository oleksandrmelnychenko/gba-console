import {
  ActionIcon,
  Alert,
  Button,
  Card,
  FileButton,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from '../../../shared/ui/paginator/paginatorPageSize'
import { getProductSpecifications, uploadSpecificationCodesFile } from '../api/productSpecificationCodesApi'
import { ChangeProductSpecificationPanel } from '../components/ChangeProductSpecificationPanel'
import type { ProductSpecification, SpecificationCodeUploadResult } from '../types'
import './product-specification-codes-page.css'

const pageSizeOptions = PAGINATOR_PAGE_SIZE_OPTIONS
const PRODUCT_SPECIFICATION_CODES_PAGE_SIZE_STORAGE_KEY = 'gba-data-table:product-specification-codes:page-size'
const DEFAULT_PRODUCT_SPECIFICATION_CODES_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const SEARCH_DEBOUNCE_MS = 250

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

function useProductSpecificationCodesModel() {
  const { t } = useI18n()
  const [vendorCodeDraft, setVendorCodeDraft] = useValueState('')
  const [specificationCodeDraft, setSpecificationCodeDraft] = useValueState('')
  const [debouncedVendorCode] = useDebouncedValue(vendorCodeDraft, SEARCH_DEBOUNCE_MS)
  const [debouncedSpecificationCode] = useDebouncedValue(specificationCodeDraft, SEARCH_DEBOUNCE_MS)
  const vendorCode = debouncedVendorCode.trim()
  const specificationCode = debouncedSpecificationCode.trim()
  const [specifications, setSpecifications] = useValueState<ProductSpecification[]>([])
  const [hasMore, setHasMore] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [selected, setSelected] = useValueState<ProductSpecification | null>(null)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(readProductSpecificationCodesPageSize)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize

  useEffect(() => {
    let cancelled = false

    async function loadSpecifications() {
      setLoading(true)
      setError(null)

      try {
        const nextSpecifications = await getProductSpecifications({
          limit: pageSize,
          locale: 'uk',
          offset,
          specificationCode,
          vendorCode,
        })

        if (!cancelled) {
          setSpecifications(nextSpecifications)
          setHasMore(nextSpecifications.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSpecifications([])
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити митні коди'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSpecifications()

    return () => {
      cancelled = true
    }
  }, [offset, pageSize, reloadKey, specificationCode, vendorCode, setError, setHasMore, setLoading, setSpecifications, t])

  function changePageSize(nextPageSize: number) {
    setPage(1)
    setPageSize(nextPageSize)
    writeProductSpecificationCodesPageSize(nextPageSize)
  }

  function resetFilters() {
    setPage(1)
    setVendorCodeDraft('')
    setSpecificationCodeDraft('')
  }

  return {
    error,
    hasMore,
    isLoading,
    page,
    pageSize,
    selected,
    specificationCodeDraft,
    specifications,
    vendorCodeDraft,
    changePageSize,
    reload,
    resetFilters,
    setPage,
    setSelected,
    setSpecificationCodeDraft,
    setVendorCodeDraft,
  }
}

export function ProductSpecificationCodesPage() {
  const { t } = useI18n()
  const model = useProductSpecificationCodesModel()
  const columns = useProductSpecificationColumns(model.specifications)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [uploadResult, setUploadResult] = useValueState<SpecificationCodeUploadResult | null>(null)
  const [isUploading, setUploading] = useValueState(false)

  async function handleUpload(file: File | null) {
    if (!file) {
      return
    }

    setUploading(true)

    try {
      const result = await uploadSpecificationCodesFile(file)
      setUploadResult(result)
      model.reload()
    } catch (uploadError) {
      notifications.show({
        color: 'red',
        message: uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити файл'),
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Stack className="product-specification-codes-page" gap={6}>
      <Card className="app-data-card product-specification-codes-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-specification-codes-filter-bar">
          <div className="product-specification-codes-filter-row">
            <TextInput
              className="product-specification-codes-search"
              label={t('Код товару')}
              leftSection={<Search size={16} />}
              placeholder={t('Місце вводу для пошуку')}
              value={model.vendorCodeDraft}
              onChange={(event) => {
                model.setPage(1)
                model.setVendorCodeDraft(event.currentTarget.value)
              }}
            />
            <TextInput
              className="product-specification-codes-search"
              label={t('Митний код')}
              leftSection={<Search size={16} />}
              placeholder={t('Місце вводу для пошуку')}
              value={model.specificationCodeDraft}
              onChange={(event) => {
                model.setPage(1)
                model.setSpecificationCodeDraft(event.currentTarget.value)
              }}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={model.resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <FileButton accept=".xlsx,.xls,.csv" onChange={handleUpload}>
                {(props) => (
                  <Tooltip label={t('Завантажити Excel')}>
                    <ActionIcon
                      {...props}
                      aria-label={t('Завантажити Excel')}
                      loading={isUploading}
                      size={34}
                      variant="default"
                    >
                      <ExcelIcon size={22} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </FileButton>
              <Paginator
                hasNext={model.hasMore}
                isLoading={model.isLoading}
                page={model.page}
                pageSize={model.pageSize}
                pageSizeOptions={pageSizeOptions}
                onPageChange={model.setPage}
                onPageSizeChange={model.changePageSize}
                onRefresh={model.reload}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
          </div>
        </div>

        <div className="product-specification-codes-body">
          {model.error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {model.error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={model.specifications}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Митних кодів не знайдено')}
            getRowId={(specification, index) => String(specification.NetUid || specification.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="product-specification-codes-table-2"
            loadingText={t('Завантаження митних кодів')}
            minWidth={1180}
            showLayoutControls
            tableId="product-specification-codes"
            toolbarPortalTarget={tableToolbarSlot}
            distributeAvailableWidth
            onRowClick={(specification) => model.setSelected(specification)}
          />
        </div>
      </Card>

      <ChangeProductSpecificationPanel
        productSpecification={model.selected}
        onChanged={() => model.reload()}
        onClose={() => model.setSelected(null)}
      />

      <SpecificationUploadResultModal result={uploadResult} onClose={() => setUploadResult(null)} />
    </Stack>
  )
}

function SpecificationUploadResultModal({
  result,
  onClose,
}: {
  result: SpecificationCodeUploadResult | null
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(result)} title={t('Результат завантаження')} onClose={onClose}>
      {result && (
        <Stack gap="md">
          <div className="product-specification-codes-upload-stats">
            <UploadStat label={t('Розпізнано')} value={result.ParsedCount} />
            <UploadStat color="teal" label={t('Оновлено')} value={result.SuccessfullyUpdatedCount} />
            <UploadStat label={t('Не потребує оновлення')} value={result.UpdateWasNotRequiredCount} />
          </div>

          {result.InvalidVendorCodes.length > 0 && (
            <Stack gap="xs">
              <Text fw={600} size="sm">
                {t('Не оновлені коди виробника')}: {result.InvalidVendorCodes.length}
              </Text>
              <ScrollArea.Autosize mah={240} type="auto">
                <Stack gap={2}>
                  {result.InvalidVendorCodes.map((code, index) => (
                    <Text key={`${code}-${index}`} size="sm">
                      {code}
                    </Text>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            </Stack>
          )}

          <Group justify="flex-end">
            <Button onClick={onClose}>{t('Закрити')}</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  )
}

function UploadStat({ color, label, value }: { color?: string; label: string; value: number }) {
  return (
    <Card className="product-specification-codes-upload-stat" withBorder padding="sm" radius="md">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text c={color} fw={700} size="xl">
        {value}
      </Text>
    </Card>
  )
}

function useProductSpecificationColumns(
  specifications: ProductSpecification[],
): DataTableColumn<ProductSpecification>[] {
  return useMemo<DataTableColumn<ProductSpecification>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (specification) => String(specifications.indexOf(specification) + 1),
      },
      {
        id: 'vendorCode',
        header: 'Код Виробника',
        width: 200,
        minWidth: 150,
        accessor: (specification) => specification.Product?.VendorCode,
        cell: (specification) => (
          <span className="product-specification-code-cell">
            {displayValue(specification.Product?.VendorCode)}
          </span>
        ),
      },
      {
        id: 'specificationCode',
        header: 'Митний код',
        width: 200,
        minWidth: 150,
        accessor: (specification) => specification.SpecificationCode,
        cell: (specification) => (
          <span className="product-specification-code-cell">
            {displayValue(specification.SpecificationCode)}
          </span>
        ),
      },
      {
        id: 'specificationName',
        header: 'Назва товару',
        width: 320,
        minWidth: 220,
        accessor: (specification) => specification.Name,
        cell: (specification) => (
          <Text className="product-specification-name-cell" lineClamp={2}>
            {displayValue(specification.Name)}
          </Text>
        ),
      },
      {
        id: 'percent',
        header: 'Відсоток',
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (specification) => specification.DutyPercent,
        cell: (specification) => (
          <span className="product-specification-percent-cell">{formatPercent(specification.DutyPercent)}</span>
        ),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 200,
        minWidth: 160,
        accessor: getResponsibleName,
        cell: (specification) => (
          <span className="product-specification-responsible-cell">
            {displayValue(getResponsibleName(specification))}
          </span>
        ),
      },
      {
        id: 'capitalizedQty',
        header: 'Оприходована К-сть',
        width: 200,
        minWidth: 150,
        align: 'right',
        accessor: (specification) => getCapitalizedQty(specification),
        cell: (specification) => (
          <span className="product-specification-amount-cell">
            {formatAmount(getCapitalizedQty(specification))}
          </span>
        ),
      },
      {
        id: 'invoiceNumber',
        header: 'Номер інвойса',
        width: 250,
        minWidth: 180,
        accessor: (specification) => getInvoiceNumber(specification),
        cell: (specification) => (
          <span className="product-specification-plain-cell">
            {displayValue(getInvoiceNumber(specification))}
          </span>
        ),
      },
    ],
    [specifications],
  )
}

function getResponsibleName(specification: ProductSpecification): string {
  const addedBy = specification.AddedBy

  if (!addedBy) {
    return ''
  }

  return [addedBy.LastName, addedBy.FirstName].filter(Boolean).join(' ') || addedBy.Name || ''
}

function getCapitalizedQty(specification: ProductSpecification): number | undefined {
  return specification.OrderProductSpecification ? specification.OrderProductSpecification.Qty : undefined
}

function getInvoiceNumber(specification: ProductSpecification): string {
  const orderSpecification = specification.OrderProductSpecification

  if (!orderSpecification) {
    return ''
  }

  return orderSpecification.SupplyInvoice?.Number || orderSpecification.Sad?.Number || ''
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return percentFormatter.format(value)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function readProductSpecificationCodesPageSize(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_PRODUCT_SPECIFICATION_CODES_PAGE_SIZE
  }

  return normalizeProductSpecificationCodesPageSize(
    window.localStorage.getItem(PRODUCT_SPECIFICATION_CODES_PAGE_SIZE_STORAGE_KEY),
  )
}

function writeProductSpecificationCodesPageSize(pageSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PRODUCT_SPECIFICATION_CODES_PAGE_SIZE_STORAGE_KEY, String(pageSize))
}

function normalizeProductSpecificationCodesPageSize(value?: string | null): number {
  return pageSizeOptions.includes(value ?? '')
    ? Number(value)
    : DEFAULT_PRODUCT_SPECIFICATION_CODES_PAGE_SIZE
}
