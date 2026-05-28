import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
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
  IconArrowsExchange,
  IconCheck,
  IconClipboardList,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef, type Dispatch, type SetStateAction } from 'react'
import { UserRoleType } from '../../../shared/auth/types'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  createProductStorageSupplyReturn,
  createProductStorageTransfer,
  createProductStorageWriteOff,
  exportProductStorageAvailability,
  getAvailableProductsByStorage,
  getProductStorageAvailableConsignments,
  getProductStorageStorages,
} from '../api/productStoragesApi'
import type {
  ProductStorageAvailableConsignment,
  ProductStorageAvailability,
  ProductStoragePlacement,
  ProductStorageProduct,
  ProductStorageStorage,
  ProductStoragesExportDocument,
} from '../types'

const PRODUCT_STORAGES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['select', 'vendorCode', 'productName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const pageSizeOptions = ['50', '100', '150']
const PRODUCT_STORAGES_ACTION_PERMISSION = 'Products_Storages_Action_WithAPosition_Btn_PKEY'
const PRODUCT_STORAGES_PREVIEW_PERMISSION = 'Products_Storages_Preview_Btn_PKEY'
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const dateFormatter = new Intl.DateTimeFormat('uk-UA')

type ProductStorageActionMode = 'return' | 'transfer' | 'writeoff'
type ProductStorageActionScope = 'group' | 'single'

type ProductStorageActionRow = {
  availability: ProductStorageAvailability
  changedQty: number
}

type ProductStorageActionModalState = {
  mode: ProductStorageActionMode
  rows: ProductStorageActionRow[]
  scope: ProductStorageActionScope
} | null

type ProductStorageActionForm = {
  cellNumber: string
  comment: string
  consignmentId: string
  fromDate: string
  isManagement: boolean
  qty: number | ''
  reason: string
  rowNumber: string
  storageNumber: string
  toStorageNetUid: string
}

type ReturnConsignmentsState = {
  error: string | null
  isLoading: boolean
  items: ProductStorageAvailableConsignment[]
}

function useProductStoragesPageModel() {
  const { t } = useI18n()
  const { hasPermission, user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const [availabilities, setAvailabilities] = useValueState<ProductStorageAvailability[]>([])
  const [storages, setStorages] = useValueState<ProductStorageStorage[]>([])
  const [selectedStorageNetId, setSelectedStorageNetId] = useValueState('')
  const [selectedAvailabilities, setSelectedAvailabilities] = useValueState<ProductStorageAvailability[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [pageSize, setPageSize] = useValueState(50)
  const [hasMore, setHasMore] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductStoragesExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [previewOpened, setPreviewOpened] = useValueState(false)
  const [previewRows, setPreviewRows] = useValueState<ProductStorageActionRow[]>([])
  const [actionModal, setActionModal] = useValueState<ProductStorageActionModalState>(null)
  const [actionForm, setActionForm] = useValueState<ProductStorageActionForm>(() => createActionForm())
  const [actionError, setActionError] = useValueState<string | null>(null)
  const [isActionSubmitting, setActionSubmitting] = useValueState(false)
  const [returnConsignmentsState, setReturnConsignmentsState] = useValueState<ReturnConsignmentsState>({
    error: null,
    isLoading: false,
    items: [],
  })
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const listRequestKey = `${selectedStorageNetId}|${searchValue}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const canOpenAction = hasPermission(PRODUCT_STORAGES_ACTION_PERMISSION)
  const canOpenPreview = hasPermission(PRODUCT_STORAGES_PREVIEW_PERMISSION)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === selectedStorageNetId) || null,
    [selectedStorageNetId, storages],
  )
  const selectedAvailabilityKeys = useMemo(
    () => new Set(selectedAvailabilities.map(getAvailabilityKey)),
    [selectedAvailabilities],
  )
  const visibleSelectableAvailabilities = useMemo(
    () => availabilities.filter((availability) => Boolean(getAvailabilityKey(availability))),
    [availabilities],
  )
  const isAllVisibleSelected =
    visibleSelectableAvailabilities.length > 0 &&
    visibleSelectableAvailabilities.every((availability) => selectedAvailabilityKeys.has(getAvailabilityKey(availability)))
  const isSomeVisibleSelected =
    visibleSelectableAvailabilities.some((availability) => selectedAvailabilityKeys.has(getAvailabilityKey(availability))) &&
    !isAllVisibleSelected
  const columns = useProductStoragesColumns({
    canOpenAction,
    isAllVisibleSelected,
    isSomeVisibleSelected,
    selectedAvailabilityKeys,
    onOpenAction: openSingleAction,
    onToggleAvailability: toggleAvailability,
    onToggleVisible: toggleVisibleAvailabilities,
  })
  const actionRows = useMemo(() => actionModal?.rows || [], [actionModal])
  const actionFromStorage = useMemo(
    () => resolveStorage(selectedStorage, actionRows[0]?.availability),
    [actionRows, selectedStorage],
  )
  const toStorageOptions = useMemo(
    () => buildToStorageOptions(storages, actionFromStorage, actionForm.isManagement),
    [actionForm.isManagement, actionFromStorage, storages],
  )
  const effectiveToStorageNetUid = toStorageOptions.some((option) => option.value === actionForm.toStorageNetUid)
    ? actionForm.toStorageNetUid
    : toStorageOptions[0]?.value || ''
  const selectedActionToStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === effectiveToStorageNetUid) || null,
    [effectiveToStorageNetUid, storages],
  )
  const selectedReturnConsignment = useMemo(
    () => returnConsignmentsState.items.find((consignment) => getConsignmentKey(consignment) === actionForm.consignmentId) || null,
    [actionForm.consignmentId, returnConsignmentsState.items],
  )
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Завантажено')} {availabilities.length}
        {selectedAvailabilities.length ? `, ${t('обрано')}: ${selectedAvailabilities.length}` : ''}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [availabilities.length, searchValue, selectedAvailabilities.length, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setError(null)

      try {
        const nextStorages = await getProductStorageStorages()

        if (!cancelled) {
          setStorages(nextStorages)
          setSelectedStorageNetId((currentStorageNetId) => {
            if (currentStorageNetId && nextStorages.some((storage) => storage.NetUid === currentStorageNetId)) {
              return currentStorageNetId
            }

            return nextStorages.find((storage) => storage.NetUid)?.NetUid || ''
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setSelectedStorageNetId('')
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
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
  }, [reloadKey, setError, setLoadingStorages, setSelectedStorageNetId, setStorages, t])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    if (!selectedStorageNetId) {
      setAvailabilities([])
      setHasMore(false)
      return
    }

    let cancelled = false

    async function loadAvailabilities() {
      setLoading(true)
      setError(null)

      try {
        const nextAvailabilities = await getAvailableProductsByStorage({
          limit: pageSize,
          offset: 0,
          storageNetId: selectedStorageNetId,
          value: searchValue,
        })

        if (!cancelled) {
          setAvailabilities(nextAvailabilities)
          setHasMore(nextAvailabilities.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAvailabilities([])
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари складу'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAvailabilities()

    return () => {
      cancelled = true
    }
  }, [pageSize, reloadKey, searchValue, selectedStorageNetId, setAvailabilities, setError, setHasMore, setLoading, t])

  useEffect(() => {
    if (actionModal?.mode !== 'return' || actionModal.scope !== 'single') {
      setReturnConsignmentsState({
        error: null,
        isLoading: false,
        items: [],
      })
      return
    }

    const availability = actionModal.rows[0]?.availability
    const productNetId = getProductNetUid(availability)
    const storageNetId = getStorageNetUid(availability) || actionFromStorage?.NetUid || ''

    if (!productNetId || !storageNetId) {
      setReturnConsignmentsState({
        error: t('Не вдалося визначити товар або склад для повернення'),
        isLoading: false,
        items: [],
      })
      return
    }

    let cancelled = false

    async function loadReturnConsignments() {
      setReturnConsignmentsState({
        error: null,
        isLoading: true,
        items: [],
      })

      try {
        const nextConsignments = await getProductStorageAvailableConsignments({
          productNetId,
          storageNetId,
        })

        if (!cancelled) {
          setReturnConsignmentsState({
            error: null,
            isLoading: false,
            items: nextConsignments,
          })
          setActionForm((currentForm) => {
            if (
              currentForm.consignmentId &&
              nextConsignments.some((consignment) => getConsignmentKey(consignment) === currentForm.consignmentId)
            ) {
              return currentForm
            }

            return {
              ...currentForm,
              consignmentId: getConsignmentKey(nextConsignments[0]) || '',
            }
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setReturnConsignmentsState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити партії для повернення'),
            isLoading: false,
            items: [],
          })
        }
      }
    }

    void loadReturnConsignments()

    return () => {
      cancelled = true
    }
  }, [
    actionFromStorage,
    actionModal,
    setActionForm,
    setReturnConsignmentsState,
    t,
  ])

  function selectStorageNetId(nextStorageNetId: string) {
    if (selectedStorageNetId !== nextStorageNetId) {
      closeStorageActions()
    }

    setSelectedStorageNetId(nextStorageNetId)
  }

  function updateSearch(nextValue: string) {
    setAvailabilities([])
    setHasMore(false)
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
  }

  function resetFilters() {
    setSearchDraft('')
    setSearchValue('')
    selectStorageNetId(storageOptions[0]?.value || '')
  }

  function toggleAvailability(availability: ProductStorageAvailability, checked?: boolean) {
    const availabilityKey = getAvailabilityKey(availability)

    if (!availabilityKey) {
      return
    }

    setSelectedAvailabilities((currentAvailabilities) => {
      const isSelected = currentAvailabilities.some((currentAvailability) => getAvailabilityKey(currentAvailability) === availabilityKey)
      const shouldSelect = typeof checked === 'boolean' ? checked : !isSelected

      if (shouldSelect && !isSelected) {
        return [...currentAvailabilities, availability]
      }

      if (!shouldSelect && isSelected) {
        return currentAvailabilities.filter((currentAvailability) => getAvailabilityKey(currentAvailability) !== availabilityKey)
      }

      return currentAvailabilities
    })
  }

  function toggleVisibleAvailabilities(checked: boolean) {
    setSelectedAvailabilities((currentAvailabilities) => {
      const visibleKeys = new Set(visibleSelectableAvailabilities.map(getAvailabilityKey))

      if (!checked) {
        return currentAvailabilities.filter((availability) => !visibleKeys.has(getAvailabilityKey(availability)))
      }

      const currentKeys = new Set(currentAvailabilities.map(getAvailabilityKey))
      const nextAvailabilities = [...currentAvailabilities]

      visibleSelectableAvailabilities.forEach((availability) => {
        const availabilityKey = getAvailabilityKey(availability)

        if (availabilityKey && !currentKeys.has(availabilityKey)) {
          nextAvailabilities.push(availability)
        }
      })

      return nextAvailabilities
    })
  }

  function openPreview() {
    const rows = createActionRows(selectedAvailabilities)

    setPreviewRows(rows)
    setPreviewOpened(true)
    setActionError(null)
  }

  function updatePreviewQty(availability: ProductStorageAvailability, value: number | string) {
    const availabilityKey = getAvailabilityKey(availability)
    const changedQty = typeof value === 'number' && Number.isFinite(value) ? value : 0

    setPreviewRows((currentRows) =>
      currentRows.map((row) =>
        getAvailabilityKey(row.availability) === availabilityKey
          ? {
              ...row,
              changedQty,
            }
          : row,
      ),
    )
  }

  function removePreviewRow(availability: ProductStorageAvailability) {
    const availabilityKey = getAvailabilityKey(availability)

    setPreviewRows((currentRows) => currentRows.filter((row) => getAvailabilityKey(row.availability) !== availabilityKey))
    setSelectedAvailabilities((currentAvailabilities) =>
      currentAvailabilities.filter((currentAvailability) => getAvailabilityKey(currentAvailability) !== availabilityKey),
    )
  }

  function openSingleAction(availability: ProductStorageAvailability) {
    const rows = createActionRows([availability])

    setActionModal({
      mode: 'transfer',
      rows,
      scope: 'single',
    })
    setActionForm(createActionForm(rows[0]?.changedQty))
    setActionError(null)
  }

  function openGroupAction() {
    const rows = previewRows.filter(isValidActionRow)

    if (rows.length === 0) {
      setActionError(t('Оберіть позиції з валідною кількістю'))
      return
    }

    setActionModal({
      mode: 'transfer',
      rows,
      scope: 'group',
    })
    setActionForm(createActionForm())
    setActionError(null)
  }

  function closeActionModal() {
    setActionModal(null)
    setActionForm(createActionForm())
    setActionError(null)
    setReturnConsignmentsState({
      error: null,
      isLoading: false,
      items: [],
    })
  }

  function closeStorageActions() {
    setSelectedAvailabilities([])
    setPreviewOpened(false)
    setPreviewRows([])
    closeActionModal()
  }

  function changeActionMode(mode: ProductStorageActionMode) {
    setActionModal((currentModal) => {
      if (!currentModal) {
        return currentModal
      }

      return {
        ...currentModal,
        mode,
      }
    })
    setActionError(null)
    setReturnConsignmentsState({
      error: null,
      isLoading: false,
      items: [],
    })
    setActionForm((currentForm) => ({
      ...currentForm,
      consignmentId: '',
    }))
  }

  async function submitAction() {
    if (!actionModal) {
      return
    }

    const validationError = validateAction(actionModal, actionForm, {
      fromStorage: actionFromStorage,
      selectedConsignment: selectedReturnConsignment,
      toStorageNetUid: effectiveToStorageNetUid,
      toStorageOptions,
    })

    if (validationError) {
      setActionError(t(validationError))
      return
    }

    const fromStorage = actionFromStorage
    const selectedToStorage = storages.find((storage) => storage.NetUid === effectiveToStorageNetUid) || null

    if (!fromStorage) {
      setActionError(t('Не вдалося визначити склад'))
      return
    }

    setActionSubmitting(true)
    setActionError(null)

    try {
      if (actionModal.mode === 'transfer') {
        if (!selectedToStorage) {
          setActionError(t('Оберіть склад призначення'))
          return
        }

        await createProductStorageTransfer({
          cellNumber: actionModal.scope === 'single' ? actionForm.cellNumber.trim() : '',
          rowNumber: actionModal.scope === 'single' ? actionForm.rowNumber.trim() : '',
          storageNumber: actionModal.scope === 'single' ? actionForm.storageNumber.trim() : '',
          productTransfer: {
            Comment: actionForm.comment.trim(),
            FromDate: actionForm.fromDate,
            FromStorage: fromStorage,
            IsManagement: actionForm.isManagement && isAdmin,
            Organization: fromStorage.Organization || null,
            ProductTransferItems: buildTransferItems(actionModal, actionForm),
            ToStorage: selectedToStorage,
          },
        })
      } else if (actionModal.mode === 'writeoff') {
        await createProductStorageWriteOff({
          Comment: actionForm.comment.trim(),
          DepreciatedOrderItems: buildWriteOffItems(actionModal, actionForm),
          FromDate: actionForm.fromDate,
          IsManagement: actionForm.isManagement && isAdmin,
          Organization: fromStorage.Organization || null,
          Storage: fromStorage,
        })
      } else if (selectedReturnConsignment) {
        const availability = actionModal.rows[0]?.availability

        await createProductStorageSupplyReturn({
          ClientAgreement: selectedReturnConsignment.ClientAgreement || null,
          Comment: actionForm.comment.trim(),
          FromDate: actionForm.fromDate,
          IsManagement: actionForm.isManagement,
          Organization: selectedReturnConsignment.Organization || null,
          Storage: fromStorage,
          Supplier: selectedReturnConsignment.Supplier || null,
          SupplyReturnItems: [
            {
              ConsignmentItemId: selectedReturnConsignment.ConsignmentItemId,
              Product: getAvailabilityProduct(availability),
              Qty: Number(actionForm.qty),
            },
          ],
        })
      }

      notifications.show({
        color: 'green',
        message: t(getActionSuccessMessage(actionModal.mode)),
      })
      closeStorageActions()
      reload()
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : t('Не вдалося виконати операцію'))
    } finally {
      setActionSubmitting(false)
    }
  }

  async function loadMore() {
    if (!selectedStorageNetId || isLoadingMore) {
      return
    }

    const requestKey = listRequestKeyRef.current
    const requestOffset = availabilities.length
    setLoadingMore(true)
    setError(null)

    try {
      const nextAvailabilities = await getAvailableProductsByStorage({
        limit: pageSize,
        offset: requestOffset,
        storageNetId: selectedStorageNetId,
        value: searchValue,
      })

      if (listRequestKeyRef.current === requestKey) {
        setAvailabilities((currentAvailabilities) =>
          currentAvailabilities.length === requestOffset ? [...currentAvailabilities, ...nextAvailabilities] : currentAvailabilities,
        )
        setHasMore(nextAvailabilities.length === pageSize)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні товари'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  async function handleExport() {
    if (!selectedStorageNetId) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportProductStorageAvailability(selectedStorageNetId)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт складу'))
    } finally {
      setExporting(false)
    }
  }

  return {
    availabilities,
    actionError,
    actionForm,
    actionFromStorage,
    actionModal,
    columns,
    downloadDocument,
    downloadModalOpened,
    effectiveToStorageNetUid,
    error,
    hasMore,
    isActionSubmitting,
    isAdmin,
    isExporting,
    isLoading,
    isLoadingMore,
    isLoadingStorages,
    isLoadingReturnConsignments: returnConsignmentsState.isLoading,
    pageSize,
    previewOpened,
    previewRows,
    returnConsignments: returnConsignmentsState.items,
    returnConsignmentsError: returnConsignmentsState.error,
    searchDraft,
    selectedAvailabilities,
    selectedAvailabilityKeys,
    selectedActionToStorage,
    selectedStorageNetId,
    selectedReturnConsignment,
    storageOptions,
    toolbarLeft,
    toStorageOptions,
    canOpenPreview,
    changeActionMode,
    closeActionModal,
    closeStorageActions,
    handleExport,
    loadMore,
    openGroupAction,
    openPreview,
    reload,
    removePreviewRow,
    resetFilters,
    selectStorageNetId,
    setActionForm,
    setDownloadModalOpened,
    setPageSize,
    setPreviewOpened,
    submitAction,
    toggleAvailability,
    updatePreviewQty,
    updateSearch,
  }
}

export function ProductStoragesPage() {
  const model = useProductStoragesPageModel()

  return <ProductStoragesPageView model={model} />
}

function ProductStoragesPageView({ model }: { model: ReturnType<typeof useProductStoragesPageModel> }) {
  const { t } = useI18n()
  const {
    availabilities,
    actionError,
    actionForm,
    actionFromStorage,
    actionModal,
    columns,
    downloadDocument,
    downloadModalOpened,
    effectiveToStorageNetUid,
    error,
    hasMore,
    isActionSubmitting,
    isAdmin,
    isExporting,
    isLoading,
    isLoadingMore,
    isLoadingStorages,
    isLoadingReturnConsignments,
    pageSize,
    previewOpened,
    previewRows,
    returnConsignments,
    returnConsignmentsError,
    searchDraft,
    selectedAvailabilities,
    selectedAvailabilityKeys,
    selectedActionToStorage,
    selectedStorageNetId,
    selectedReturnConsignment,
    storageOptions,
    toolbarLeft,
    toStorageOptions,
    canOpenPreview,
    changeActionMode,
    closeActionModal,
    closeStorageActions,
    handleExport,
    loadMore,
    openGroupAction,
    openPreview,
    reload,
    removePreviewRow,
    resetFilters,
    selectStorageNetId,
    setActionForm,
    setDownloadModalOpened,
    setPageSize,
    setPreviewOpened,
    submitAction,
    toggleAvailability,
    updatePreviewQty,
    updateSearch,
  } = model

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          {canOpenPreview && selectedAvailabilities.length > 0 ? (
            <Button leftSection={<IconEye size={16} />} variant="light" onClick={openPreview}>
              {t('Preview')} ({selectedAvailabilities.length})
            </Button>
          ) : null}
          <Tooltip label={t('Експорт')}>
            <ActionIcon
              aria-label={t('Експорт')}
              color="gray"
              disabled={!selectedStorageNetId}
              loading={isExporting}
              size={38}
              variant="light"
              onClick={handleExport}
            >
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading || isLoadingStorages}
              size={38}
              variant="light"
              onClick={() => {
                closeStorageActions()
                reload()
              }}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <Select
              searchable
              allowDeselect={false}
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0}
              label={t('Склад')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={selectedStorageNetId || null}
              w={300}
              onChange={(value) => selectStorageNetId(value || '')}
            />
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Код або назва товару')}
              value={searchDraft}
              style={{ flex: '1 1 240px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(error || (!isLoadingStorages && storageOptions.length === 0)) && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error || t('Складів не знайдено')}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Завантажено')} {availabilities.length}
              {selectedAvailabilities.length > 0 ? ` · ${t('Обрано')} ${selectedAvailabilities.length}` : ''}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={88}
                onChange={(value) => setPageSize(Number(value || 50))}
              />
              <Button
                color="gray"
                disabled={!hasMore || isLoading || isLoadingMore}
                loading={isLoadingMore}
                variant="light"
                onClick={loadMore}
              >
                {t('Завантажити ще')}
              </Button>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={availabilities}
            defaultLayout={PRODUCT_STORAGES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Товарів на складі не знайдено')}
            getRowId={(availability, index) =>
              String(availability.NetUid || `${getProductCode(availability)}-${getStorageName(availability)}-${index}`)
            }
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-storages-table-1"
            loadingText={t('Завантаження товарів складу')}
            maxHeight="calc(100vh - 320px)"
            minWidth={1180}
            rowClassName={(availability) =>
              selectedAvailabilityKeys.has(getAvailabilityKey(availability)) ? 'is-selected' : undefined
            }
            onRowClick={(availability) => toggleAvailability(availability)}
            tableId="product-storages"
            toolbarLeft={toolbarLeft}
          />
        </Stack>
      </Card>

      <ProductStoragePreviewDrawer
        opened={previewOpened}
        rows={previewRows}
        onClose={() => setPreviewOpened(false)}
        onProcess={openGroupAction}
        onRemoveRow={removePreviewRow}
        onUpdateQty={updatePreviewQty}
      />

      <ProductStorageActionModal
        actionError={actionError}
        effectiveToStorageNetUid={effectiveToStorageNetUid}
        form={actionForm}
        fromStorage={actionFromStorage}
        isLoadingReturnConsignments={isLoadingReturnConsignments}
        isAdmin={isAdmin}
        isSubmitting={isActionSubmitting}
        modal={actionModal}
        returnConsignments={returnConsignments}
        returnConsignmentsError={returnConsignmentsError}
        selectedReturnConsignment={selectedReturnConsignment}
        selectedToStorage={selectedActionToStorage}
        toStorageOptions={toStorageOptions}
        onChangeForm={setActionForm}
        onChangeMode={changeActionMode}
        onClose={closeActionModal}
        onSubmit={submitAction}
      />

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Експорт складу')}
        onClose={() => setDownloadModalOpened(false)}
      >
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor href={downloadDocument.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <IconFileTypeXls size={22} stroke={1.8} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor href={downloadDocument.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
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
    </Stack>
  )
}

function ProductStoragePreviewDrawer({
  opened,
  rows,
  onClose,
  onProcess,
  onRemoveRow,
  onUpdateQty,
}: {
  opened: boolean
  rows: ProductStorageActionRow[]
  onClose: () => void
  onProcess: () => void
  onRemoveRow: (availability: ProductStorageAvailability) => void
  onUpdateQty: (availability: ProductStorageAvailability, value: number | string) => void
}) {
  const { t } = useI18n()
  const hasInvalidRows = rows.some((row) => !isValidActionRow(row))
  const columns = useMemo<DataTableColumn<ProductStorageActionRow>[]>(
    () => [
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 150,
        minWidth: 130,
        accessor: (row) => getProductCode(row.availability),
        cell: (row) => <Text fw={700}>{displayValue(getProductCode(row.availability))}</Text>,
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 300,
        minWidth: 240,
        accessor: (row) => getProductName(row.availability),
        cell: (row) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(getProductName(row.availability))}
          </Text>
        ),
      },
      {
        id: 'placing',
        header: 'Розміщення',
        width: 260,
        minWidth: 200,
        accessor: (row) => formatPlacements(getPlacements(row.availability)),
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(formatPlacements(getPlacements(row.availability)))}
          </Text>
        ),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 200,
        minWidth: 160,
        accessor: (row) => getStorageName(row.availability),
        cell: (row) => displayValue(getStorageName(row.availability)),
      },
      {
        id: 'availableQty',
        header: 'Доступно',
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => getQuantity(row.availability),
        cell: (row) => formatAmount(getQuantity(row.availability)),
      },
      {
        id: 'changedQty',
        header: 'Кількість',
        width: 150,
        minWidth: 128,
        align: 'right',
        accessor: (row) => row.changedQty,
        cell: (row) => (
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            error={!isValidActionRow(row)}
            max={getQuantity(row.availability)}
            min={0.001}
            size="xs"
            value={row.changedQty}
            onClick={(event) => event.stopPropagation()}
            onChange={(value) => onUpdateQty(row.availability, value)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 60,
        minWidth: 60,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        cell: (row) => (
          <Tooltip label={t('Вилучити з Preview')}>
            <ActionIcon
              aria-label={t('Вилучити з Preview')}
              color="red"
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onRemoveRow(row.availability)
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [onRemoveRow, onUpdateQty, t],
  )

  return (
    <AppDrawer opened={opened} size="xl" title={`${t('Preview')} (${rows.length})`} onClose={onClose}>
      <Stack gap="md">
        {hasInvalidRows ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {t('Кількість має бути більшою за 0 і не перевищувати доступний залишок')}
          </Alert>
        ) : null}
        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={{
            columnPinning: {
              left: ['vendorCode', 'productName'],
              right: ['actions'],
            },
            density: 'normal',
          }}
          emptyText={t('Позиції не обрано')}
          getRowId={(row, index) => getAvailabilityKey(row.availability) || String(index)}
          layoutVersion="product-storages-preview-1"
          maxHeight="calc(100vh - 240px)"
          minWidth={1100}
          tableId="product-storages-preview"
        />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {t('Разом')} {formatAmount(sumActionRows(rows))}
          </Text>
          <Group gap="xs">
            <Button color="gray" variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button disabled={!rows.length || hasInvalidRows} leftSection={<IconCheck size={16} />} onClick={onProcess}>
              {t('Process')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </AppDrawer>
  )
}

function ProductStorageActionModal({
  actionError,
  effectiveToStorageNetUid,
  form,
  fromStorage,
  isAdmin,
  isLoadingReturnConsignments,
  isSubmitting,
  modal,
  returnConsignments,
  returnConsignmentsError,
  selectedReturnConsignment,
  selectedToStorage,
  toStorageOptions,
  onChangeForm,
  onChangeMode,
  onClose,
  onSubmit,
}: {
  actionError: string | null
  effectiveToStorageNetUid: string
  form: ProductStorageActionForm
  fromStorage: ProductStorageStorage | null
  isAdmin: boolean
  isLoadingReturnConsignments: boolean
  isSubmitting: boolean
  modal: ProductStorageActionModalState
  returnConsignments: ProductStorageAvailableConsignment[]
  returnConsignmentsError: string | null
  selectedReturnConsignment: ProductStorageAvailableConsignment | null
  selectedToStorage: ProductStorageStorage | null
  toStorageOptions: { label: string; value: string }[]
  onChangeForm: Dispatch<SetStateAction<ProductStorageActionForm>>
  onChangeMode: (mode: ProductStorageActionMode) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { t } = useI18n()

  if (!modal) {
    return null
  }

  const isSingle = modal.scope === 'single'
  const canUseManagement = modal.mode === 'return' || isAdmin
  const showQuantityField = isSingle
  const showPlacementFields = modal.mode === 'transfer' && isSingle && !selectedToStorage?.ForDefective
  const modeOptions = getActionModeOptions(modal.scope).map((option) => ({
    ...option,
    label: t(option.label),
  }))
  const returnConsignmentOptions = returnConsignments.map((consignment) => ({
    label: formatConsignmentOption(consignment),
    value: getConsignmentKey(consignment),
  }))

  return (
    <AppModal centered opened title={t(getActionTitle(modal))} size="xl" onClose={onClose}>
      <Stack gap="md">
        <SegmentedControl
          data={modeOptions}
          disabled={isSubmitting}
          value={modal.mode}
          onChange={(value) => onChangeMode(value as ProductStorageActionMode)}
        />

        <Group gap="xs">
          <Badge color="gray" variant="light">
            {t('Позицій')}: {modal.rows.length}
          </Badge>
          <Badge color="gray" variant="light">
            {t('Кількість')}: {formatAmount(sumActionRows(modal.rows))}
          </Badge>
          <Badge color="gray" variant="light">
            {t('Склад')}: {displayValue(fromStorage?.Name)}
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            disabled={isSubmitting}
            label={t('Дата')}
            type="date"
            value={form.fromDate}
            onChange={(event) => onChangeForm((current) => ({ ...current, fromDate: event.currentTarget.value }))}
          />
          <Switch
            checked={form.isManagement}
            disabled={isSubmitting || !canUseManagement}
            label={t('Управлінська операція')}
            mt={30}
            onChange={(event) => onChangeForm((current) => ({ ...current, isManagement: event.currentTarget.checked }))}
          />
        </SimpleGrid>

        {modal.mode === 'transfer' ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput disabled label={t('Зі складу')} value={fromStorage?.Name || ''} />
            <Select
              searchable
              allowDeselect={false}
              data={toStorageOptions}
              disabled={isSubmitting || toStorageOptions.length === 0}
              label={t('На склад')}
              placeholder={t('Оберіть склад')}
              value={effectiveToStorageNetUid || null}
              onChange={(value) => onChangeForm((current) => ({ ...current, toStorageNetUid: value || '' }))}
            />
          </SimpleGrid>
        ) : null}

        {showPlacementFields ? (
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput
              disabled={isSubmitting}
              label={t('Склад')}
              value={form.storageNumber}
              onChange={(event) => onChangeForm((current) => ({ ...current, storageNumber: event.currentTarget.value }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Ряд')}
              value={form.rowNumber}
              onChange={(event) => onChangeForm((current) => ({ ...current, rowNumber: event.currentTarget.value }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Полиця')}
              value={form.cellNumber}
              onChange={(event) => onChangeForm((current) => ({ ...current, cellNumber: event.currentTarget.value }))}
            />
          </SimpleGrid>
        ) : null}

        {modal.mode === 'return' ? (
          <Stack gap="sm">
            <Select
              searchable
              allowDeselect={false}
              data={returnConsignmentOptions}
              disabled={isSubmitting || isLoadingReturnConsignments || returnConsignmentOptions.length === 0}
              label={t('Прихід')}
              placeholder={isLoadingReturnConsignments ? t('Завантаження') : t('Оберіть прихід')}
              value={form.consignmentId || null}
              onChange={(value) => onChangeForm((current) => ({ ...current, consignmentId: value || '' }))}
            />
            {selectedReturnConsignment ? (
              <Group gap="xs">
                <Badge color="gray" variant="light">
                  {t('Постачальник')}: {displayValue(getClientName(selectedReturnConsignment.Supplier))}
                </Badge>
                <Badge color="gray" variant="light">
                  {t('Організація')}: {displayValue(selectedReturnConsignment.Organization?.FullName || selectedReturnConsignment.Organization?.Name)}
                </Badge>
              </Group>
            ) : null}
          </Stack>
        ) : null}

        {showQuantityField ? (
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            disabled={isSubmitting}
            label={t('Кількість')}
            max={getQuantity(modal.rows[0]?.availability)}
            min={0.001}
            value={form.qty}
            onChange={(value) => onChangeForm((current) => ({ ...current, qty: toNumberInputValue(value) }))}
          />
        ) : null}

        {modal.mode !== 'return' ? (
          <TextInput
            disabled={isSubmitting}
            label={t('Причина')}
            value={form.reason}
            onChange={(event) => onChangeForm((current) => ({ ...current, reason: event.currentTarget.value }))}
          />
        ) : null}

        <Textarea
          autosize
          disabled={isSubmitting}
          label={t('Коментар')}
          minRows={2}
          value={form.comment}
          onChange={(event) => onChangeForm((current) => ({ ...current, comment: event.currentTarget.value }))}
        />

        {(actionError || returnConsignmentsError) && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {actionError || returnConsignmentsError}
          </Alert>
        )}

        <Divider />
        <Group justify="flex-end">
          <Button color="gray" disabled={isSubmitting} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={getActionSubmitIcon(modal.mode)} loading={isSubmitting} onClick={onSubmit}>
            {t(getActionSubmitLabel(modal.mode))}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function useProductStoragesColumns({
  canOpenAction,
  isAllVisibleSelected,
  isSomeVisibleSelected,
  selectedAvailabilityKeys,
  onOpenAction,
  onToggleAvailability,
  onToggleVisible,
}: {
  canOpenAction: boolean
  isAllVisibleSelected: boolean
  isSomeVisibleSelected: boolean
  selectedAvailabilityKeys: Set<string>
  onOpenAction: (availability: ProductStorageAvailability) => void
  onToggleAvailability: (availability: ProductStorageAvailability, checked: boolean) => void
  onToggleVisible: (checked: boolean) => void
}): DataTableColumn<ProductStorageAvailability>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductStorageAvailability>[]>(
    () => [
      {
        id: 'select',
        header: (
          <Checkbox
            aria-label={t('Вибрати всі')}
            checked={isAllVisibleSelected}
            indeterminate={isSomeVisibleSelected}
            onChange={(event) => onToggleVisible(event.currentTarget.checked)}
          />
        ),
        width: 54,
        minWidth: 54,
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (availability) => (
          <Checkbox
            aria-label={t('Вибрати')}
            checked={selectedAvailabilityKeys.has(getAvailabilityKey(availability))}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToggleAvailability(availability, event.currentTarget.checked)}
          />
        ),
      },
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 160,
        minWidth: 132,
        accessor: getProductCode,
        cell: (availability) => <Text fw={700}>{displayValue(getProductCode(availability))}</Text>,
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 360,
        minWidth: 260,
        accessor: getProductName,
        cell: (availability) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(getProductName(availability))}
          </Text>
        ),
      },
      {
        id: 'placing',
        header: 'Розміщення',
        width: 320,
        minWidth: 220,
        accessor: (availability) => formatPlacements(getPlacements(availability)),
        cell: (availability) => (
          <Text size="sm" lineClamp={3}>
            {displayValue(formatPlacements(getPlacements(availability)))}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: 'Кількість',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: getQuantity,
        cell: (availability) => formatAmount(getQuantity(availability)),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 240,
        minWidth: 180,
        accessor: getStorageName,
        cell: (availability) => displayValue(getStorageName(availability)),
      },
      {
        id: 'actions',
        header: '',
        width: 72,
        minWidth: 72,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (availability) =>
          canOpenAction ? (
            <Tooltip label={t('Операція зі складської позиції')}>
              <ActionIcon
                aria-label={t('Операція зі складської позиції')}
                color="gray"
                size="sm"
                variant="light"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenAction(availability)
                }}
              >
                <IconArrowsExchange size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null,
      },
    ],
    [
      canOpenAction,
      isAllVisibleSelected,
      isSomeVisibleSelected,
      onOpenAction,
      onToggleAvailability,
      onToggleVisible,
      selectedAvailabilityKeys,
      t,
    ],
  )
}

function createActionForm(qty?: number): ProductStorageActionForm {
  return {
    cellNumber: '',
    comment: '',
    consignmentId: '',
    fromDate: formatLocalDate(new Date()),
    isManagement: false,
    qty: typeof qty === 'number' && Number.isFinite(qty) ? qty : '',
    reason: '',
    rowNumber: '',
    storageNumber: '',
    toStorageNetUid: '',
  }
}

function createActionRows(availabilities: ProductStorageAvailability[]): ProductStorageActionRow[] {
  return availabilities.map((availability) => ({
    availability,
    changedQty: getQuantity(availability) || 0,
  }))
}

function buildTransferItems(actionModal: NonNullable<ProductStorageActionModalState>, form: ProductStorageActionForm) {
  return actionModal.rows.map((row) => ({
    Product: getAvailabilityProduct(row.availability),
    Qty: getActionRowQty(actionModal, row, form),
    Reason: form.reason.trim(),
  }))
}

function buildWriteOffItems(actionModal: NonNullable<ProductStorageActionModalState>, form: ProductStorageActionForm) {
  return actionModal.rows.map((row) => ({
    Product: getAvailabilityProduct(row.availability),
    Qty: getActionRowQty(actionModal, row, form),
    Reason: form.reason.trim(),
  }))
}

function getActionRowQty(
  actionModal: NonNullable<ProductStorageActionModalState>,
  row: ProductStorageActionRow,
  form: ProductStorageActionForm,
): number {
  if (actionModal.scope === 'single') {
    return Number(form.qty)
  }

  return row.changedQty
}

function validateAction(
  actionModal: NonNullable<ProductStorageActionModalState>,
  form: ProductStorageActionForm,
  context: {
    fromStorage: ProductStorageStorage | null
    selectedConsignment: ProductStorageAvailableConsignment | null
    toStorageNetUid: string
    toStorageOptions: { label: string; value: string }[]
  },
): string | null {
  if (!context.fromStorage) {
    return 'Не вдалося визначити склад'
  }

  if (!form.fromDate) {
    return 'Вкажіть дату операції'
  }

  if (actionModal.scope === 'single') {
    const row = actionModal.rows[0]
    const qty = Number(form.qty)
    const availableQty = getQuantity(row?.availability)

    if (!Number.isFinite(qty) || qty <= 0) {
      return 'Кількість має бути більшою за 0'
    }

    if (typeof availableQty === 'number' && qty > availableQty) {
      return 'Кількість не може перевищувати доступний залишок'
    }
  } else if (!actionModal.rows.every(isValidActionRow)) {
    return 'Кількість має бути більшою за 0 і не перевищувати доступний залишок'
  }

  if (actionModal.mode === 'transfer') {
    if (!context.toStorageNetUid || !context.toStorageOptions.some((option) => option.value === context.toStorageNetUid)) {
      return 'Оберіть склад призначення'
    }
  }

  if (actionModal.mode === 'return' && !context.selectedConsignment) {
    return 'Оберіть прихід для повернення'
  }

  return null
}

function isValidActionRow(row: ProductStorageActionRow): boolean {
  const availableQty = getQuantity(row.availability)

  return row.changedQty > 0 && (typeof availableQty !== 'number' || row.changedQty <= availableQty)
}

function sumActionRows(rows: ProductStorageActionRow[]): number {
  return rows.reduce((total, row) => total + (Number.isFinite(row.changedQty) ? row.changedQty : 0), 0)
}

function getActionModeOptions(scope: ProductStorageActionScope) {
  if (scope === 'group') {
    return [
      { label: 'Переміщення', value: 'transfer' },
      { label: 'Списання', value: 'writeoff' },
    ]
  }

  return [
    { label: 'Переміщення', value: 'transfer' },
    { label: 'Повернення постачальнику', value: 'return' },
    { label: 'Списання', value: 'writeoff' },
  ]
}

function getActionTitle(actionModal: NonNullable<ProductStorageActionModalState>): string {
  if (actionModal.scope === 'group') {
    return 'Групова операція зі складом'
  }

  return 'Операція зі складською позицією'
}

function getActionSubmitLabel(mode: ProductStorageActionMode): string {
  if (mode === 'transfer') {
    return 'Перемістити'
  }

  if (mode === 'writeoff') {
    return 'Списати'
  }

  return 'Повернути'
}

function getActionSuccessMessage(mode: ProductStorageActionMode): string {
  if (mode === 'transfer') {
    return 'Переміщення створено'
  }

  if (mode === 'writeoff') {
    return 'Списання створено'
  }

  return 'Повернення створено'
}

function getActionSubmitIcon(mode: ProductStorageActionMode) {
  if (mode === 'transfer') {
    return <IconArrowsExchange size={16} />
  }

  if (mode === 'writeoff') {
    return <IconClipboardList size={16} />
  }

  return <IconCheck size={16} />
}

function toNumberInputValue(value: number | string): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : ''
}

function buildStorageOptions(storages: ProductStorageStorage[]): { label: string; value: string }[] {
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

function buildToStorageOptions(
  storages: ProductStorageStorage[],
  fromStorage: ProductStorageStorage | null,
  isManagement: boolean,
): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (!storage.NetUid || isSameStorage(storage, fromStorage)) {
      return options
    }

    if (!isManagement && fromStorage?.OrganizationId && storage.OrganizationId !== fromStorage.OrganizationId) {
      return options
    }

    options.push({
      label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : ''].filter(Boolean).join(' '),
      value: storage.NetUid,
    })

    return options
  }, [])
}

function isSameStorage(firstStorage?: ProductStorageStorage | null, secondStorage?: ProductStorageStorage | null): boolean {
  if (!firstStorage || !secondStorage) {
    return false
  }

  if (firstStorage.NetUid && secondStorage.NetUid) {
    return firstStorage.NetUid === secondStorage.NetUid
  }

  return Boolean(firstStorage.Id && secondStorage.Id && firstStorage.Id === secondStorage.Id)
}

function resolveStorage(
  selectedStorage: ProductStorageStorage | null,
  availability?: ProductStorageAvailability,
): ProductStorageStorage | null {
  return availability?.Storage || selectedStorage || null
}

function getAvailabilityKey(availability?: ProductStorageAvailability): string {
  if (!availability) {
    return ''
  }

  if (availability.NetUid) {
    return availability.NetUid
  }

  return [
    availability.ProductNetUid || availability.Product?.NetUid || availability.ProductId,
    availability.StorageNetUid || availability.Storage?.NetUid || availability.StorageId,
    getProductCode(availability),
  ]
    .filter(Boolean)
    .join(':')
}

function getProductNetUid(availability?: ProductStorageAvailability): string {
  return availability?.Product?.NetUid || availability?.ProductNetUid || ''
}

function getStorageNetUid(availability?: ProductStorageAvailability): string {
  return availability?.Storage?.NetUid || availability?.StorageNetUid || ''
}

function getAvailabilityProduct(availability?: ProductStorageAvailability): ProductStorageProduct | undefined {
  if (!availability) {
    return undefined
  }

  return availability.Product || {
    Id: availability.ProductId,
    Name: availability.ProductName,
    NetUid: availability.ProductNetUid,
    VendorCode: availability.VendorCode,
  }
}

function getConsignmentKey(consignment?: ProductStorageAvailableConsignment): string {
  if (!consignment) {
    return ''
  }

  return String(consignment.ConsignmentItemId || `${consignment.ProductIncomeNumber || ''}:${consignment.FromDate || ''}`)
}

function formatConsignmentOption(consignment: ProductStorageAvailableConsignment): string {
  const parts = [
    formatDate(consignment.FromDate),
    consignment.ProductIncomeNumber,
    getClientName(consignment.Supplier),
    formatAmount(consignment.RemainingQty),
  ].filter(Boolean)

  return parts.join(' · ')
}

function getClientName(client?: { FullName?: string; Name?: string; SupplierName?: string } | null): string {
  return client?.FullName || client?.SupplierName || client?.Name || ''
}

function getProductCode(availability: ProductStorageAvailability): string | undefined {
  return availability.Product?.VendorCode || availability.VendorCode
}

function getProductName(availability: ProductStorageAvailability): string | undefined {
  return availability.Product?.Name || availability.ProductName
}

function getStorageName(availability: ProductStorageAvailability): string | undefined {
  return availability.Storage?.Name || availability.StorageName
}

function getQuantity(availability: ProductStorageAvailability): number | undefined {
  return availability.Amount ?? availability.Qty
}

function getPlacements(availability: ProductStorageAvailability): ProductStoragePlacement[] {
  return availability.Product?.ProductPlacements?.length
    ? availability.Product.ProductPlacements
    : availability.Placements || []
}

function formatPlacements(placements: ProductStoragePlacement[]): string {
  const formattedPlacements = placements.reduce<string[]>((values, placement) => {
    const value = formatPlacement(placement)

    if (value) {
      values.push(value)
    }

    return values
  }, [])

  return formattedPlacements.join(', ')
}

function formatPlacement(placement: ProductStoragePlacement): string {
  const address = [placement.StorageNumber, placement.RowNumber, placement.CellNumber].filter(Boolean).join('-')
  const qty = formatAmount(placement.Qty)

  if (!address && qty === '-') {
    return ''
  }

  if (!address) {
    return `${translate('Кількість')} ${qty}`
  }

  return `${translate('Позиція')} ${address}. ${translate('Кількість')} ${qty}`
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function formatDate(value?: string | Date): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
