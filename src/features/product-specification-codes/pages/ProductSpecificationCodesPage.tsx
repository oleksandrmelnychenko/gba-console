import {
  ActionIcon,
  Alert,
  Button,
  Card,
  FileButton,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconRefresh, IconRestore, IconSearch, IconUpload } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getProductSpecifications, uploadSpecificationCodesFile } from '../api/productSpecificationCodesApi'
import { ChangeProductSpecificationPanel } from '../components/ChangeProductSpecificationPanel'
import type { ProductSpecification, ProductSpecificationRegion, SpecificationCodeUploadResult } from '../types'

const BATCH_SIZE = 30
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
  const [region, setRegion] = useValueState<ProductSpecificationRegion>('uk')
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
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [selected, setSelected] = useValueState<ProductSpecification | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const listRequestKey = `${region}|${vendorCode}|${specificationCode}`
  const listRequestKeyRef = useRef(listRequestKey)

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    let cancelled = false

    async function loadSpecifications() {
      setLoading(true)
      setError(null)

      try {
        const nextSpecifications = await getProductSpecifications({
          limit: BATCH_SIZE,
          locale: region,
          offset: 0,
          specificationCode,
          vendorCode,
        })

        if (!cancelled) {
          setSpecifications(nextSpecifications)
          setHasMore(nextSpecifications.length === BATCH_SIZE)
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
  }, [region, reloadKey, specificationCode, vendorCode, setError, setHasMore, setLoading, setSpecifications, t])

  async function loadMore() {
    if (isLoadingMore || isLoading) {
      return
    }

    const requestKey = listRequestKeyRef.current
    const requestOffset = specifications.length
    setLoadingMore(true)
    setError(null)

    try {
      const nextSpecifications = await getProductSpecifications({
        limit: BATCH_SIZE,
        locale: region,
        offset: requestOffset,
        specificationCode,
        vendorCode,
      })

      if (listRequestKeyRef.current === requestKey) {
        setSpecifications((current) =>
          current.length === requestOffset ? [...current, ...nextSpecifications] : current,
        )
        setHasMore(nextSpecifications.length === BATCH_SIZE)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні митні коди'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  function resetFilters() {
    setVendorCodeDraft('')
    setSpecificationCodeDraft('')
  }

  return {
    error,
    hasMore,
    isLoading,
    isLoadingMore,
    region,
    selected,
    specificationCodeDraft,
    specifications,
    vendorCodeDraft,
    loadMore,
    reload,
    resetFilters,
    setRegion,
    setSelected,
    setSpecificationCodeDraft,
    setVendorCodeDraft,
  }
}

export function ProductSpecificationCodesPage() {
  const { t } = useI18n()
  const model = useProductSpecificationCodesModel()
  const columns = useProductSpecificationColumns(model.specifications)
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
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <SegmentedControl
          data={[
            { label: t('Україна'), value: 'uk' },
            { label: t('Польща'), value: 'pl' },
          ]}
          value={model.region}
          onChange={(value) => model.setRegion(value as ProductSpecificationRegion)}
        />
        <Group gap="sm">
          <FileButton accept=".xlsx,.xls,.csv" onChange={handleUpload}>
            {(props) => (
              <Button {...props} leftSection={<IconUpload size={16} />} loading={isUploading} variant="light">
                {t('Завантажити Excel')}
              </Button>
            )}
          </FileButton>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={model.isLoading}
              size={38}
              variant="light"
              onClick={() => model.reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              label={t('Код товару')}
              leftSection={<IconSearch size={16} />}
              placeholder={t('Місце вводу для пошуку')}
              style={{ flex: '1 1 240px' }}
              value={model.vendorCodeDraft}
              onChange={(event) => model.setVendorCodeDraft(event.currentTarget.value)}
            />
            <TextInput
              label={t('Митний код')}
              leftSection={<IconSearch size={16} />}
              placeholder={t('Місце вводу для пошуку')}
              style={{ flex: '1 1 240px' }}
              value={model.specificationCodeDraft}
              onChange={(event) => model.setSpecificationCodeDraft(event.currentTarget.value)}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={model.resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {model.error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {model.error}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Завантажено')} {model.specifications.length}
            </Text>
            <Button
              color="gray"
              disabled={!model.hasMore || model.isLoading || model.isLoadingMore}
              loading={model.isLoadingMore}
              variant="light"
              onClick={model.loadMore}
            >
              {t('Завантажити ще')}
            </Button>
          </Group>

          <DataTable
            columns={columns}
            data={model.specifications}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Митних кодів не знайдено')}
            getRowId={(specification, index) => String(specification.NetUid || specification.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="product-specification-codes-table-1"
            loadingText={t('Завантаження митних кодів')}
            maxHeight="calc(100vh - 320px)"
            minWidth={1320}
            tableId="product-specification-codes"
            onRowClick={(specification) => model.setSelected(specification)}
          />
        </Stack>
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
          <Group grow>
            <UploadStat label={t('Розпізнано')} value={result.ParsedCount} />
            <UploadStat color="teal" label={t('Оновлено')} value={result.SuccessfullyUpdatedCount} />
            <UploadStat label={t('Не потребує оновлення')} value={result.UpdateWasNotRequiredCount} />
          </Group>

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
    <Card withBorder padding="sm" radius="md">
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
        cell: (specification) => <Text fw={700}>{displayValue(specification.Product?.VendorCode)}</Text>,
      },
      {
        id: 'specificationCode',
        header: 'Митний код',
        width: 200,
        minWidth: 150,
        accessor: (specification) => specification.SpecificationCode,
        cell: (specification) => <Text fw={600}>{displayValue(specification.SpecificationCode)}</Text>,
      },
      {
        id: 'specificationName',
        header: 'Назва товару',
        width: 320,
        minWidth: 220,
        accessor: (specification) => specification.Name,
        cell: (specification) => (
          <Text lineClamp={2}>{displayValue(specification.Name)}</Text>
        ),
      },
      {
        id: 'percent',
        header: 'Відсоток',
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (specification) => specification.DutyPercent,
        cell: (specification) => formatPercent(specification.DutyPercent),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 200,
        minWidth: 160,
        accessor: getResponsibleName,
        cell: (specification) => displayValue(getResponsibleName(specification)),
      },
      {
        id: 'capitalizedQty',
        header: 'Оприходована К-сть',
        width: 200,
        minWidth: 150,
        align: 'right',
        accessor: (specification) => getCapitalizedQty(specification),
        cell: (specification) => formatAmount(getCapitalizedQty(specification)),
      },
      {
        id: 'invoiceNumber',
        header: 'Номер інвойса',
        width: 250,
        minWidth: 180,
        accessor: (specification) => getInvoiceNumber(specification),
        cell: (specification) => displayValue(getInvoiceNumber(specification)),
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
