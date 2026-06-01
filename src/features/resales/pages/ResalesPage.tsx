import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileTypePdf,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  addResale,
  addResaleConsignmentNoteSetting,
  changeResaleToInvoice,
  completeResale,
  exportResaleAvailabilities,
  exportResaleDocument,
  generateAutomaticallyResale,
  getResaleAvailabilities,
  getResaleAvailabilityFilterOptions,
  getResaleConsignmentNoteSettings,
  getResaleByNetId,
  getResales,
  printResaleConsignmentNoteDocument,
  removeResaleConsignmentNoteSetting,
  removeResale,
  searchResaleClients,
  updateResale,
  updateResaleConsignmentNoteSetting,
  updateResaleAvailabilityList,
} from '../api/resalesApi'
import type {
  CreatedResaleAvailabilityWithTotals,
  GenerateAutomaticallyResalePayload,
  GroupingResaleAvailability,
  ReSale,
  ResaleActionResult,
  ResaleAgreement,
  ResaleAvailabilityFilterOptions,
  ResaleAvailabilityFilterPayload,
  ResaleAvailabilityItemModel,
  ResaleBackendWarning,
  ResaleClient,
  ResaleClientAgreement,
  ResaleConsignmentNoteSetting,
  ResaleCreatePayload,
  ResaleDownloadDocumentType,
  ResaleExportDocument,
  ResaleProductGroup,
  ResaleStorage,
  UpdatedResaleItemModel,
  UpdatedResaleModel,
} from '../types'
import { ResaleDownloadDocumentType as DocumentType } from '../types'

const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']

const RESALES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'created', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const AVAILABILITIES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['select', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PROCESS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const DETAIL_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type ResalesListState = {
  isLoading: boolean
  items: ReSale[]
  total?: number
}

type ResaleAvailabilityForm = {
  amount: number
  extraChargePercent: number
  from: string
  infelicity: number
  productGroupIds: string[]
  search: string
  specificationCodes: string[]
  storageIds: string[]
  to: string
}

type ProcessState = {
  data: CreatedResaleAvailabilityWithTotals | null
  fromStorageId?: number
  id: number
  opened: boolean
}

type DetailInfo = {
  client: ResaleClient | null
  clientAgreement: ResaleClientAgreement | null
  comment: string
}

type ProcessDrawerState = {
  activeProcessData: CreatedResaleAvailabilityWithTotals | null
  client: ResaleClient | null
  clientAgreement: ResaleClientAgreement | null
  comment: string
  rows: ResaleAvailabilityItemModel[]
  warning: ResaleBackendWarning | null
}

type ConsignmentNoteDrawerState = {
  error: string | null
  isEdited: boolean
  savedSetting: ResaleConsignmentNoteSetting
  selectedSettingKey: string | null
  setting: ResaleConsignmentNoteSetting
}

type NewResaleRouteState = {
  returnPath?: string
}

export function ResalesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [fromDate, setFromDate] = useValueState(() => shiftDateInput(-3))
  const [toDate, setToDate] = useValueState(() => shiftDateInput(1))
  const [status, setStatus] = useValueState('0')
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [listState, setListState] = useValueState<ResalesListState>({
    isLoading: false,
    items: [],
    total: undefined,
  })
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ResaleExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [exportingKey, setExportingKey] = useValueState<string | null>(null)
  const [removingNetId, setRemovingNetId] = useValueState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useValueState<ReSale | null>(null)
  const [consignmentNoteSale, setConsignmentNoteSale] = useValueState<ReSale | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { isLoading, items, total } = listState
  const offset = (page - 1) * pageSize
  const canMoveBackward = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : items.length === pageSize
  const columns = useResalesColumns({
    exportingKey,
    removingNetId,
    onDelete: setDeleteCandidate,
    onExport: handleExport,
    onOpenConsignmentNote: setConsignmentNoteSale,
  })
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {items.length}
        {typeof total === 'number' ? ` ${t('з')} ${total}` : ''}
      </Text>
    ),
    [items.length, t, total],
  )
  const filterError = getDateRangeError(fromDate, toDate)

  useEffect(() => {
    if (filterError) {
      setListState({
        isLoading: false,
        items: [],
        total: undefined,
      })
      return
    }

    let cancelled = false

    async function loadResales() {
      setListState((currentState) => ({
        ...currentState,
        isLoading: true,
      }))
      setError(null)

      try {
        const nextItems = await getResales({
          from: toStartOfDayIso(fromDate),
          isFiltered: page === 1,
          limit: pageSize,
          offset,
          status: Number(status),
          to: toEndOfDayIso(toDate),
        })

        if (!cancelled) {
          setListState({
            isLoading: false,
            items: nextItems,
            total: readTotal(nextItems),
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setListState({
            isLoading: false,
            items: [],
            total: undefined,
          })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перепродажі'))
        }
      }
    }

    void loadResales()

    return () => {
      cancelled = true
    }
  }, [filterError, fromDate, offset, page, pageSize, reloadKey, setError, setListState, status, t, toDate])

  async function handleExport(resale: ReSale, type: ResaleDownloadDocumentType) {
    if (!resale.NetUid) {
      return
    }

    const key = `${resale.NetUid}:${type}`
    setExportingKey(key)
    setError(null)

    try {
      const document = await exportResaleDocument({
        netId: resale.NetUid,
        type,
      })

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExportingKey(null)
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate?.NetUid) {
      return
    }

    setRemovingNetId(deleteCandidate.NetUid)
    setError(null)

    try {
      await removeResale(deleteCandidate.NetUid)
      setDeleteCandidate(null)
      reload()
      notifications.show({
        color: 'green',
        message: t('Перепродаж видалено'),
      })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити перепродаж'))
    } finally {
      setRemovingNetId(null)
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          <Button
            color="violet"
            onClick={() =>
              navigate('/resales/new', {
                state: {
                  backgroundLocation: location,
                  returnPath: `${location.pathname}${location.search}`,
                },
              })
            }
          >
            {t('Створити')}
          </Button>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => reload()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              label={t('Від')}
              type="date"
              value={fromDate}
              w={150}
              onChange={(event) => {
                setPage(1)
                setFromDate(event.currentTarget.value)
              }}
            />
            <TextInput
              label={t('До')}
              type="date"
              value={toDate}
              w={150}
              onChange={(event) => {
                setPage(1)
                setToDate(event.currentTarget.value)
              }}
            />
            <Select
              allowDeselect={false}
              data={[
                { label: t('Усі'), value: '0' },
                { label: t('Рахунок'), value: '1' },
                { label: t('Інвойс'), value: '2' },
              ]}
              label={t('Статус')}
              value={status}
              w={160}
              onChange={(value) => {
                setPage(1)
                setStatus(value || '0')
              }}
            />
          </Group>

          {(error || filterError) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Сторінка')} {page}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={84}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value || PAGE_SIZE))
                }}
              />
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={!canMoveBackward || isLoading}
                size={36}
                variant="light"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text size="sm" w={34} ta="center">
                {page}
              </Text>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={!canMoveForward || isLoading}
                size={36}
                variant="light"
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={items}
            defaultLayout={RESALES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Перепродажів не знайдено')}
            getRowId={(resale, index) => String(resale.NetUid || resale.Id || index)}
            isLoading={isLoading}
            layoutVersion="resales-table-1"
            loadingText={t('Завантаження перепродажів')}
            maxHeight="calc(100vh - 330px)"
            minWidth={1320}
            tableId="resales"
            toolbarLeft={toolbarLeft}
            onRowClick={(resale) => {
              if (resale.NetUid) {
                navigate(`/resales/${resale.NetUid}`)
              }
            }}
          />
        </Stack>
      </Card>

      <AppModal
        centered
        opened={Boolean(deleteCandidate)}
        title={t('Видалити перепродаж')}
        onClose={() => setDeleteCandidate(null)}
      >
        <Stack gap="md">
          <Text size="sm">{t('Документ буде видалено. Продовжити?')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={Boolean(removingNetId)} variant="light" onClick={() => setDeleteCandidate(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" loading={Boolean(removingNetId)} onClick={confirmDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('Документ перепродажу')}
        onClose={() => setDownloadModalOpened(false)}
      />

      <ConsignmentNoteSettingsDrawer
        opened={Boolean(consignmentNoteSale)}
        resale={consignmentNoteSale}
        onClose={() => setConsignmentNoteSale(null)}
      />
    </Stack>
  )
}

export function NewResalePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as NewResaleRouteState | null
  const returnPath = routeState?.returnPath || '/resales'
  const [filterOptions, setFilterOptions] = useValueState<ResaleAvailabilityFilterOptions | null>(null)
  const [form, setForm] = useValueState<ResaleAvailabilityForm>(() => ({
    amount: 0,
    extraChargePercent: 0,
    from: shiftDateInput(-365),
    infelicity: 0,
    productGroupIds: [],
    search: '',
    specificationCodes: [],
    storageIds: [],
    to: getDateInputValue(new Date()),
  }))
  const [availabilities, setAvailabilities] = useValueState<GroupingResaleAvailability[]>([])
  const [totals, setTotals] = useValueState<ResaleAvailabilityWithTotalsTotals>(getEmptyAvailabilityTotals)
  const [selectedKeys, setSelectedKeys] = useValueState<string[]>([])
  const [generateStorageNetId, setGenerateStorageNetId] = useValueState<string | null>(null)
  const [isLoadingOptions, setLoadingOptions] = useValueState(true)
  const [isLoadingAvailabilities, setLoadingAvailabilities] = useValueState(false)
  const [isProcessing, setProcessing] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [warning, setWarning] = useValueState<ResaleBackendWarning | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ResaleExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [processState, setProcessState] = useValueState<ProcessState>({
    data: null,
    fromStorageId: undefined,
    id: 0,
    opened: false,
  })
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const productGroupOptions = useMemo(() => buildProductGroupOptions(filterOptions?.ProductGroups || []), [filterOptions?.ProductGroups])
  const storageOptions = useMemo(() => buildStorageOptions(filterOptions?.Storages || []), [filterOptions?.Storages])
  const specificationOptions = useMemo(() => buildSpecificationOptions(filterOptions?.SpecificationCodes || [], t), [filterOptions?.SpecificationCodes, t])
  const generateStorageOptions = useMemo(() => buildGenerateStorageOptions(filterOptions?.Storages || []), [filterOptions?.Storages])
  const payload = useMemo(
    () => buildAvailabilityPayload(form),
    [form],
  )
  const selectedRows = useMemo(
    () => availabilities.filter((availability) => selectedKeys.includes(getAvailabilityKey(availability))),
    [availabilities, selectedKeys],
  )
  const canProcessSelected = selectedRows.length > 0 && hasSingleStorage(selectedRows)
  const columns = useResaleAvailabilityColumns({
    selectedKeys,
    onToggle: toggleAvailability,
  })
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {availabilities.length}
        {selectedKeys.length ? `, ${t('обрано')}: ${selectedKeys.length}` : ''}
      </Text>
    ),
    [availabilities.length, selectedKeys.length, t],
  )
  const loadAvailabilities = useCallback(
    async (nextPayload: ResaleAvailabilityFilterPayload) => {
      setLoadingAvailabilities(true)
      setError(null)
      setWarning(null)

      try {
        const response = await getResaleAvailabilities(nextPayload)

        setAvailabilities(response.GroupReSaleAvailabilities)
        setTotals({
          totalQty: response.TotalQty || 0,
          totalValueWithVat: response.TotalValueWithVat || 0,
          totalWithExtraValue: response.TotalWithExtraValue || 0,
        })
        setSelectedKeys([])
      } catch (loadError) {
        setAvailabilities([])
        setTotals(getEmptyAvailabilityTotals())
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити доступні товари'))
      } finally {
        setLoadingAvailabilities(false)
      }
    },
    [
      setAvailabilities,
      setError,
      setLoadingAvailabilities,
      setSelectedKeys,
      setTotals,
      setWarning,
      t,
    ],
  )

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      setLoadingOptions(true)
      setError(null)

      try {
        const nextOptions = await getResaleAvailabilityFilterOptions()

        if (!cancelled) {
          setFilterOptions(nextOptions)
          setForm((currentForm) => ({
            ...currentForm,
            productGroupIds: currentForm.productGroupIds.length ? currentForm.productGroupIds : collectProductGroupIds(nextOptions.ProductGroups),
            specificationCodes: currentForm.specificationCodes.length
              ? currentForm.specificationCodes
              : buildSpecificationSelection(nextOptions.SpecificationCodes),
            storageIds: currentForm.storageIds.length ? currentForm.storageIds : collectStorageIds(nextOptions.Storages),
          }))
          setGenerateStorageNetId((currentNetId) => {
            if (currentNetId && nextOptions.Storages.some((storage) => storage.NetUid === currentNetId)) {
              return currentNetId
            }

            return nextOptions.Storages.find((storage) => storage.NetUid)?.NetUid || null
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити фільтри перепродажу'))
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false)
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setFilterOptions, setForm, setGenerateStorageNetId, setLoadingOptions, t])

  useEffect(() => {
    if (!filterOptions) {
      return
    }

    void loadAvailabilities(payload)
  }, [filterOptions, loadAvailabilities, payload])

  async function exportAvailabilities() {
    setExporting(true)
    setError(null)

    try {
      const document = await exportResaleAvailabilities(payload)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  async function processSelected() {
    if (!canProcessSelected) {
      setWarning({
        Message: t('Для обробки оберіть товари з одного складу'),
      })
      return
    }

    setProcessing(true)
    setError(null)
    setWarning(null)

    try {
      const result = await updateResaleAvailabilityList(selectedRows.map(mapAvailabilityToItemModel))

      handleProcessResult(result, readAvailabilityStorageId(selectedRows[0]))
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : t('Не вдалося підготувати перепродаж'))
    } finally {
      setProcessing(false)
    }
  }

  async function generateAutomatically() {
    if (!generateStorageNetId) {
      setWarning({
        Message: t('Оберіть склад для автоматичного створення'),
      })
      return
    }

    setProcessing(true)
    setError(null)
    setWarning(null)

    try {
      const result = await generateAutomaticallyResale({
        ...payload,
        SelectedStorageNetId: generateStorageNetId,
      } satisfies GenerateAutomaticallyResalePayload)
      const storage = filterOptions?.Storages.find((item) => item.NetUid === generateStorageNetId)

      handleProcessResult(result, storage?.Id)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : t('Не вдалося автоматично створити підбір'))
    } finally {
      setProcessing(false)
    }
  }

  function handleProcessResult(
    result: ResaleActionResult<CreatedResaleAvailabilityWithTotals>,
    fromStorageId?: number,
  ) {
    if (result.warning) {
      setWarning(result.warning)
      return
    }

    const processData = result.data

    if (processData) {
      setProcessState((currentState) => ({
        data: processData,
        fromStorageId,
        id: currentState.id + 1,
        opened: true,
      }))
    }
  }

  function toggleAvailability(row: GroupingResaleAvailability) {
    const key = getAvailabilityKey(row)

    setSelectedKeys((currentKeys) => {
      if (currentKeys.includes(key)) {
        return currentKeys.filter((item) => item !== key)
      }

      return [...currentKeys, key]
    })
  }

  function resetFilters() {
    if (!filterOptions) {
      return
    }

    setForm({
      amount: 0,
      extraChargePercent: 0,
      from: shiftDateInput(-365),
      infelicity: 0,
      productGroupIds: collectProductGroupIds(filterOptions.ProductGroups),
      search: '',
      specificationCodes: buildSpecificationSelection(filterOptions.SpecificationCodes),
      storageIds: collectStorageIds(filterOptions.Storages),
      to: getDateInputValue(new Date()),
    })
  }

  async function handleCreated(payload: ResaleCreatePayload) {
    setProcessing(true)
    setError(null)
    setWarning(null)

    try {
      const result = await addResale(payload)

      if (result.warning) {
        setWarning(result.warning)
        return
      }

      notifications.show({
        color: 'green',
        message: t('Перепродаж створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити перепродаж'))
    } finally {
      setProcessing(false)
    }
  }

  function closeSheet() {
    if (isProcessing) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="min(1440px, 100vw)"
      title={t('Новий перепродаж')}
      onClose={closeSheet}
    >
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          <Button color="gray" variant="light" onClick={closeSheet}>
            {t('До списку')}
          </Button>
          <Tooltip label={t('Оновити фільтри')}>
            <ActionIcon
              aria-label={t('Оновити фільтри')}
              color="gray"
              loading={isLoadingOptions}
              size={38}
              variant="light"
              onClick={() => reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <NumberInput
                label={t('Сума для рахунку')}
                value={form.amount}
                onChange={(value) => setForm((currentForm) => ({ ...currentForm, amount: toNumber(value) }))}
              />
              <NumberInput
                label={`${t('Похибка')} +/-`}
                value={form.infelicity}
                onChange={(value) => setForm((currentForm) => ({ ...currentForm, infelicity: toNumber(value) }))}
              />
              <NumberInput
                label={t('Націнка, %')}
                value={form.extraChargePercent}
                onChange={(value) => setForm((currentForm) => ({ ...currentForm, extraChargePercent: toNumber(value) }))}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <MultiSelect
                searchable
                data={productGroupOptions}
                disabled={isLoadingOptions}
                label={t('Групи товарів')}
                value={form.productGroupIds}
                onChange={(value) => setForm((currentForm) => ({ ...currentForm, productGroupIds: value }))}
              />
              <MultiSelect
                searchable
                data={storageOptions}
                disabled={isLoadingOptions}
                label={t('Склади')}
                value={form.storageIds}
                onChange={(value) => setForm((currentForm) => ({ ...currentForm, storageIds: value }))}
              />
              <MultiSelect
                searchable
                data={specificationOptions}
                disabled={isLoadingOptions}
                label={t('Коди специфікацій')}
                value={form.specificationCodes}
                onChange={(value) => setForm((currentForm) => ({ ...currentForm, specificationCodes: value }))}
              />
            </SimpleGrid>
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <TextInput
                leftSection={<IconSearch size={16} />}
                label={t('Пошук товару')}
                value={form.search}
                style={{ flex: '1 1 260px' }}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, search: event.currentTarget.value }))}
              />
              <TextInput
                label={t('Від')}
                type="date"
                value={form.from}
                w={150}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, from: event.currentTarget.value }))}
              />
              <TextInput
                label={t('До')}
                type="date"
                value={form.to}
                w={150}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, to: event.currentTarget.value }))}
              />
              <Button color="gray" variant="light" onClick={resetFilters}>
                {t('Скинути')}
              </Button>
            </Group>
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <Select
                searchable
                data={generateStorageOptions}
                disabled={isLoadingOptions}
                label={t('Склад для автоматичного створення')}
                value={generateStorageNetId}
                style={{ flex: '1 1 260px' }}
                onChange={setGenerateStorageNetId}
              />
              <Button loading={isProcessing} variant="light" onClick={generateAutomatically}>
                {t('Створити автоматично')}
              </Button>
              <Button disabled={!selectedRows.length} loading={isProcessing} onClick={processSelected}>
                {t('Обробити')} {selectedRows.length ? selectedRows.length : ''}
              </Button>
              <Button leftSection={<IconDownload size={16} />} loading={isExporting} variant="light" onClick={exportAvailabilities}>
                {t('Друк')}
              </Button>
            </Group>
        </Stack>
      </Card>

      {(error || warning) && (
        <Alert color={warning ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
          <Stack gap={4}>
            <Text size="sm">{warning?.Message || error}</Text>
            {warning?.Products?.map((product) => (
              <Text key={`${product.ProductId}-${product.VendorCode}`} size="xs">
                {displayValue(product.VendorCode)} - {formatAmount(product.Qty)}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <TotalsCard
        items={[
          { label: t('Кількість'), value: formatAmount(totals.totalQty) },
          { label: t('З ПДВ'), value: formatMoney(totals.totalValueWithVat) },
          { label: t('З націнкою'), value: formatMoney(totals.totalWithExtraValue) },
        ]}
      />

      <Card withBorder radius="md" padding="md">
        <DataTable
          columns={columns}
          data={availabilities}
          defaultLayout={AVAILABILITIES_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Доступних товарів не знайдено')}
          getRowId={(row, index) => getAvailabilityKey(row) || String(index)}
          isLoading={isLoadingAvailabilities || isLoadingOptions}
          layoutVersion="resale-availabilities-table-1"
          loadingText={t('Завантаження доступних товарів')}
          maxHeight="calc(100vh - 410px)"
          minWidth={1440}
          tableId="resale-availabilities"
          toolbarLeft={toolbarLeft}
          onRowClick={toggleAvailability}
        />
      </Card>

      <ResaleProcessDrawer
        key={processState.id}
        fromStorageId={processState.fromStorageId}
        isSaving={isProcessing}
        opened={processState.opened}
        processData={processState.data}
        onClose={() => setProcessState((currentState) => ({
          ...currentState,
          data: null,
          fromStorageId: undefined,
          opened: false,
        }))}
        onCreate={handleCreated}
        onRecalculate={updateResaleAvailabilityList}
      />

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('Документ підбору')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
    </AppDrawer>
  )
}

export function ResalePage() {
  const { t } = useI18n()
  const { id } = useParams()
  const [model, setModel] = useValueState<UpdatedResaleModel | null>(null)
  const [detailInfo, setDetailInfo] = useValueState<DetailInfo>({
    client: null,
    clientAgreement: null,
    comment: '',
  })
  const [rows, setRows] = useValueState<UpdatedResaleItemModel[]>([])
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [warning, setWarning] = useValueState<ResaleBackendWarning | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ResaleExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [consignmentNoteOpened, setConsignmentNoteOpened] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const changedToInvoice = Boolean(model?.ReSale?.ChangedToInvoice)
  const isCompleted = Boolean(model?.ReSale?.IsCompleted)
  const columns = useResaleDetailColumns({
    isCompleted,
    changedToInvoice,
    onChangeAmount: updateRowAmount,
    onChangeQty: updateRowQty,
    onChangeSalePrice: updateRowSalePrice,
  })
  const applyDetailResult = useCallback(
    (result: ResaleActionResult<UpdatedResaleModel>) => {
      if (result.warning) {
        setWarning(result.warning)
        return
      }

      if (result.data) {
        setModel(result.data)
        setRows(result.data.ReSaleItemModels || [])
        setDetailInfo({
          client: result.data.ReSale.ClientAgreement?.Client || null,
          clientAgreement: result.data.ReSale.ClientAgreement || null,
          comment: result.data.ReSale.Comment || '',
        })
      }
    },
    [setDetailInfo, setModel, setRows, setWarning],
  )

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError(t('Не вказано ідентифікатор перепродажу'))
      return
    }

    const resaleId = id
    let cancelled = false

    async function loadResale() {
      setLoading(true)
      setError(null)
      setWarning(null)

      try {
        const result = await getResaleByNetId(resaleId)

        if (!cancelled) {
          applyDetailResult(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перепродаж'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadResale()

    return () => {
      cancelled = true
    }
  }, [applyDetailResult, id, reloadKey, setError, setLoading, setWarning, t])

  const totals = useMemo(() => getDetailTotals(model, rows), [model, rows])

  function buildUpdatedModel(): UpdatedResaleModel | null {
    if (!model) {
      return null
    }

    return {
      ...model,
      ReSale: {
        ...model.ReSale,
        ClientAgreement: detailInfo.clientAgreement,
        Comment: detailInfo.comment,
      },
      ReSaleItemModels: rows,
    }
  }

  async function recalculate() {
    if (!id) {
      return
    }

    const nextModel = buildUpdatedModel()

    if (!nextModel) {
      return
    }

    setSaving(true)
    setError(null)
    setWarning(null)

    try {
      applyDetailResult(await getResaleByNetId(id, nextModel))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося перерахувати позиції'))
    } finally {
      setSaving(false)
    }
  }

  async function saveResale() {
    const nextModel = buildUpdatedModel()

    if (!nextModel) {
      return
    }

    setSaving(true)
    setError(null)
    setWarning(null)

    try {
      applyDetailResult(await updateResale(nextModel))
      notifications.show({
        color: 'green',
        message: t('Перепродаж збережено'),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти перепродаж'))
    } finally {
      setSaving(false)
    }
  }

  async function changeToInvoice() {
    if (!model?.ReSale.NetUid) {
      return
    }

    const nextModel = buildUpdatedModel()

    if (!nextModel) {
      return
    }

    setSaving(true)
    setError(null)
    setWarning(null)

    try {
      const savedResult = await updateResale(nextModel)

      if (savedResult.warning) {
        setWarning(savedResult.warning)
        return
      }

      const invoiceModel = await changeResaleToInvoice(model.ReSale.NetUid)

      if (invoiceModel) {
        setModel(invoiceModel)
        setRows(invoiceModel.ReSaleItemModels || [])
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося перевести у інвойс'))
    } finally {
      setSaving(false)
    }
  }

  async function completeInvoice() {
    if (!model?.ReSale.NetUid) {
      return
    }

    const nextModel = buildUpdatedModel()

    if (!nextModel) {
      return
    }

    setSaving(true)
    setError(null)
    setWarning(null)

    try {
      const savedResult = await updateResale(nextModel)

      if (savedResult.warning) {
        setWarning(savedResult.warning)
        return
      }

      const completedModel = await completeResale(model.ReSale.NetUid)

      if (completedModel) {
        setModel(completedModel)
        setRows(completedModel.ReSaleItemModels || [])
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося завершити інвойс'))
    } finally {
      setSaving(false)
    }
  }

  async function exportDocument(type: ResaleDownloadDocumentType) {
    if (!model?.ReSale.NetUid) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportResaleDocument({
        netId: model.ReSale.NetUid,
        type,
      })

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  function updateRowQty(index: number, value: number | string) {
    updateRow(index, { QtyToReSale: toNumber(value) })
  }

  function updateRowSalePrice(index: number, value: number | string) {
    updateRow(index, { SalePrice: toNumber(value) })
  }

  function updateRowAmount(index: number, value: number | string) {
    updateRow(index, { Amount: toNumber(value) })
  }

  function updateRow(index: number, patch: Partial<UpdatedResaleItemModel>) {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch,
              OldValue: {
                Amount: patch.Amount ?? row.Amount,
                QtyToReSale: patch.QtyToReSale ?? row.QtyToReSale,
                SalePrice: patch.SalePrice ?? row.SalePrice,
              },
            }
          : row,
      ),
    )
  }

  if (isLoading) {
    return (
      <Card withBorder radius="md" padding="xl">
        <Group justify="center">
          <Text c="dimmed">{t('Завантаження')}</Text>
        </Group>
      </Card>
    )
  }

  if (!model) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
        {error || t('Перепродаж не знайдено')}
      </Alert>
    )
  }

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          <Button component={Link} to="/resales" color="gray" variant="light">
            {t('До списку')}
          </Button>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" size={38} variant="light" onClick={() => reload()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {(error || warning) && (
        <Alert color={warning ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
          <Stack gap={4}>
            <Text size="sm">{warning?.Message || error}</Text>
            {warning?.Products?.map((product) => (
              <Text key={`${product.ProductId}-${product.VendorCode}`} size="xs">
                {displayValue(product.VendorCode)} - {formatAmount(product.Qty)}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <DetailValue label={t('Статус')} value={changedToInvoice ? t('Інвойс') : t('Рахунок')} />
            <DetailValue label={t('Відповідальний')} value={model.ReSale.ChangedToInvoiceBy?.LastName || model.ReSale.User?.LastName} />
            <DetailValue label={t('Організація')} value={model.ReSale.Organization?.Name || model.ReSale.Organization?.FullName} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <ResaleClientSelect
              disabled={changedToInvoice}
              label={t('Клієнт')}
              selectedClient={detailInfo.client}
              onSelectClient={(client) => setDetailInfo((current) => ({ ...current, client, clientAgreement: null }))}
            />
            <Select
              searchable
              disabled={changedToInvoice || !detailInfo.client}
              data={buildClientAgreementOptions(detailInfo.client, model.ReSale.Organization || undefined)}
              label={t('Угода')}
              value={detailInfo.clientAgreement?.NetUid || detailInfo.clientAgreement?.Id ? String(detailInfo.clientAgreement.NetUid || detailInfo.clientAgreement.Id) : null}
              onChange={(value) => {
                const agreement = findClientAgreement(detailInfo.client, value)
                setDetailInfo((current) => ({ ...current, clientAgreement: agreement }))
              }}
            />
          </SimpleGrid>
          <Textarea
            label={t('Коментар')}
            minRows={2}
            value={detailInfo.comment}
            onChange={(event) => setDetailInfo((current) => ({ ...current, comment: event.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button leftSection={<IconDownload size={16} />} loading={isExporting} variant="light" onClick={() => exportDocument(DocumentType.PaymentDocument)}>
              {t('Платіжний документ')}
            </Button>
            {changedToInvoice && (
              <Button leftSection={<IconDownload size={16} />} loading={isExporting} variant="light" onClick={() => exportDocument(DocumentType.SalesInvoice)}>
                {t('Інвойс')}
              </Button>
            )}
            {changedToInvoice && (
              <Button leftSection={<IconTruckDelivery size={16} />} variant="light" onClick={() => setConsignmentNoteOpened(true)}>
                {t('ТТН')}
              </Button>
            )}
            <Button loading={isSaving} variant="light" onClick={recalculate}>
              {t('Перерахувати')}
            </Button>
            <Button loading={isSaving} onClick={saveResale}>
              {t('Зберегти')}
            </Button>
            {!changedToInvoice && detailInfo.clientAgreement && (
              <Button loading={isSaving} color="green" onClick={changeToInvoice}>
                {t('Зробити інвойсом')}
              </Button>
            )}
            {changedToInvoice && !model.ReSale.IsCompleted && (
              <Button loading={isSaving} color="green" onClick={completeInvoice}>
                {t('Завершити')}
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      <TotalsCard
        items={[
          { label: t('Кількість'), value: formatAmount(totals.qty) },
          { label: t('Сума'), value: formatMoney(totals.amount) },
          { label: t('ПДВ'), value: formatMoney(totals.vat) },
          { label: t('Вага'), value: formatAmount(totals.weight) },
          { label: t('Оплачено'), value: formatMoney(model.ReSale.TotalPaymentAmount) },
          { label: t('Різниця'), value: formatMoney(model.ReSale.DifferencePaymentAndInvoiceAmount) },
        ]}
      />

      <Card withBorder radius="md" padding="md">
        <DataTable
          columns={columns}
          data={rows.map((row, index) => ({ ...row, __rowIndex: index } as UpdatedResaleItemModel & { __rowIndex: number }))}
          defaultLayout={DETAIL_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Позицій не знайдено')}
          getRowId={(row, index) => String(row.ConsignmentItem?.NetUid || row.ConsignmentItem?.Id || index)}
          layoutVersion="resale-detail-items-table-1"
          maxHeight="calc(100vh - 520px)"
          minWidth={1360}
          tableId="resale-detail-items"
        />
      </Card>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('Документ перепродажу')}
        onClose={() => setDownloadModalOpened(false)}
      />

      <ConsignmentNoteSettingsDrawer
        opened={consignmentNoteOpened}
        resale={model.ReSale}
        onClose={() => setConsignmentNoteOpened(false)}
      />
    </Stack>
  )
}

function useResalesColumns({
  exportingKey,
  removingNetId,
  onDelete,
  onExport,
  onOpenConsignmentNote,
}: {
  exportingKey: string | null
  removingNetId: string | null
  onDelete: (resale: ReSale) => void
  onExport: (resale: ReSale, type: ResaleDownloadDocumentType) => void
  onOpenConsignmentNote: (resale: ReSale) => void
}): DataTableColumn<ReSale>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ReSale>[]>(
    () => [
      {
        id: 'status',
        header: t('Статус'),
        width: 126,
        minWidth: 108,
        accessor: (resale) => getResaleStatusLabel(resale),
        cell: (resale) => (
          <Badge color={resale.ChangedToInvoice ? 'green' : 'blue'} variant="light">
            {getResaleStatusLabel(resale)}
          </Badge>
        ),
      },
      {
        id: 'created',
        header: t('Створено'),
        width: 150,
        minWidth: 132,
        accessor: (resale) => resale.Created,
        cell: (resale) => formatDateTime(resale.Created),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 130,
        minWidth: 108,
        accessor: (resale) => resale.SaleNumber?.Value,
        cell: (resale) => <Text fw={700}>{displayValue(resale.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        width: 230,
        minWidth: 180,
        accessor: (resale) => getClientName(resale.ClientAgreement?.Client),
        cell: (resale) => displayValue(getClientName(resale.ClientAgreement?.Client)),
      },
      {
        id: 'agreement',
        header: t('Угода'),
        width: 220,
        minWidth: 180,
        accessor: (resale) => getAgreementName(resale.ClientAgreement?.Agreement),
        cell: (resale) => displayValue(getAgreementName(resale.ClientAgreement?.Agreement)),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (resale) => resale.Organization?.Name || resale.Organization?.FullName,
        cell: (resale) => displayValue(resale.Organization?.Name || resale.Organization?.FullName),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 220,
        minWidth: 170,
        accessor: (resale) => resale.Comment,
        cell: (resale) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(resale.Comment)}
          </Text>
        ),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (resale) => resale.TotalAmount,
        cell: (resale) => formatMoney(resale.TotalAmount),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 94,
        minWidth: 82,
        accessor: (resale) => resale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (resale) => displayValue(resale.ClientAgreement?.Agreement?.Currency?.Code || 'UAH'),
      },
      {
        id: 'payment',
        header: t('Оплата'),
        width: 150,
        minWidth: 120,
        accessor: (resale) => resale.BaseSalePaymentStatus?.SalePaymentStatusType,
        cell: (resale) => displayPaymentStatus(resale.BaseSalePaymentStatus?.SalePaymentStatusType),
      },
      {
        id: 'actions',
        header: '',
        width: 184,
        minWidth: 168,
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (resale) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label={t('Платіжний документ')}>
              <ActionIcon
                aria-label={t('Платіжний документ')}
                color="gray"
                disabled={!resale.NetUid}
                loading={exportingKey === `${resale.NetUid}:${DocumentType.PaymentDocument}`}
                size={30}
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onExport(resale, DocumentType.PaymentDocument)
                }}
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
            {resale.ChangedToInvoice && (
              <>
                <Tooltip label={t('Інвойс')}>
                  <ActionIcon
                    aria-label={t('Інвойс')}
                    color="gray"
                    disabled={!resale.NetUid}
                    loading={exportingKey === `${resale.NetUid}:${DocumentType.SalesInvoice}`}
                    size={30}
                    variant="subtle"
                    onClick={(event) => {
                      event.stopPropagation()
                      onExport(resale, DocumentType.SalesInvoice)
                    }}
                  >
                    <IconFileTypePdf size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('ТТН')}>
                  <ActionIcon
                    aria-label={t('ТТН')}
                    color="gray"
                    disabled={!resale.NetUid}
                    size={30}
                    variant="subtle"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenConsignmentNote(resale)
                    }}
                  >
                    <IconTruckDelivery size={16} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            {!resale.ChangedToInvoice && (
              <Tooltip label={t('Видалити')}>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  disabled={!resale.NetUid || removingNetId === resale.NetUid}
                  loading={removingNetId === resale.NetUid}
                  size={30}
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(resale)
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('Відкрити')}>
              <ActionIcon component={Link} to={`/resales/${resale.NetUid || ''}`} aria-label={t('Відкрити')} color="gray" size={30} variant="subtle">
                <IconArrowRight size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [exportingKey, onDelete, onExport, onOpenConsignmentNote, removingNetId, t],
  )
}

function useResaleAvailabilityColumns({
  selectedKeys,
  onToggle,
}: {
  selectedKeys: string[]
  onToggle: (row: GroupingResaleAvailability) => void
}): DataTableColumn<GroupingResaleAvailability>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<GroupingResaleAvailability>[]>(
    () => [
      {
        id: 'select',
        header: '',
        width: 54,
        minWidth: 48,
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <ActionIcon
            aria-label={t('Обрати')}
            color={selectedKeys.includes(getAvailabilityKey(row)) ? 'violet' : 'gray'}
            size={28}
            variant={selectedKeys.includes(getAvailabilityKey(row)) ? 'filled' : 'light'}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(row)
            }}
          >
            {selectedKeys.includes(getAvailabilityKey(row)) ? '✓' : '+'}
          </ActionIcon>
        ),
      },
      {
        id: 'created',
        header: t('Дата'),
        width: 142,
        minWidth: 124,
        accessor: (row) => row.CreatedReSaleAvailability,
        cell: (row) => formatDateTime(row.CreatedReSaleAvailability),
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 130,
        minWidth: 110,
        accessor: (row) => row.VendorCode,
        cell: (row) => <Text fw={700}>{displayValue(row.VendorCode)}</Text>,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 300,
        minWidth: 240,
        accessor: (row) => row.ProductName,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(row.ProductName)}
          </Text>
        ),
      },
      {
        id: 'specification',
        header: t('Специфікація'),
        width: 132,
        minWidth: 110,
        accessor: (row) => row.SpecificationCode,
        cell: (row) => displayValue(row.SpecificationCode),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.FromStorage?.Name,
        cell: (row) => displayValue(row.FromStorage?.Name),
      },
      {
        id: 'group',
        header: t('Група'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.ProductGroup,
        cell: (row) => displayValue(row.ProductGroup),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => formatAmount(row.Qty),
      },
      {
        id: 'measure',
        header: t('Од. виміру'),
        width: 116,
        minWidth: 100,
        accessor: (row) => row.MeasureUnit,
        cell: (row) => displayValue(row.MeasureUnit),
      },
      {
        id: 'price',
        header: t('Собівартість'),
        width: 128,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.AccountingGrossPrice,
        cell: (row) => formatMoney(row.AccountingGrossPrice),
      },
      {
        id: 'salePrice',
        header: t('Ціна продажу'),
        width: 128,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.SalePrice,
        cell: (row) => formatMoney(row.SalePrice),
      },
      {
        id: 'totalCost',
        header: t('Сума собівартості'),
        width: 144,
        minWidth: 124,
        align: 'right',
        accessor: (row) => row.TotalAccountingPrice,
        cell: (row) => formatMoney(row.TotalAccountingPrice),
      },
      {
        id: 'totalSale',
        header: t('Сума продажу'),
        width: 136,
        minWidth: 118,
        align: 'right',
        accessor: (row) => row.TotalSalePrice,
        cell: (row) => formatMoney(row.TotalSalePrice),
      },
    ],
    [onToggle, selectedKeys, t],
  )
}

function useProcessColumns({
  onChangeAmount,
  onChangeQty,
  onChangeSalePrice,
}: {
  onChangeAmount: (index: number, value: number | string) => void
  onChangeQty: (index: number, value: number | string) => void
  onChangeSalePrice: (index: number, value: number | string) => void
}): DataTableColumn<ResaleAvailabilityItemModel & { __rowIndex: number }>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ResaleAvailabilityItemModel & { __rowIndex: number }>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 130,
        minWidth: 110,
        accessor: (row) => row.VendorCode,
        cell: (row) => <Text fw={700}>{displayValue(row.VendorCode)}</Text>,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 260,
        minWidth: 220,
        accessor: (row) => row.ProductName,
        cell: (row) => displayValue(row.ProductName),
      },
      {
        id: 'qty',
        header: t('Доступно'),
        width: 104,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => formatAmount(row.Qty),
      },
      {
        id: 'qtyToResale',
        header: t('Кількість'),
        width: 132,
        accessor: (row) => row.QtyToReSale,
        cell: (row) => (
          <NumberInput
            min={0}
            value={row.QtyToReSale}
            onChange={(value) => onChangeQty(row.__rowIndex, value)}
          />
        ),
      },
      {
        id: 'salePrice',
        header: t('Ціна продажу'),
        width: 140,
        accessor: (row) => row.SalePrice,
        cell: (row) => (
          <NumberInput
            min={0}
            value={row.SalePrice}
            onChange={(value) => onChangeSalePrice(row.__rowIndex, value)}
          />
        ),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 140,
        accessor: (row) => row.Amount,
        cell: (row) => (
          <NumberInput
            min={0}
            value={row.Amount}
            onChange={(value) => onChangeAmount(row.__rowIndex, value)}
          />
        ),
      },
      {
        id: 'profit',
        header: t('Прибуток'),
        width: 120,
        align: 'right',
        accessor: (row) => row.Profit,
        cell: (row) => formatMoney(row.Profit),
      },
      {
        id: 'profitability',
        header: t('Рентабельність'),
        width: 132,
        align: 'right',
        accessor: (row) => row.Profitability,
        cell: (row) => `${percentFormatter.format(row.Profitability || 0)}%`,
      },
    ],
    [onChangeAmount, onChangeQty, onChangeSalePrice, t],
  )
}

function useResaleDetailColumns({
  changedToInvoice,
  isCompleted,
  onChangeAmount,
  onChangeQty,
  onChangeSalePrice,
}: {
  changedToInvoice: boolean
  isCompleted: boolean
  onChangeAmount: (index: number, value: number | string) => void
  onChangeQty: (index: number, value: number | string) => void
  onChangeSalePrice: (index: number, value: number | string) => void
}): DataTableColumn<UpdatedResaleItemModel & { __rowIndex: number }>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<UpdatedResaleItemModel & { __rowIndex: number }>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 130,
        minWidth: 110,
        accessor: getUpdatedRowVendorCode,
        cell: (row) => <Text fw={700}>{displayValue(getUpdatedRowVendorCode(row))}</Text>,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 260,
        minWidth: 220,
        accessor: getUpdatedRowProductName,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getUpdatedRowProductName(row))}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('Доступно'),
        width: 104,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => formatAmount(row.Qty),
      },
      {
        id: 'measure',
        header: t('Од. виміру'),
        width: 112,
        accessor: getUpdatedRowMeasureUnit,
        cell: (row) => displayValue(getUpdatedRowMeasureUnit(row)),
      },
      {
        id: 'specification',
        header: t('Специфікація'),
        width: 120,
        accessor: (row) => row.ConsignmentItem?.ProductSpecification?.SpecificationCode,
        cell: (row) => displayValue(row.ConsignmentItem?.ProductSpecification?.SpecificationCode),
      },
      {
        id: 'price',
        header: t('Собівартість'),
        width: 128,
        align: 'right',
        accessor: (row) => row.Price,
        cell: (row) => formatMoney(row.Price),
      },
      {
        id: 'qtyToResale',
        header: t('Кількість'),
        width: 132,
        accessor: (row) => row.QtyToReSale,
        cell: (row) => changedToInvoice ? formatAmount(row.QtyToReSale) : (
          <NumberInput min={0} value={row.QtyToReSale} onChange={(value) => onChangeQty(row.__rowIndex, value)} />
        ),
      },
      {
        id: 'salePrice',
        header: t('Ціна продажу'),
        width: 140,
        accessor: (row) => row.SalePrice,
        cell: (row) => isCompleted ? formatMoney(row.SalePrice) : (
          <NumberInput min={0} value={row.SalePrice} onChange={(value) => onChangeSalePrice(row.__rowIndex, value)} />
        ),
      },
      {
        id: 'vat',
        header: t('ПДВ'),
        width: 104,
        align: 'right',
        accessor: (row) => row.Vat,
        cell: (row) => formatMoney(row.Vat),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 140,
        accessor: (row) => row.Amount,
        cell: (row) => isCompleted ? formatMoney(row.Amount) : (
          <NumberInput min={0} value={row.Amount} onChange={(value) => onChangeAmount(row.__rowIndex, value)} />
        ),
      },
      {
        id: 'profit',
        header: t('Прибуток'),
        width: 120,
        align: 'right',
        accessor: (row) => row.Profit,
        cell: (row) => formatMoney(row.Profit),
      },
      {
        id: 'profitability',
        header: t('Рентабельність'),
        width: 132,
        align: 'right',
        accessor: (row) => row.Profitability,
        cell: (row) => `${percentFormatter.format(row.Profitability || 0)}%`,
      },
    ],
    [changedToInvoice, isCompleted, onChangeAmount, onChangeQty, onChangeSalePrice, t],
  )
}

function ResaleProcessDrawer({
  fromStorageId,
  isSaving,
  opened,
  processData,
  onClose,
  onCreate,
  onRecalculate,
}: {
  fromStorageId?: number
  isSaving: boolean
  opened: boolean
  processData: CreatedResaleAvailabilityWithTotals | null
  onClose: () => void
  onCreate: (payload: ResaleCreatePayload) => void
  onRecalculate: (payload: ResaleAvailabilityItemModel[]) => Promise<ResaleActionResult<CreatedResaleAvailabilityWithTotals>>
}) {
  const { t } = useI18n()
  const [processForm, setProcessForm] = useValueState<ProcessDrawerState>(() => createProcessDrawerState(processData))
  const [isRecalculating, setRecalculating] = useValueState(false)
  const columns = useProcessColumns({
    onChangeAmount: updateAmount,
    onChangeQty: updateQty,
    onChangeSalePrice: updateSalePrice,
  })
  const totals = useMemo(
    () => getProcessTotals(processForm.activeProcessData, processForm.rows),
    [processForm.activeProcessData, processForm.rows],
  )
  const rowsWithIndex = useMemo(
    () => processForm.rows.map((row, index) => ({ ...row, __rowIndex: index })),
    [processForm.rows],
  )

  function updateQty(index: number, value: number | string) {
    updateRow(index, { QtyToReSale: toNumber(value) })
  }

  function updateSalePrice(index: number, value: number | string) {
    updateRow(index, { SalePrice: toNumber(value) })
  }

  function updateAmount(index: number, value: number | string) {
    updateRow(index, { Amount: toNumber(value) })
  }

  function updateRow(index: number, patch: Partial<ResaleAvailabilityItemModel>) {
    setProcessForm((currentForm) => ({
      ...currentForm,
      rows: currentForm.rows.map((row, rowIndex) =>
        rowIndex === index ? applyResaleItemPatch(row, patch) : row,
      ),
    }))
  }

  async function recalculateRows() {
    setRecalculating(true)
    setProcessForm((currentForm) => ({ ...currentForm, warning: null }))

    try {
      const result = await onRecalculate(processForm.rows)

      if (result.warning) {
        setProcessForm((currentForm) => ({ ...currentForm, warning: result.warning || null }))
      } else if (result.data) {
        setProcessForm((currentForm) => ({
          ...currentForm,
          activeProcessData: result.data || null,
          rows: result.data?.ReSaleAvailabilityItemModels || [],
          warning: null,
        }))
      }
    } finally {
      setRecalculating(false)
    }
  }

  function create() {
    if (!processForm.clientAgreement || !fromStorageId) {
      setProcessForm((currentForm) => ({
        ...currentForm,
        warning: {
          Message: t('Оберіть клієнта, угоду і склад'),
        },
      }))
      return
    }

    onCreate({
      ClientAgreement: processForm.clientAgreement,
      Comment: processForm.comment,
      FromStorageId: fromStorageId,
      Organization: processForm.activeProcessData?.Organization,
      ReSaleAvailabilityModels: processForm.rows.map(mapResaleAvailabilityItemForCreate),
    })
  }

  return (
    <AppDrawer
      offset={8}
      opened={opened}
      padding="lg"
      position="right"
      radius="md"
      size="min(1180px, 96vw)"
      title={t('Обробка перепродажу')}
      onClose={onClose}
    >
      <Stack gap="lg">
        {processForm.warning && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {processForm.warning.Message}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <ResaleClientSelect
            label={t('Клієнт')}
            selectedClient={processForm.client}
            onSelectClient={(nextClient) => {
              setProcessForm((currentForm) => ({
                ...currentForm,
                client: nextClient,
                clientAgreement: null,
              }))
            }}
          />
          <Select
            searchable
            disabled={!processForm.client}
            data={buildClientAgreementOptions(processForm.client, processForm.activeProcessData?.Organization || undefined)}
            label={t('Угода')}
            value={processForm.clientAgreement?.NetUid || processForm.clientAgreement?.Id ? String(processForm.clientAgreement.NetUid || processForm.clientAgreement.Id) : null}
            onChange={(value) => {
              setProcessForm((currentForm) => ({
                ...currentForm,
                clientAgreement: findClientAgreement(currentForm.client, value),
              }))
            }}
          />
        </SimpleGrid>
        <Textarea
          label={t('Коментар')}
          minRows={2}
          value={processForm.comment}
          onChange={(event) => setProcessForm((currentForm) => ({ ...currentForm, comment: event.currentTarget.value }))}
        />
        <DetailValue label={t('Організація')} value={processForm.activeProcessData?.Organization?.Name || processForm.activeProcessData?.Organization?.FullName} />
        <TotalsCard
          items={[
            { label: t('Кількість'), value: formatAmount(totals.qty) },
            { label: t('Сума'), value: formatMoney(totals.value) },
            { label: t('ПДВ'), value: formatMoney(totals.vat) },
            { label: t('Вага'), value: formatAmount(totals.weight) },
          ]}
        />
        <DataTable
          columns={columns}
          data={rowsWithIndex}
          defaultLayout={PROCESS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Позицій для обробки немає')}
          getRowId={(row, index) => `${row.ProductId}-${row.FromStorageId}-${index}`}
          layoutVersion="resale-process-table-1"
          maxHeight="calc(100vh - 500px)"
          minWidth={1120}
          tableId="resale-process"
        />
        <Group justify="flex-end">
          <Button loading={isRecalculating} variant="light" onClick={recalculateRows}>
            {t('Перерахувати')}
          </Button>
          <Button loading={isSaving} onClick={create}>
            {t('Створити')}
          </Button>
        </Group>
      </Stack>
    </AppDrawer>
  )
}

function ResaleClientSelect({
  disabled,
  label,
  selectedClient,
  onSelectClient,
}: {
  disabled?: boolean
  label: string
  selectedClient: ResaleClient | null
  onSelectClient: (client: ResaleClient | null) => void
}) {
  const { t } = useI18n()
  const [search, setSearch] = useValueState('')
  const [clients, setClients] = useValueState<ResaleClient[]>(selectedClient ? [selectedClient] : [])
  const [isLoading, setLoading] = useValueState(false)
  const clientOptions = useMemo(() => buildClientOptions(clients), [clients])
  const selectedValue = selectedClient?.NetUid || selectedClient?.Id ? String(selectedClient.NetUid || selectedClient.Id) : null

  useEffect(() => {
    const controller = new AbortController()

    async function loadClients() {
      setLoading(true)

      try {
        const nextClients = await searchResaleClients(search, controller.signal)

        setClients((currentClients) => mergeClients(selectedClient ? [selectedClient, ...nextClients] : nextClients, currentClients))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setClients(selectedClient ? [selectedClient] : [])
        }
      } finally {
        setLoading(false)
      }
    }

    void loadClients()

    return () => {
      controller.abort()
    }
  }, [search, selectedClient, setClients, setLoading])

  return (
    <Select
      searchable
      clearable
      data={clientOptions}
      disabled={disabled}
      label={label}
      limit={20}
      nothingFoundMessage={t('Клієнтів не знайдено')}
      placeholder={t('Почніть вводити назву')}
      rightSection={isLoading ? <Text size="xs">...</Text> : undefined}
      searchValue={search}
      value={selectedValue}
      onChange={(value) => onSelectClient(findClient(clients, value))}
      onSearchChange={setSearch}
    />
  )
}

function DownloadDocumentModal({
  document,
  opened,
  title,
  onClose,
}: {
  document: ResaleExportDocument | null
  opened: boolean
  title: string
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL && (
              <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={document.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function ConsignmentNoteSettingsDrawer({
  opened,
  resale,
  onClose,
}: {
  opened: boolean
  resale: ReSale | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const defaultSetting = useMemo(() => buildDefaultConsignmentNoteSetting(resale), [resale])
  const [settings, setSettings] = useValueState<ResaleConsignmentNoteSetting[]>([])
  const [noteState, setNoteState] = useValueState<ConsignmentNoteDrawerState>(() => createConsignmentNoteDrawerState(defaultSetting))
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [isPrinting, setPrinting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<ResaleExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const settingOptions = useMemo(() => buildConsignmentSettingOptions(settings), [settings])
  const hasExistingSetting = Boolean(noteState.setting.NetUid || noteState.setting.Id)

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    setNoteState(createConsignmentNoteDrawerState(defaultSetting))

    async function loadSettings() {
      setLoading(true)

      try {
        const nextSettings = await getResaleConsignmentNoteSettings()

        if (!cancelled) {
          setSettings(nextSettings)
        }
      } catch (loadError) {
        if (!cancelled) {
          setNoteState((currentState) => ({
            ...currentState,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити налаштування ТТН'),
          }))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [
    defaultSetting,
    opened,
    setLoading,
    setNoteState,
    setSettings,
    t,
  ])

  function selectSetting(value: string | null) {
    if (!value) {
      setNoteState(createConsignmentNoteDrawerState(defaultSetting))
      return
    }

    const selectedSetting = settings.find((item) => getConsignmentSettingKey(item) === value)

    if (!selectedSetting) {
      return
    }

    const nextSetting = applyConsignmentDocumentDefaults(selectedSetting, defaultSetting)

    setNoteState({
      error: null,
      isEdited: false,
      savedSetting: nextSetting,
      selectedSettingKey: value,
      setting: nextSetting,
    })
  }

  function updateTextField(field: keyof ResaleConsignmentNoteSetting, value: string) {
    setNoteState((currentState) => ({
      ...currentState,
      isEdited: true,
      setting: {
        ...currentState.setting,
        [field]: value,
      },
    }))
  }

  function updateNumberField(field: keyof ResaleConsignmentNoteSetting, value: number | string) {
    setNoteState((currentState) => ({
      ...currentState,
      isEdited: true,
      setting: {
        ...currentState.setting,
        [field]: toNumber(value),
      },
    }))
  }

  function resetChanges() {
    setNoteState((currentState) => ({
      ...currentState,
      error: null,
      isEdited: false,
      setting: currentState.savedSetting,
    }))
  }

  async function saveSetting() {
    const validationError = getConsignmentValidationError(noteState.setting, t)

    if (validationError) {
      setNoteState((currentState) => ({ ...currentState, error: validationError }))
      return
    }

    setSaving(true)
    setNoteState((currentState) => ({ ...currentState, error: null }))

    try {
      const nextSettings = hasExistingSetting
        ? await updateResaleConsignmentNoteSetting(noteState.setting)
        : await addResaleConsignmentNoteSetting(noteState.setting)
      const nextSetting = applyConsignmentDocumentDefaults(
        findMatchingConsignmentSetting(nextSettings, noteState.setting) || noteState.setting,
        defaultSetting,
      )

      setSettings(nextSettings)
      setNoteState({
        error: null,
        isEdited: false,
        savedSetting: nextSetting,
        selectedSettingKey: getConsignmentSettingKey(nextSetting),
        setting: nextSetting,
      })
      notifications.show({
        color: 'green',
        message: hasExistingSetting ? t('Налаштування ТТН збережено') : t('Налаштування ТТН створено'),
      })
    } catch (saveError) {
      setNoteState((currentState) => ({
        ...currentState,
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти налаштування ТТН'),
      }))
    } finally {
      setSaving(false)
    }
  }

  async function deleteSetting() {
    if (!noteState.setting.NetUid) {
      setNoteState((currentState) => ({ ...currentState, error: t('Налаштування без NetUid не можна видалити') }))
      return
    }

    setSaving(true)
    setNoteState((currentState) => ({ ...currentState, error: null }))

    try {
      const nextSettings = await removeResaleConsignmentNoteSetting(noteState.setting.NetUid)

      setSettings(nextSettings)
      setNoteState(createConsignmentNoteDrawerState(defaultSetting))
      notifications.show({
        color: 'green',
        message: t('Налаштування ТТН видалено'),
      })
    } catch (deleteError) {
      setNoteState((currentState) => ({
        ...currentState,
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити налаштування ТТН'),
      }))
    } finally {
      setSaving(false)
    }
  }

  async function printDocument() {
    const validationError = getConsignmentValidationError(noteState.setting, t)

    if (validationError) {
      setNoteState((currentState) => ({ ...currentState, error: validationError }))
      return
    }

    if (!resale?.NetUid) {
      setNoteState((currentState) => ({ ...currentState, error: t('Не вказано перепродаж для друку ТТН') }))
      return
    }

    setPrinting(true)
    setNoteState((currentState) => ({ ...currentState, error: null }))

    try {
      const document = await printResaleConsignmentNoteDocument(resale.NetUid, noteState.setting)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (printError) {
      setNoteState((currentState) => ({
        ...currentState,
        error: printError instanceof Error ? printError.message : t('Не вдалося сформувати ТТН'),
      }))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <AppDrawer
      offset={8}
      opened={opened}
      padding="lg"
      position="right"
      radius="md"
      size="min(760px, 96vw)"
      title={t('Друк ТТН')}
      onClose={onClose}
    >
      <Stack gap="lg">
        {noteState.error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {noteState.error}
          </Alert>
        )}

        <Group justify="space-between" align="end" gap="sm">
          <Box style={{ flex: '1 1 260px' }}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('По документу')}
            </Text>
            <Text fw={600} size="sm">
              {t('Інвойс')} {displayValue(resale?.SaleNumber?.Value)} {t('від')} {formatDateTime(getConsignmentNoteDate(resale))}
            </Text>
          </Box>
          <Select
            clearable
            searchable
            data={settingOptions}
            disabled={isLoading}
            label={t('Існуючі налаштування')}
            placeholder={t('Обрати')}
            value={noteState.selectedSettingKey}
            style={{ flex: '1 1 260px' }}
            onChange={selectSetting}
          />
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput
            label={t('Назва')}
            maxLength={200}
            value={noteState.setting.Name || ''}
            onChange={(event) => updateTextField('Name', event.currentTarget.value)}
          />
          <TextInput label={t('Номер')} value={noteState.setting.Number || ''} onChange={(event) => updateTextField('Number', event.currentTarget.value)} />
          <TextInput
            label={t('Марка і номер авто')}
            maxLength={200}
            value={noteState.setting.BrandAndNumberCar || ''}
            onChange={(event) => updateTextField('BrandAndNumberCar', event.currentTarget.value)}
          />
          <TextInput
            label={t('Номер причепа')}
            maxLength={200}
            value={noteState.setting.TrailerNumber || ''}
            onChange={(event) => updateTextField('TrailerNumber', event.currentTarget.value)}
          />
          <TextInput
            label={t('Замовник')}
            maxLength={200}
            value={noteState.setting.Customer || ''}
            onChange={(event) => updateTextField('Customer', event.currentTarget.value)}
          />
          <TextInput
            label={t('Водій')}
            maxLength={200}
            value={noteState.setting.Driver || ''}
            onChange={(event) => updateTextField('Driver', event.currentTarget.value)}
          />
          <TextInput
            label={t('Перевізник')}
            maxLength={200}
            value={noteState.setting.Carrier || ''}
            onChange={(event) => updateTextField('Carrier', event.currentTarget.value)}
          />
          <TextInput
            label={t('Тип перевезення')}
            maxLength={200}
            value={noteState.setting.TypeTransportation || ''}
            onChange={(event) => updateTextField('TypeTransportation', event.currentTarget.value)}
          />
          <TextInput
            label={t('Пункт розвантаження')}
            maxLength={500}
            value={noteState.setting.UnloadingPoint || ''}
            onChange={(event) => updateTextField('UnloadingPoint', event.currentTarget.value)}
          />
          <TextInput
            label={t('Пункт завантаження')}
            maxLength={500}
            value={noteState.setting.LoadingPoint || ''}
            onChange={(event) => updateTextField('LoadingPoint', event.currentTarget.value)}
          />
        </SimpleGrid>

        <Stack gap="sm">
          <Text fw={700}>{t('Авто')}</Text>
          <TextInput
            label={t('Заголовок')}
            maxLength={200}
            value={noteState.setting.CarLabel || t('ConsignmentLabels.InformationCarTitle')}
            onChange={(event) => updateTextField('CarLabel', event.currentTarget.value)}
          />
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
            <NumberInput label="L" value={noteState.setting.CarLength || 0} onChange={(value) => updateNumberField('CarLength', value)} />
            <NumberInput label="W" value={noteState.setting.CarWidth || 0} onChange={(value) => updateNumberField('CarWidth', value)} />
            <NumberInput label="H" value={noteState.setting.CarHeight || 0} onChange={(value) => updateNumberField('CarHeight', value)} />
            <NumberInput label="NW" value={noteState.setting.CarNetWeight || 0} onChange={(value) => updateNumberField('CarNetWeight', value)} />
            <NumberInput label="GW" value={noteState.setting.CarGrossWeight || 0} onChange={(value) => updateNumberField('CarGrossWeight', value)} />
          </SimpleGrid>
        </Stack>

        <Stack gap="sm">
          <Text fw={700}>{t('Причіп')}</Text>
          <TextInput
            label={t('Заголовок')}
            maxLength={200}
            value={noteState.setting.TrailerLabel || t('ConsignmentLabels.InformationTrailerSubTitle')}
            onChange={(event) => updateTextField('TrailerLabel', event.currentTarget.value)}
          />
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
            <NumberInput label="L" value={noteState.setting.TrailerLength || 0} onChange={(value) => updateNumberField('TrailerLength', value)} />
            <NumberInput label="W" value={noteState.setting.TrailerWidth || 0} onChange={(value) => updateNumberField('TrailerWidth', value)} />
            <NumberInput label="H" value={noteState.setting.TrailerHeight || 0} onChange={(value) => updateNumberField('TrailerHeight', value)} />
            <NumberInput label="NW" value={noteState.setting.TrailerNetWeight || 0} onChange={(value) => updateNumberField('TrailerNetWeight', value)} />
            <NumberInput label="GW" value={noteState.setting.TrailerGrossWeight || 0} onChange={(value) => updateNumberField('TrailerGrossWeight', value)} />
          </SimpleGrid>
        </Stack>

        <Group justify="flex-end">
          <Button color="gray" disabled={!noteState.isEdited || isSaving} variant="light" onClick={resetChanges}>
            {t('Скасувати')}
          </Button>
          {hasExistingSetting && (
            <Button color="red" disabled={isSaving || isPrinting} variant="light" onClick={deleteSetting}>
              {t('Видалити')}
            </Button>
          )}
          <Button disabled={!noteState.isEdited || isPrinting} loading={isSaving} variant="light" onClick={saveSetting}>
            {hasExistingSetting ? t('Зберегти') : t('Створити')}
          </Button>
          <Button leftSection={<IconTruckDelivery size={16} />} loading={isPrinting} onClick={printDocument}>
            {t('Друк')}
          </Button>
        </Group>
      </Stack>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('ТТН')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </AppDrawer>
  )
}

function TotalsCard({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <SimpleGrid cols={{ base: 2, md: items.length }} spacing="sm">
      {items.map((item) => (
        <Card key={item.label} withBorder radius="sm" padding="sm">
          <Text c="dimmed" size="xs" tt="uppercase">
            {item.label}
          </Text>
          <Text fw={700}>{item.value}</Text>
        </Card>
      ))}
    </SimpleGrid>
  )
}

function DetailValue({ label, value }: { label: string; value?: string | number }) {
  return (
    <Card withBorder radius="sm" padding="sm">
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={600} size="sm" lineClamp={2}>
        {displayValue(value)}
      </Text>
    </Card>
  )
}

type ResaleAvailabilityWithTotalsTotals = {
  totalQty: number
  totalValueWithVat: number
  totalWithExtraValue: number
}

function getEmptyAvailabilityTotals(): ResaleAvailabilityWithTotalsTotals {
  return {
    totalQty: 0,
    totalValueWithVat: 0,
    totalWithExtraValue: 0,
  }
}

function buildAvailabilityPayload(form: ResaleAvailabilityForm): ResaleAvailabilityFilterPayload {
  return {
    Amount: form.amount,
    ExtraChargePercent: form.extraChargePercent,
    From: toStartOfDayIso(form.from),
    IncludedProductGroups: parseNumberValues(form.productGroupIds),
    IncludedSpecificationCodes: form.specificationCodes.map((code) => (code === EMPTY_SPECIFICATION_VALUE ? '' : code)),
    IncludedStorages: parseNumberValues(form.storageIds),
    PossibleAmountDistinct: form.infelicity,
    Search: form.search.trim(),
    To: toEndOfDayIso(form.to),
  }
}

const EMPTY_SPECIFICATION_VALUE = '__empty_specification__'

function buildProductGroupOptions(productGroups: ResaleProductGroup[]): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = []

  function addGroups(groups: ResaleProductGroup[], prefix = '') {
    groups.forEach((group) => {
      if (typeof group.Id === 'number') {
        options.push({
          label: `${prefix}${group.Name || translate('Без назви')}`,
          value: String(group.Id),
        })
      }

      const subGroups = (group.SubProductGroups || []).flatMap((item) =>
        item.SubProductGroup ? [item.SubProductGroup] : [],
      )

      addGroups(subGroups, `${prefix}${group.Name || translate('Група')} / `)
    })
  }

  addGroups(productGroups)

  return options
}

function buildStorageOptions(storages: ResaleStorage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (typeof storage.Id === 'number') {
      options.push({
        label: storage.Name || translate('Без назви'),
        value: String(storage.Id),
      })
    }

    return options
  }, [])
}

function buildGenerateStorageOptions(storages: ResaleStorage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (storage.NetUid) {
      options.push({
        label: storage.Name || translate('Без назви'),
        value: storage.NetUid,
      })
    }

    return options
  }, [])
}

function buildSpecificationOptions(codes: string[], t: (value: string) => string): { label: string; value: string }[] {
  const options = new Map<string, string>()

  codes.forEach((code) => {
    const value = code || EMPTY_SPECIFICATION_VALUE

    if (!options.has(value)) {
      options.set(value, code || t('Порожній код'))
    }
  })

  if (!options.has(EMPTY_SPECIFICATION_VALUE)) {
    options.set(EMPTY_SPECIFICATION_VALUE, t('Порожній код'))
  }

  return Array.from(options.entries()).map(([value, label]) => ({ label, value }))
}

function buildSpecificationSelection(codes: string[]): string[] {
  const selectedCodes = codes.map((code) => code || EMPTY_SPECIFICATION_VALUE)

  if (!selectedCodes.includes(EMPTY_SPECIFICATION_VALUE)) {
    selectedCodes.push(EMPTY_SPECIFICATION_VALUE)
  }

  return Array.from(new Set(selectedCodes))
}

function collectProductGroupIds(productGroups: ResaleProductGroup[]): string[] {
  return buildProductGroupOptions(productGroups).map((option) => option.value)
}

function collectStorageIds(storages: ResaleStorage[]): string[] {
  return buildStorageOptions(storages).map((option) => option.value)
}

function parseNumberValues(values: string[]): number[] {
  return values.reduce<number[]>((numbers, value) => {
    const numberValue = Number(value)

    if (Number.isFinite(numberValue)) {
      numbers.push(numberValue)
    }

    return numbers
  }, [])
}

function getAvailabilityKey(row: GroupingResaleAvailability): string {
  return `${row.ProductId}-${readAvailabilityStorageId(row) || 0}-${row.SpecificationCode || ''}`
}

function hasSingleStorage(rows: GroupingResaleAvailability[]): boolean {
  const firstStorageId = readAvailabilityStorageId(rows[0])

  return rows.every((row) => readAvailabilityStorageId(row) === firstStorageId)
}

function mapAvailabilityToItemModel(row: GroupingResaleAvailability): ResaleAvailabilityItemModel {
  const fromStorageId = readAvailabilityStorageId(row) || 0

  return {
    Amount: row.TotalSalePrice || 0,
    ConsignmentItem: {},
    ExchangeRate: row.ExchangeRate,
    FromStorageId: fromStorageId,
    MeasureUnit: row.MeasureUnit,
    OldValue: {
      Amount: row.TotalSalePrice || 0,
      QtyToReSale: row.Qty || 0,
      SalePrice: row.TotalSalePrice || 0,
    },
    OrganizationId: row.OrganizationId ?? row.FromStorage?.OrganizationId,
    Price: row.AccountingGrossPrice || 0,
    ProductId: row.ProductId,
    ProductName: row.ProductName,
    Profit: 0,
    Profitability: 0,
    Qty: row.Qty || 0,
    QtyToReSale: row.Qty || 0,
    ReSaleAvailabilities: [],
    SalePrice: row.SalePrice || 0,
    SpecificationCode: row.SpecificationCode,
    Vat: 0,
    VendorCode: row.VendorCode,
    Weight: row.Weight,
  }
}

function readAvailabilityStorageId(row?: GroupingResaleAvailability): number | undefined {
  return row?.FromStorageId ?? row?.FromStorage?.Id
}

function createProcessDrawerState(processData: CreatedResaleAvailabilityWithTotals | null): ProcessDrawerState {
  return {
    activeProcessData: processData,
    client: null,
    clientAgreement: null,
    comment: '',
    rows: processData?.ReSaleAvailabilityItemModels || [],
    warning: null,
  }
}

function applyResaleItemPatch(
  row: ResaleAvailabilityItemModel,
  patch: Partial<ResaleAvailabilityItemModel>,
): ResaleAvailabilityItemModel {
  return {
    ...row,
    ...patch,
    OldValue: {
      Amount: patch.Amount ?? row.Amount,
      QtyToReSale: patch.QtyToReSale ?? row.QtyToReSale,
      SalePrice: patch.SalePrice ?? row.SalePrice,
    },
  }
}

function mapResaleAvailabilityItemForCreate(item: ResaleAvailabilityItemModel): ResaleAvailabilityItemModel {
  return {
    ...item,
    OldValue: {
      Amount: 0,
      QtyToReSale: 0,
      SalePrice: 0,
    },
  }
}

function getProcessTotals(data: CreatedResaleAvailabilityWithTotals | null, rows: ResaleAvailabilityItemModel[]) {
  return {
    qty: data?.Qty ?? rows.reduce((total, row) => total + (row.QtyToReSale || 0), 0),
    value: data?.Value ?? rows.reduce((total, row) => total + (row.Amount || 0), 0),
    vat: data?.Vat ?? rows.reduce((total, row) => total + (row.Vat || 0), 0),
    weight: data?.Weight ?? rows.reduce((total, row) => total + (row.Weight || 0), 0),
  }
}

function getDetailTotals(model: UpdatedResaleModel | null, rows: UpdatedResaleItemModel[]) {
  return {
    amount: model?.TotalAmount ?? rows.reduce((total, row) => total + (row.Amount || 0), 0),
    qty: model?.TotalQty ?? rows.reduce((total, row) => total + (row.QtyToReSale || 0), 0),
    vat: model?.TotalVat ?? rows.reduce((total, row) => total + (row.Vat || 0), 0),
    weight: model?.TotalWeight ?? 0,
  }
}

function buildClientOptions(clients: ResaleClient[]): { label: string; value: string }[] {
  return clients.reduce<Array<{ label: string; value: string }>>((options, client) => {
    const value = client.NetUid || (typeof client.Id === 'number' ? String(client.Id) : '')

    if (value) {
      options.push({
        label: getClientName(client) || translate('Без назви'),
        value,
      })
    }

    return options
  }, [])
}

function mergeClients(nextClients: ResaleClient[], currentClients: ResaleClient[]): ResaleClient[] {
  const merged = [...nextClients, ...currentClients]
  const seen = new Set<string>()

  return merged.filter((client) => {
    const key = client.NetUid || String(client.Id || '')

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function findClient(clients: ResaleClient[], value: string | null): ResaleClient | null {
  if (!value) {
    return null
  }

  return clients.find((client) => client.NetUid === value || String(client.Id) === value) || null
}

function buildClientAgreementOptions(
  client: ResaleClient | null,
  organization?: { Id?: number } | null,
): { label: string; value: string }[] {
  if (!client?.ClientAgreements) {
    return []
  }

  return client.ClientAgreements
    .filter((clientAgreement) => {
      const agreement = clientAgreement.Agreement

      if (!agreement?.ForReSale) {
        return false
      }

      return !organization?.Id || agreement.OrganizationId === organization.Id
    })
    .reduce<Array<{ label: string; value: string }>>((options, clientAgreement) => {
      const value = clientAgreement.NetUid || (typeof clientAgreement.Id === 'number' ? String(clientAgreement.Id) : '')

      if (value) {
        options.push({
          label: `${getAgreementName(clientAgreement.Agreement) || translate('Угода')} (${clientAgreement.Agreement?.Currency?.Code || 'UAH'})`,
          value,
        })
      }

      return options
    }, [])
}

function findClientAgreement(client: ResaleClient | null, value: string | null): ResaleClientAgreement | null {
  if (!client?.ClientAgreements || !value) {
    return null
  }

  return client.ClientAgreements.find((agreement) => agreement.NetUid === value || String(agreement.Id) === value) || null
}

function getResaleStatusLabel(resale: ReSale): string {
  if (resale.ChangedToInvoice) {
    return resale.IsCompleted ? translate('Завершено') : translate('Інвойс')
  }

  return translate('Рахунок')
}

function getClientName(client?: ResaleClient | null): string | undefined {
  return client?.Name || client?.FullName || client?.LastName
}

function getAgreementName(agreement?: ResaleAgreement | null): string | undefined {
  return agreement?.Name || agreement?.FullName
}

function displayPaymentStatus(status?: number): string {
  if (typeof status !== 'number') {
    return '—'
  }

  const statusMap: Record<number, string> = {
    0: translate('Не оплачено'),
    1: translate('Оплачено'),
    2: translate('Оплачено'),
    3: translate('Частково'),
    4: translate('Повернення'),
  }

  return statusMap[status] || String(status)
}

function buildDefaultConsignmentNoteSetting(resale: ReSale | null): ResaleConsignmentNoteSetting {
  return {
    BrandAndNumberCar: '',
    CarGrossWeight: 0,
    CarHeight: 0,
    CarLabel: '',
    CarLength: 0,
    CarNetWeight: 0,
    Carrier: '',
    CarWidth: 0,
    Customer: '',
    Driver: '',
    Id: 0,
    LoadingPoint: getConsignmentLoadingPoint(resale),
    Name: '',
    Number: buildConsignmentNoteNumber(resale?.SaleNumber?.Value),
    TrailerGrossWeight: 0,
    TrailerHeight: 0,
    TrailerLabel: '',
    TrailerLength: 0,
    TrailerNetWeight: 0,
    TrailerNumber: '',
    TrailerWidth: 0,
    TypeTransportation: '',
    UnloadingPoint: '',
  }
}

function createConsignmentNoteDrawerState(defaultSetting: ResaleConsignmentNoteSetting): ConsignmentNoteDrawerState {
  return {
    error: null,
    isEdited: false,
    savedSetting: defaultSetting,
    selectedSettingKey: null,
    setting: defaultSetting,
  }
}

function buildConsignmentNoteNumber(saleNumber?: string): string {
  const numberPart = saleNumber?.replace(/[^0-9]/g, '')

  return numberPart ? `P${Number.parseInt(numberPart, 10)}` : 'P'
}

function getConsignmentLoadingPoint(resale: ReSale | null): string {
  return resale?.ClientAgreement?.Agreement?.Organization?.Address || resale?.Organization?.Address || ''
}

function getConsignmentNoteDate(resale: ReSale | null): string | undefined {
  if (typeof resale?.ChangedToInvoice === 'string') {
    return resale.ChangedToInvoice
  }

  return resale?.Created
}

function applyConsignmentDocumentDefaults(
  setting: ResaleConsignmentNoteSetting,
  defaults: ResaleConsignmentNoteSetting,
): ResaleConsignmentNoteSetting {
  return {
    ...defaults,
    ...setting,
    LoadingPoint: defaults.LoadingPoint,
    Number: defaults.Number,
  }
}

function buildConsignmentSettingOptions(settings: ResaleConsignmentNoteSetting[]): { label: string; value: string }[] {
  return settings.reduce<Array<{ label: string; value: string }>>((options, setting) => {
    const value = getConsignmentSettingKey(setting)

    if (value) {
      options.push({
        label: setting.Name || translate('Без назви'),
        value,
      })
    }

    return options
  }, [])
}

function getConsignmentSettingKey(setting: ResaleConsignmentNoteSetting): string {
  return setting.NetUid || (typeof setting.Id === 'number' && setting.Id > 0 ? String(setting.Id) : '')
}

function findMatchingConsignmentSetting(
  settings: ResaleConsignmentNoteSetting[],
  source: ResaleConsignmentNoteSetting,
): ResaleConsignmentNoteSetting | undefined {
  const sourceKey = getConsignmentSettingKey(source)

  if (sourceKey) {
    return settings.find((setting) => getConsignmentSettingKey(setting) === sourceKey)
  }

  return settings.find((setting) => setting.Name === source.Name && setting.Number === source.Number)
}

function getConsignmentValidationError(
  setting: ResaleConsignmentNoteSetting,
  t: (value: string) => string,
): string | null {
  if (!setting.Name) {
    return t('Вкажіть назву')
  }

  if (!setting.BrandAndNumberCar) {
    return t('Вкажіть марку і номер авто')
  }

  if (!setting.Driver) {
    return t('Вкажіть водія')
  }

  if (!setting.LoadingPoint) {
    return t('Вкажіть пункт завантаження')
  }

  if (!setting.UnloadingPoint) {
    return t('Вкажіть пункт розвантаження')
  }

  return null
}

function getUpdatedRowProduct(row: UpdatedResaleItemModel) {
  return row.ReSaleItems?.[0]?.ReSaleAvailability?.Product
}

function getUpdatedRowVendorCode(row: UpdatedResaleItemModel): string | undefined {
  return getUpdatedRowProduct(row)?.VendorCode
}

function getUpdatedRowProductName(row: UpdatedResaleItemModel): string | undefined {
  const product = getUpdatedRowProduct(row)

  return product?.NameUA || product?.Name
}

function getUpdatedRowMeasureUnit(row: UpdatedResaleItemModel): string | undefined {
  return getUpdatedRowProduct(row)?.MeasureUnit?.Name
}

function readTotal(items: ReSale[]): number | undefined {
  const first = items[0] as ReSale & { TotalRowsQty?: number; TotalRowQty?: number }

  return first?.TotalRowsQty ?? first?.TotalRowQty
}

function getDateInputValue(date: Date): string {
  return formatLocalDate(date)
}

function shiftDateInput(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return getDateInputValue(date)
}

function toStartOfDayIso(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00.000`).toISOString()
}

function toEndOfDayIso(dateValue: string): string {
  return new Date(`${dateValue}T23:59:59.999`).toISOString()
}

function getDateRangeError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Оберіть діапазон дат')
  }

  if (from > to) {
    return translate('Дата “Від” не може бути більшою за дату “До”')
  }

  return null
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return amountFormatter.format(value)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return moneyFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function toNumber(value: number | string): number {
  const parsedValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}
