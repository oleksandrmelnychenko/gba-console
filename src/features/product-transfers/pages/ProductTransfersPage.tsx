import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
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
  IconDownload,
  IconEye,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconPlus,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { UserRoleType } from '../../../shared/auth/types'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  addProductTransferFromFile,
  exportProductTransferDocument,
  getProductTransferByNetId,
  getProductTransfers,
  getProductTransferStorages,
} from '../api/productTransfersApi'
import type {
  ProductTransfer,
  ProductTransferExportDocument,
  ProductTransferItem,
  ProductTransferLocation,
  ProductTransferStorage,
} from '../types'

type FilterDraft = {
  from: string
  to: string
}

type CreateFormState = {
  comment: string
  file: File | null
  fromDate: string
  fromStorageNetUid: string
  isManagement: boolean
  toStorageNetUid: string
  vendorCodeColumnNumber: number | ''
  qtyColumnNumber: number | ''
  startRow: number | ''
  endRow: number | ''
}

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']

const PRODUCT_TRANSFERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'date', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PRODUCT_TRANSFER_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'product'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

function useProductTransfersPageModel() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-7),
      to: today,
    }),
    [today],
  )
  const { user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [transfers, setTransfers] = useValueState<ProductTransfer[]>([])
  const [storages, setStorages] = useValueState<ProductTransferStorage[]>([])
  const [selectedTransfer, setSelectedTransfer] = useValueState<ProductTransfer | null>(null)
  const [detailError, setDetailError] = useValueState<string | null>(null)
  const [isDetailLoading, setDetailLoading] = useValueState(false)
  const [isCreateModalOpen, setCreateModalOpen] = useValueState(false)
  const [createForm, setCreateForm] = useValueState<CreateFormState>(() => createInitialForm(today))
  const [createError, setCreateError] = useValueState<string | null>(null)
  const [exceptionMessages, setExceptionMessages] = useValueState<string[]>([])
  const [isCreating, setCreating] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [storageError, setStorageError] = useValueState<string | null>(null)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductTransferExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [totalQty, setTotalQty] = useValueState(0)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const detailRequestRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const resetTransfers = useCallback(() => {
    setTransfers([])
    setHasMore(false)
    setTotalQty(0)
    setLoading(false)
    setSelectedTransfer(null)
  }, [setHasMore, setLoading, setSelectedTransfer, setTotalQty, setTransfers])
  const fromStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === createForm.fromStorageNetUid) || null,
    [createForm.fromStorageNetUid, storages],
  )
  const toStorageOptions = useMemo(() => {
    if (!fromStorage) {
      return storageOptions
    }

    const availableStorages = createForm.isManagement
      ? storages
      : storages.filter((storage) => storage.OrganizationId === fromStorage.OrganizationId)

    return availableStorages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
      if (isSameStorage(storage, fromStorage)) {
        return options
      }

      const option = toStorageOption(storage)

      if (option) {
        options.push(option)
      }

      return options
    }, [])
  }, [createForm.isManagement, fromStorage, storageOptions, storages])
  const effectiveToStorageNetUid = toStorageOptions.some((option) => option.value === createForm.toStorageNetUid)
    ? createForm.toStorageNetUid
    : toStorageOptions[0]?.value || ''

  const openDetail = useCallback(async (transfer: ProductTransfer) => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setSelectedTransfer(transfer)
    setDetailError(null)

    if (!transfer.NetUid) {
      return
    }

    setDetailLoading(true)

    try {
      const detailedTransfer = await getProductTransferByNetId(transfer.NetUid)

      if (detailRequestRef.current === requestId && detailedTransfer) {
        setSelectedTransfer(detailedTransfer)
      }
    } catch (loadError) {
      if (detailRequestRef.current === requestId) {
        setDetailError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі переміщення'))
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }, [setDetailError, setDetailLoading, setSelectedTransfer, t])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1
    setSelectedTransfer(null)
    setDetailError(null)
    setDetailLoading(false)
    closeDownload()
  }, [closeDownload, setDetailError, setDetailLoading, setSelectedTransfer])

  const openDownload = useCallback(async (transfer: ProductTransfer) => {
    if (!transfer.NetUid) {
      return
    }

    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    setDownloadOpened(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await exportProductTransferDocument(transfer.NetUid)

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(
          exportError instanceof Error ? exportError.message : t('Документ недоступний для завантаження'),
        )
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading, t])

  const transferIndexMap = useMemo(() => buildTransferIndexMap(transfers), [transfers])
  const columns = useProductTransferColumns(openDetail, transferIndexMap)

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {transfers.length}
        {totalQty > transfers.length ? ` ${t('з')} ${totalQty}` : ''}
        {hasMore ? '+' : ''}
      </Text>
    ),
    [hasMore, t, totalQty, transfers.length],
  )

  const toolbarRight = useMemo(
    () => (
      <Group gap={6} wrap="nowrap">
        <Select
          aria-label={t('Кількість рядків')}
          data={PAGE_SIZE_OPTIONS}
          size="xs"
          value={String(pageSize)}
          w={88}
          onChange={(value) => {
            setPageSize(Number(value || DEFAULT_PAGE_SIZE))
            reload()
          }}
        />
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size="sm"
            variant="subtle"
            onClick={() => reload()}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [isLoading, pageSize, setPageSize, t],
  )

  useProductTransferStoragesLoader({
    reloadKey,
    setCreateForm,
    setLoadingStorages,
    setStorageError,
    setStorages,
  })

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])
  useProductTransfersLoader({
    activeFilters,
    filterError,
    pageSize,
    reloadKey,
    resetTransfers,
    setError,
    setHasMore,
    setLoading,
    setTotalQty,
    setTransfers,
  })

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  async function loadMoreTransfers() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = transfers.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getProductTransfers({
        from: activeFilters.from,
        limit: pageSize,
        offset: requestOffset,
        to: activeFilters.to,
      })

      if (listRequestKeyRef.current === requestKey) {
        setTransfers((current) => (current.length === requestOffset ? [...current, ...result.items] : current))
        setTotalQty(result.totalQty)
        setHasMore(requestOffset + result.items.length < result.totalQty && result.items.length > 0)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні переміщення'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  function openCreateModal() {
    setCreateError(null)
    setCreateForm((current) => resolveStorageDefaults(current, storages))
    setCreateModalOpen(true)
  }

  function closeCreateModal() {
    if (!isCreating) {
      setCreateModalOpen(false)
      setCreateError(null)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)

    const createFormForSave = {
      ...createForm,
      toStorageNetUid: effectiveToStorageNetUid,
    }
    const validationError = validateCreateForm(createFormForSave, storages)

    if (validationError) {
      setCreateError(validationError)
      return
    }

    const selectedFromStorage = storages.find((storage) => storage.NetUid === createFormForSave.fromStorageNetUid)
    const selectedToStorage = storages.find((storage) => storage.NetUid === createFormForSave.toStorageNetUid)

    if (!selectedFromStorage || !selectedToStorage || !createForm.file) {
      setCreateError(t('Заповніть склад, файл і конфігурацію імпорту'))
      return
    }

    setCreating(true)

    try {
      const messages = await addProductTransferFromFile({
        file: createForm.file,
        parseConfiguration: {
          EndRow: Number(createForm.endRow),
          QtyColumnNumber: Number(createForm.qtyColumnNumber),
          StartRow: Number(createForm.startRow),
          VendorCodeColumnNumber: Number(createForm.vendorCodeColumnNumber),
        },
        productTransfer: {
          Comment: createForm.comment.trim(),
          FromDate: createForm.fromDate,
          FromStorage: selectedFromStorage,
          IsManagement: createForm.isManagement,
          ToStorage: selectedToStorage,
        },
      })

      setCreateModalOpen(false)
      setCreateForm(resolveStorageDefaults(createInitialForm(today), storages))
      reload()

      if (messages.length > 0) {
        setExceptionMessages(messages)
      }

      notifications.show({
        color: messages.length > 0 ? 'yellow' : 'green',
        message: messages.length > 0 ? t('Переміщення створено з попередженнями') : t('Переміщення створено'),
      })
    } catch (createErrorValue) {
      setCreateError(
        createErrorValue instanceof Error ? createErrorValue.message : t('Не вдалося створити переміщення з файлу'),
      )
    } finally {
      setCreating(false)
    }
  }

  return {
    columns, createError, createForm, detailError, downloadDocument, downloadError, downloadOpened,
    effectiveToStorageNetUid, error, exceptionMessages, filterDraft, filterError, hasMore, isAdmin,
    isCreateModalOpen, isCreating, isDetailLoading, isDownloading, isLoading, isLoadingMore, isLoadingStorages,
    selectedTransfer, storageError, storageOptions, storages, toolbarLeft, toolbarRight, toStorageOptions,
    transfers, closeCreateModal, closeDownload, handleCreate, loadMoreTransfers, openCreateModal, openDetail,
    openDownload, reload, resetFilters, setCreateForm, setExceptionMessages, applyFilters, setSelectedTransfer,
    closeDetail,
  }
}

type ProductTransferCreateFormSetter =
  (value: CreateFormState | ((current: CreateFormState) => CreateFormState)) => void

function useProductTransferStoragesLoader({
  reloadKey,
  setCreateForm,
  setLoadingStorages,
  setStorageError,
  setStorages,
}: {
  reloadKey: number
  setCreateForm: ProductTransferCreateFormSetter
  setLoadingStorages: (value: boolean) => void
  setStorageError: (value: string | null) => void
  setStorages: (value: ProductTransferStorage[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setStorageError(null)

      try {
        const nextStorages = await getProductTransferStorages()

        if (!cancelled) {
          setStorages(nextStorages)
          setCreateForm((current) => resolveStorageDefaults(current, nextStorages))
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setStorageError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setLoadingStorages(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setCreateForm, setLoadingStorages, setStorageError, setStorages, t])
}

function useProductTransfersLoader({
  activeFilters,
  filterError,
  pageSize,
  reloadKey,
  resetTransfers,
  setError,
  setHasMore,
  setLoading,
  setTotalQty,
  setTransfers,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  pageSize: number
  reloadKey: number
  resetTransfers: () => void
  setError: (value: string | null) => void
  setHasMore: (value: boolean) => void
  setLoading: (value: boolean) => void
  setTotalQty: (value: number) => void
  setTransfers: (value: ProductTransfer[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetTransfers()
      return
    }

    let cancelled = false

    async function loadTransfers() {
      setLoading(true)
      setError(null)

      try {
        const result = await getProductTransfers({
          from: activeFilters.from,
          limit: pageSize,
          offset: 0,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setTransfers(result.items)
          setTotalQty(result.totalQty)
          setHasMore(result.items.length < result.totalQty && result.items.length > 0)
        }
      } catch (loadError) {
        if (!cancelled) {
          setTransfers([])
          setHasMore(false)
          setTotalQty(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити переміщення товарів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTransfers()

    return () => {
      cancelled = true
    }
  }, [
    activeFilters,
    filterError,
    pageSize,
    reloadKey,
    resetTransfers,
    setError,
    setHasMore,
    setLoading,
    setTotalQty,
    setTransfers,
    t,
  ])
}

export function ProductTransfersPage() {
  const model = useProductTransfersPageModel()

  return <ProductTransfersPageView model={model} />
}

function ProductTransfersPageView({ model }: { model: ReturnType<typeof useProductTransfersPageModel> }) {
  return (
    <Stack gap="lg">
      <ProductTransfersHeader model={model} />
      <ProductTransfersTableCard model={model} />
      <ProductTransferDetailDrawer model={model} />
      <ProductTransferCreateModal model={model} />
      <ProductTransferImportResultModal model={model} />
    </Stack>
  )
}

function ProductTransfersHeader({ model }: { model: ReturnType<typeof useProductTransfersPageModel> }) {
  const { t } = useI18n()
  const { isLoading, isLoadingStorages, openCreateModal, reload, storageOptions } = model

  return (
    <Group justify="flex-end" align="center">
      <Group gap="xs">
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading || isLoadingStorages}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
        <Button
          color="violet"
          disabled={!isLoadingStorages && storageOptions.length === 0}
          leftSection={<IconPlus size={16} />}
          loading={isLoadingStorages}
          onClick={openCreateModal}
        >
          {t('Нове переміщення')}
        </Button>
      </Group>
    </Group>
  )
}

function ProductTransfersTableCard({ model }: { model: ReturnType<typeof useProductTransfersPageModel> }) {
  const { t } = useI18n()
  const {
    columns, error, filterDraft, filterError, hasMore, isLoading, isLoadingMore, openDetail, loadMoreTransfers,
    resetFilters, applyFilters, storageError, toolbarLeft, toolbarRight, transfers,
  } = model

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('З')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
          />
          <TextInput
            label={t('По')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {(error || filterError || storageError) && (
          <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || error || storageError}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={transfers}
          defaultLayout={PRODUCT_TRANSFERS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Переміщень не знайдено')}
          getRowId={(transfer, index) => String(transfer.NetUid || transfer.Id || index)}
          isLoading={isLoading}
          layoutVersion="product-transfers-table-2"
          loadingText={t('Завантаження переміщень')}
          maxHeight="calc(100vh - 340px)"
          minWidth={1780}
          tableId="product-transfers"
          toolbarLeft={toolbarLeft}
          toolbarRight={toolbarRight}
          onRowClick={openDetail}
        />

        {hasMore && (
          <Group justify="center">
            <Button color="gray" loading={isLoadingMore} variant="light" onClick={loadMoreTransfers}>
              {t('Завантажити ще')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

function ProductTransferDetailDrawer({ model }: { model: ReturnType<typeof useProductTransfersPageModel> }) {
  const { t } = useI18n()
  const {
    closeDetail, closeDownload, detailError, downloadDocument, downloadError, downloadOpened, isDetailLoading,
    isDownloading, openDownload, selectedTransfer,
  } = model

  return (
    <AppDrawer
      opened={Boolean(selectedTransfer)}
      position="right"
      size="min(920px, 100vw)"
      title={t('Деталі переміщення')}
      onClose={closeDetail}
    >
      {selectedTransfer && (
        <>
          <Group justify="flex-end" mb="md">
            <Button
              color="violet"
              disabled={!selectedTransfer.NetUid}
              leftSection={<IconDownload size={16} />}
              loading={isDownloading}
              variant="light"
              onClick={() => openDownload(selectedTransfer)}
            >
              {t('Завантажити')}
            </Button>
          </Group>
          <TransferDetail error={detailError} isLoading={isDetailLoading} transfer={selectedTransfer} />
        </>
      )}

      <AppModal
        centered
        opened={downloadOpened}
        title={t('Завантажити')}
        onClose={closeDownload}
      >
        <Stack gap="sm">
          {isDownloading ? (
            <Text c="dimmed" size="sm">
              {t('Завантаження')}
            </Text>
          ) : downloadError ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {downloadError}
            </Alert>
          ) : downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
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
    </AppDrawer>
  )
}

function ProductTransferCreateModal({ model }: { model: ReturnType<typeof useProductTransfersPageModel> }) {
  const { t } = useI18n()
  const {
    closeCreateModal, createError, createForm, effectiveToStorageNetUid, handleCreate, isAdmin, isCreateModalOpen,
    isCreating, isLoadingStorages, setCreateForm, storageError, storageOptions, storages, toStorageOptions,
  } = model

  return (
    <AppModal centered opened={isCreateModalOpen} size="xl" title={t('Нове переміщення з файлу')} onClose={closeCreateModal}>
      <form id="product-transfer-create-form" onSubmit={handleCreate}>
        <Stack gap="md">
          {createError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {createError}
            </Alert>
          )}
          {storageError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {storageError}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              searchable
              allowDeselect={false}
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0 || isCreating}
              label={t('Зі складу')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={createForm.fromStorageNetUid || null}
              onChange={(value) =>
                setCreateForm((current) => {
                  const nextFromStorage = storages.find((storage) => storage.NetUid === value)
                  const nextToStorage = current.isManagement
                    ? current.toStorageNetUid
                    : getDefaultToStorage(storages, nextFromStorage)?.NetUid || ''

                  return {
                    ...current,
                    fromStorageNetUid: value || '',
                    toStorageNetUid: nextToStorage,
                  }
                })
              }
            />
            <Select
              searchable
              allowDeselect={false}
              data={toStorageOptions}
              disabled={isLoadingStorages || toStorageOptions.length === 0 || isCreating}
              label={t('На склад')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={effectiveToStorageNetUid || null}
              onChange={(value) => setCreateForm((current) => ({ ...current, toStorageNetUid: value || '' }))}
            />
          </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                disabled={isCreating}
                label={t('Дата')}
                type="date"
                value={createForm.fromDate}
                onChange={(event) => setCreateForm((current) => ({ ...current, fromDate: event.currentTarget.value }))}
              />
              <Switch
                checked={createForm.isManagement}
                disabled={!isAdmin || isCreating}
                label={t('Управлінське переміщення')}
                mt={30}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    isManagement: event.currentTarget.checked,
                  }))
                }
              />
            </SimpleGrid>

            <Textarea
              autosize
              disabled={isCreating}
              label={t('Коментар')}
              minRows={2}
              value={createForm.comment}
              onChange={(event) => setCreateForm((current) => ({ ...current, comment: event.currentTarget.value }))}
            />

            <SimpleGrid cols={{ base: 1, sm: 4 }}>
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                disabled={isCreating}
                label={t('Колонка коду')}
                min={1}
                value={createForm.vendorCodeColumnNumber}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, vendorCodeColumnNumber: toNumberInputValue(value) }))
                }
              />
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                disabled={isCreating}
                label={t('Колонка кількості')}
                min={1}
                value={createForm.qtyColumnNumber}
                onChange={(value) => setCreateForm((current) => ({ ...current, qtyColumnNumber: toNumberInputValue(value) }))}
              />
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                disabled={isCreating}
                label={t('Початковий рядок')}
                min={1}
                value={createForm.startRow}
                onChange={(value) => setCreateForm((current) => ({ ...current, startRow: toNumberInputValue(value) }))}
              />
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                disabled={isCreating}
                label={t('Кінцевий рядок')}
                min={1}
                value={createForm.endRow}
                onChange={(value) => setCreateForm((current) => ({ ...current, endRow: toNumberInputValue(value) }))}
              />
            </SimpleGrid>

            <FileInput
              accept=".xls,.xlsx"
              clearable
              disabled={isCreating}
              label={t('Файл')}
              leftSection={<IconFileSpreadsheet size={16} />}
              placeholder={t('XLS або XLSX')}
              value={createForm.file}
              onChange={(file) => setCreateForm((current) => ({ ...current, file }))}
            />

            {!isAdmin && (
              <Text c="dimmed" size="xs">
                {t('Управлінське переміщення доступне тільки для ролей Administrator або GBA.')}
              </Text>
            )}

            <Group justify="flex-end">
              <Button color="gray" disabled={isCreating} type="button" variant="subtle" onClick={closeCreateModal}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" loading={isCreating} type="submit">
                {t('Створити')}
              </Button>
            </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function ProductTransferImportResultModal({ model }: { model: ReturnType<typeof useProductTransfersPageModel> }) {
  const { t } = useI18n()
  const { exceptionMessages, setExceptionMessages } = model

  return (
    <AppModal
      centered
      opened={exceptionMessages.length > 0}
      size="lg"
      title={t('Результат імпорту')}
      onClose={() => setExceptionMessages([])}
    >
      <Stack gap="sm">
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {t('Частину рядків файла сервер обробив з попередженнями.')}
        </Alert>
        <ScrollArea.Autosize mah="50vh" type="auto">
          <Stack gap="xs">
            {exceptionMessages.map((message, index) => (
              <Text key={`${message}-${index}`} size="sm">
                {message}
              </Text>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={() => setExceptionMessages([])}>
            {t('Закрити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function useProductTransferColumns(
  onOpenDetail: (transfer: ProductTransfer) => void,
  indexMap: Map<ProductTransfer, number>,
) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductTransfer>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableHiding: false,
        accessor: (transfer) => indexMap.get(transfer) || 0,
        cell: (transfer) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(transfer) || ''}
          </Text>
        ),
      },
      {
        id: 'date',
        header: 'Дата',
        width: 148,
        minWidth: 132,
        accessor: (transfer) => getDateTime(transfer.FromDate),
        cell: (transfer) => (
          <>
            <Text fw={600}>{displayValue(formatDate(parseDate(transfer.FromDate)))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(formatTime(parseDate(transfer.FromDate)))}
            </Text>
          </>
        ),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 150,
        minWidth: 132,
        accessor: (transfer) => transfer.Number || transfer.NetUid,
        cell: (transfer) => <Text fw={600}>{displayValue(transfer.Number)}</Text>,
      },
      {
        id: 'management',
        header: 'Упр.',
        width: 88,
        minWidth: 76,
        align: 'center',
        accessor: (transfer) => Boolean(transfer.IsManagement),
        cell: (transfer) =>
          transfer.IsManagement ? (
            <Badge color="violet" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Ні')}
            </Text>
          ),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 230,
        minWidth: 180,
        accessor: (transfer) => transfer.Organization?.Name,
        cell: (transfer) => displayValue(transfer.Organization?.Name),
      },
      {
        id: 'fromStorage',
        header: 'Зі складу',
        width: 240,
        minWidth: 190,
        accessor: (transfer) => transfer.FromStorage?.Name,
        cell: (transfer) => displayValue(transfer.FromStorage?.Name),
      },
      {
        id: 'toStorage',
        header: 'На склад',
        width: 240,
        minWidth: 190,
        accessor: (transfer) => transfer.ToStorage?.Name,
        cell: (transfer) => displayValue(transfer.ToStorage?.Name),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 190,
        minWidth: 160,
        accessor: getResponsibleName,
        cell: (transfer) => displayValue(getResponsibleName(transfer)),
      },
      {
        id: 'items',
        header: 'Позиції',
        width: 102,
        minWidth: 92,
        align: 'right',
        accessor: (transfer) => transfer.ProductTransferItems?.length || 0,
        cell: (transfer) => displayValue(transfer.ProductTransferItems?.length || 0),
      },
      {
        id: 'qty',
        header: 'К-сть',
        width: 112,
        minWidth: 100,
        align: 'right',
        accessor: getTransferQty,
        cell: (transfer) => formatAmount(getTransferQty(transfer)),
      },
      {
        id: 'comment',
        header: 'Коментар',
        width: 260,
        minWidth: 190,
        accessor: (transfer) => transfer.Comment,
        cell: (transfer) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(transfer.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (transfer) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Деталі')}>
              <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => onOpenDetail(transfer)}>
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [indexMap, onOpenDetail, t],
  )
}

function buildTransferIndexMap(transfers: ProductTransfer[]): Map<ProductTransfer, number> {
  return transfers.reduce((indexMap, transfer, index) => {
    indexMap.set(transfer, index + 1)

    return indexMap
  }, new Map<ProductTransfer, number>())
}

function TransferDetail({
  error,
  isLoading,
  transfer,
}: {
  error: string | null
  isLoading: boolean
  transfer: ProductTransfer
}) {
  const { t } = useI18n()
  const items = useMemo(() => transfer.ProductTransferItems || [], [transfer.ProductTransferItems])
  const itemIndexMap = useMemo(
    () =>
      items.reduce((indexMap, item, index) => {
        indexMap.set(item, index + 1)

        return indexMap
      }, new Map<ProductTransferItem, number>()),
    [items],
  )
  const itemColumns = useMemo<DataTableColumn<ProductTransferItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableHiding: false,
        accessor: (item) => itemIndexMap.get(item) || 0,
        cell: (item) => (
          <Text c="dimmed" size="sm">
            {itemIndexMap.get(item) || ''}
          </Text>
        ),
      },
      {
        id: 'product',
        header: 'Товар',
        accessor: (item) => getProductName(item),
        minWidth: 240,
      },
      {
        id: 'code',
        header: 'Код',
        accessor: (item) => getProductCode(item),
        width: 120,
      },
      {
        id: 'qty',
        header: 'К-сть',
        accessor: (item) => toNumber(item.Qty),
        align: 'right',
        cell: (item) => formatAmount(toNumber(item.Qty)),
        width: 120,
      },
      {
        id: 'unit',
        header: 'Од.',
        accessor: (item) => item.Product?.MeasureUnit?.ShortName || item.Product?.MeasureUnit?.Name,
        width: 110,
      },
      {
        id: 'locations',
        header: 'Розміщення',
        accessor: (item) => formatLocations(item.ProductLocations || []),
        minWidth: 180,
      },
      {
        id: 'reason',
        header: 'Причина',
        accessor: (item) => item.Reason,
        minWidth: 160,
      },
    ],
    [itemIndexMap],
  )

  return (
    <Stack gap="md">
      {error && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Group gap="xs">
        {transfer.IsManagement && (
          <Badge color="violet" variant="light">
            {t('Управлінське')}
          </Badge>
        )}
        {isLoading && (
          <Badge color="gray" variant="light">
            {t('Завантаження деталей')}
          </Badge>
        )}
      </Group>

      <DetailRows
        rows={[
          [t('Організація'), transfer.Organization?.Name],
          [t('Зі складу'), transfer.FromStorage?.Name],
          [t('На склад'), transfer.ToStorage?.Name],
          [t('Відповідальний'), getResponsibleName(transfer)],
          [t('Позицій'), items.length],
          [t('Кількість'), formatAmount(getTransferQty(transfer))],
        ]}
      />

      {transfer.Comment && (
        <>
          <Divider />
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{transfer.Comment}</Text>
          </Box>
        </>
      )}

      <Divider />

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{t('Позиції')}</Text>
          <Badge color="gray" variant="light">
            {items.length}
          </Badge>
        </Group>
        <DataTable
          columns={itemColumns}
          data={items}
          defaultLayout={PRODUCT_TRANSFER_ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Позицій не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          layoutVersion="product-transfer-items-table-2"
          maxHeight="48vh"
          minWidth={900}
          tableId="product-transfer-items"
        />
      </Stack>
    </Stack>
  )
}

function DetailRows({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <Stack gap={6}>
      {rows.map(([label, value]) => (
        <Group key={label} justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text size="sm" ta="right">
            {displayValue(value)}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

function createInitialForm(today: string): CreateFormState {
  return {
    comment: '',
    endRow: '',
    file: null,
    fromDate: today,
    fromStorageNetUid: '',
    isManagement: false,
    qtyColumnNumber: '',
    startRow: '',
    toStorageNetUid: '',
    vendorCodeColumnNumber: '',
  }
}

function resolveStorageDefaults(form: CreateFormState, storages: ProductTransferStorage[]): CreateFormState {
  if (storages.length === 0) {
    return {
      ...form,
      fromStorageNetUid: '',
      toStorageNetUid: '',
    }
  }

  const fromStorage =
    storages.find((storage) => storage.NetUid === form.fromStorageNetUid) || storages.find((storage) => storage.NetUid)
  const toStorages = form.isManagement
    ? storages
    : storages.filter((storage) => storage.OrganizationId === fromStorage?.OrganizationId)
  const toStorage =
    toStorages.find((storage) => storage.NetUid === form.toStorageNetUid && !isSameStorage(storage, fromStorage))
    || getDefaultToStorage(toStorages, fromStorage)
    || toStorages.find((storage) => storage.NetUid)

  return {
    ...form,
    fromStorageNetUid: fromStorage?.NetUid || '',
    toStorageNetUid: toStorage?.NetUid || '',
  }
}

function validateCreateForm(form: CreateFormState, storages: ProductTransferStorage[]): string | null {
  const fromStorage = storages.find((storage) => storage.NetUid === form.fromStorageNetUid)
  const toStorage = storages.find((storage) => storage.NetUid === form.toStorageNetUid)

  if (!fromStorage || !toStorage) {
    return translate('Оберіть склади для переміщення')
  }

  if (fromStorage.Id && toStorage.Id && fromStorage.Id === toStorage.Id) {
    return translate('Склади не можуть збігатися')
  }

  if (!form.isManagement && fromStorage.OrganizationId !== toStorage.OrganizationId) {
    return translate('Для звичайного переміщення склади мають належати одній організації')
  }

  if (!form.fromDate) {
    return translate('Вкажіть дату переміщення')
  }

  if (!form.file) {
    return translate('Додайте XLS або XLSX файл')
  }

  if (!isPositiveNumber(form.vendorCodeColumnNumber) || !isPositiveNumber(form.qtyColumnNumber)) {
    return translate('Номери колонок мають бути більші за 0')
  }

  if (!isPositiveNumber(form.startRow) || !isPositiveNumber(form.endRow)) {
    return translate('Номери рядків мають бути більші за 0')
  }

  if (Number(form.vendorCodeColumnNumber) === Number(form.qtyColumnNumber)) {
    return translate('Колонка коду товару не може збігатися з колонкою кількості')
  }

  if (Number(form.endRow) < Number(form.startRow)) {
    return translate('Кінцевий рядок не може бути меншим за початковий')
  }

  return null
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function toStorageOption(storage: ProductTransferStorage): { label: string; value: string } | null {
  if (!storage.NetUid) {
    return null
  }

  return {
    label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : ''].filter(Boolean).join(' '),
    value: storage.NetUid,
  }
}

function buildStorageOptions(storages: ProductTransferStorage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    const option = toStorageOption(storage)

    if (option) {
      options.push(option)
    }

    return options
  }, [])
}

function getDefaultToStorage(
  storages: ProductTransferStorage[],
  fromStorage?: ProductTransferStorage | null,
): ProductTransferStorage | undefined {
  return storages.find((storage) => storage.NetUid && !isSameStorage(storage, fromStorage))
}

function isSameStorage(firstStorage?: ProductTransferStorage | null, secondStorage?: ProductTransferStorage | null): boolean {
  if (!firstStorage || !secondStorage) {
    return false
  }

  if (firstStorage.NetUid && secondStorage.NetUid) {
    return firstStorage.NetUid === secondStorage.NetUid
  }

  return Boolean(firstStorage.Id && secondStorage.Id && firstStorage.Id === secondStorage.Id)
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateTime(value: unknown): number {
  return parseDate(value)?.getTime() || 0
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string' || !value) {
    return null
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString('uk-UA') : ''
}

function formatTime(value: Date | null): string {
  return value ? value.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''
}

function getResponsibleName(transfer: ProductTransfer): string {
  const responsible = transfer.Responsible

  return (
    responsible?.FullName?.trim()
    || responsible?.Name?.trim()
    || [responsible?.LastName, responsible?.FirstName, responsible?.MiddleName].filter(Boolean).join(' ').trim()
    || responsible?.Abbreviation?.trim()
    || ''
  )
}

function getTransferQty(transfer: ProductTransfer): number {
  return (transfer.ProductTransferItems || []).reduce((total, item) => total + (toNumber(item.Qty) || 0), 0)
}

function getProductName(item: ProductTransferItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getProductCode(item: ProductTransferItem): string {
  return item.Product?.VendorCode || item.Product?.Articul || item.Product?.MainOriginalNumber || ''
}

function formatLocations(locations: ProductTransferLocation[]): string {
  const formattedLocations = locations.reduce<string[]>((values, location) => {
    const value = formatLocation(location)

    if (value) {
      values.push(value)
    }

    return values
  }, [])

  return formattedLocations.join(', ')
}

function formatLocation(location: ProductTransferLocation): string {
  const placement = location.ProductPlacement
  const address = [placement?.StorageNumber, placement?.RowNumber, placement?.CellNumber].filter(Boolean).join('-')
  const qty = formatAmount(toNumber(location.Qty) ?? toNumber(placement?.Qty))

  if (!address && qty === '—') {
    return ''
  }

  if (!address) {
    return `${translate('Кількість')} ${qty}`
  }

  return `${address}: ${qty}`
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toNumberInputValue(value: string | number): number | '' {
  if (value === '') {
    return ''
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : ''
}

function isPositiveNumber(value: number | ''): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
