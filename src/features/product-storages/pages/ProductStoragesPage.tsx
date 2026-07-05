import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
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
import { useDebouncedValue } from '@mantine/hooks'
import { useCallback, useEffect, useMemo, useReducer, useRef, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { UserRoleType } from '../../../shared/auth/types'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../auth/useAuth'
import '../../online-shop-seo/pages/online-shop-seo-page.css'
import './product-storages.css'
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

const PRODUCT_STORAGES_ROSTER_TEMPLATE =
  '54px 56px minmax(132px, 0.7fr) minmax(260px, 1.7fr) minmax(220px, 1.3fr) 120px minmax(180px, 0.9fr) 64px'

const pageSizeOptions = ['50', '100', '150']
const PRODUCT_STORAGES_SEARCH_DEBOUNCE_MS = 200
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

type AvailabilityListState = {
  hasMore: boolean
  items: ProductStorageAvailability[]
  total: number
}

function useProductStoragesPageModel() {
  const { t } = useI18n()
  const { hasPermission, user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const [availabilityList, setAvailabilityList] = useValueState<AvailabilityListState>({
    hasMore: false,
    items: [],
    total: 0,
  })
  const [storages, setStorages] = useValueState<ProductStorageStorage[]>([])
  const [selectedStorageNetId, setSelectedStorageNetId] = useValueState('')
  const [selectedAvailabilities, setSelectedAvailabilities] = useValueState<ProductStorageAvailability[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [debouncedSearchDraft] = useDebouncedValue(searchDraft, PRODUCT_STORAGES_SEARCH_DEBOUNCE_MS)
  const searchValue = debouncedSearchDraft.trim()
  const [fromDate, setFromDate] = useValueState(() => formatLocalDate(new Date()))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [pageSize, setPageSize] = useValueState(50)
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
  const listRequestKey = `${selectedStorageNetId}|${fromDate}|${toDate}|${searchValue}|${pageSize}`
  const exportScopeKey = `${selectedStorageNetId}|${fromDate}|${toDate}`
  const listRequestKeyRef = useRef(listRequestKey)
  const exportScopeKeyRef = useRef(exportScopeKey)
  const exportRequestRef = useRef(0)
  const filterError = getDateRangeError(fromDate, toDate)
  const availabilities = availabilityList.items
  const hasMore = availabilityList.hasMore
  const totalAvailabilities = availabilityList.total
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
  const availabilityIndexMap = useMemo(() => buildAvailabilityIndexMap(availabilities), [availabilities])
  const columns = useProductStoragesColumns({
    availabilityIndexMap,
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
    () =>
      buildToStorageOptions(storages, actionFromStorage, {
        isPrivilegedUser: isAdmin,
        isManagement: actionForm.isManagement,
        scope: actionModal?.scope || 'single',
      }),
    [actionForm.isManagement, actionFromStorage, actionModal?.scope, isAdmin, storages],
  )
  const effectiveToStorageNetUid = toStorageOptions.some((option) => option.value === actionForm.toStorageNetUid)
    ? actionForm.toStorageNetUid
    : toStorageOptions[0]?.value || ''
  const selectedActionToStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === effectiveToStorageNetUid) || null,
    [effectiveToStorageNetUid, storages],
  )
  const availableReturnConsignments = useMemo(
    () => returnConsignmentsState.items.filter(hasReturnConsignmentItemId),
    [returnConsignmentsState.items],
  )
  const selectedReturnConsignment = useMemo(
    () => availableReturnConsignments.find((consignment) => getConsignmentKey(consignment) === actionForm.consignmentId) || null,
    [actionForm.consignmentId, availableReturnConsignments],
  )
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Завантажено')} {availabilities.length}
        {totalAvailabilities > availabilities.length ? ` ${t('з')} ${totalAvailabilities}` : ''}
        {selectedAvailabilities.length ? `, ${t('обрано')}: ${selectedAvailabilities.length}` : ''}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [availabilities.length, searchValue, selectedAvailabilities.length, t, totalAvailabilities],
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
    exportScopeKeyRef.current = exportScopeKey
  }, [exportScopeKey])

  const resetAvailabilityLoad = useCallback(() => {
    setAvailabilityList({ hasMore: false, items: [], total: 0 })
    setLoading(false)
    setLoadingMore(false)
  }, [setAvailabilityList, setLoading, setLoadingMore])

  const startAvailabilityLoad = useCallback(() => {
    setLoading(true)
    setError(null)
  }, [setError, setLoading])

  const completeAvailabilityLoad = useCallback(
    (result: { items: ProductStorageAvailability[]; totalQty: number }) => {
      setAvailabilityList({
        hasMore: result.items.length < result.totalQty && result.items.length > 0,
        items: result.items,
        total: result.totalQty,
      })
      setLoading(false)
    },
    [setAvailabilityList, setLoading],
  )

  const failAvailabilityLoad = useCallback(
    (loadError: unknown) => {
      setAvailabilityList({ hasMore: false, items: [], total: 0 })
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари складу'))
      setLoading(false)
    },
    [setError, setAvailabilityList, setLoading, t],
  )

  useEffect(() => {
    if (!selectedStorageNetId || filterError) {
      resetAvailabilityLoad()
      return
    }

    let cancelled = false

    async function loadAvailabilities() {
      startAvailabilityLoad()

      try {
        const result = await getAvailableProductsByStorage({
          from: fromDate,
          limit: pageSize,
          offset: 0,
          storageNetId: selectedStorageNetId,
          to: toDate,
          value: searchValue,
        })

        if (!cancelled) {
          completeAvailabilityLoad(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          failAvailabilityLoad(loadError)
        }
      }
    }

    void loadAvailabilities()

    return () => {
      cancelled = true
    }
  }, [
    fromDate,
    filterError,
    pageSize,
    reloadKey,
    completeAvailabilityLoad,
    failAvailabilityLoad,
    resetAvailabilityLoad,
    searchValue,
    selectedStorageNetId,
    startAvailabilityLoad,
    toDate,
  ])

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
            const nextAvailableConsignments = nextConsignments.filter(hasReturnConsignmentItemId)

            if (currentForm.consignmentId && nextAvailableConsignments.some((consignment) => getConsignmentKey(consignment) === currentForm.consignmentId)) {
              return currentForm
            }

            return {
              ...currentForm,
              consignmentId: getConsignmentKey(nextAvailableConsignments[0]) || '',
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
    if (searchDraft !== nextValue) {
      closeStorageActions()
    }

    setSearchDraft(nextValue)
  }

  function updateFromDate(nextFromDate: string) {
    if (fromDate !== nextFromDate) {
      closeStorageActions()
    }

    setFromDate(nextFromDate)
  }

  function updateToDate(nextToDate: string) {
    if (toDate !== nextToDate) {
      closeStorageActions()
    }

    setToDate(nextToDate)
  }

  function updatePageSize(nextPageSize: number) {
    if (pageSize !== nextPageSize) {
      closeStorageActions()
    }

    setPageSize(nextPageSize)
  }

  function resetFilters() {
    closeStorageActions()
    setSearchDraft('')
    setFromDate(formatLocalDate(new Date()))
    setToDate(formatLocalDate(new Date()))
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
    if (!canOpenPreview) {
      return
    }

    if (filterError) {
      setActionError(t(filterError))
      return
    }

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
    if (!canOpenAction) {
      setActionError(t('Недостатньо прав для операції зі складською позицією'))
      return
    }

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
    if (!canOpenPreview) {
      setActionError(t('Недостатньо прав для Preview'))
      return
    }

    if (!canOpenAction) {
      setActionError(t('Недостатньо прав для операції зі складською позицією'))
      return
    }

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
    if (!actionModal || isActionSubmitting) {
      return
    }

    if (!canOpenAction) {
      setActionError(t('Недостатньо прав для операції зі складською позицією'))
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
            Organization:
              actionModal.scope === 'single'
                ? selectedToStorage.Organization || null
                : fromStorage.Organization || null,
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
          IsManagement: actionForm.isManagement && isAdmin,
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
    if (!selectedStorageNetId || filterError || isLoadingMore) {
      return
    }

    const requestKey = listRequestKeyRef.current
    const requestOffset = availabilities.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getAvailableProductsByStorage({
        from: fromDate,
        limit: pageSize,
        offset: requestOffset,
        storageNetId: selectedStorageNetId,
        to: toDate,
        value: searchValue,
      })

      if (listRequestKeyRef.current === requestKey) {
        setAvailabilityList((currentList) => {
          if (currentList.items.length !== requestOffset) {
            return currentList
          }

          const nextItems = [...currentList.items, ...result.items]

          return {
            hasMore: nextItems.length < result.totalQty && result.items.length > 0,
            items: nextItems,
            total: result.totalQty,
          }
        })
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
    if (!selectedStorageNetId || filterError || isExporting) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const requestKey = exportScopeKeyRef.current
    const isLatestExport = () => exportRequestRef.current === requestId
    const isCurrentExport = () => isLatestExport() && exportScopeKeyRef.current === requestKey

    setExporting(true)
    setError(null)

    try {
      const document = await exportProductStorageAvailability({
        from: fromDate,
        storageNetId: selectedStorageNetId,
        to: toDate,
      })

      if (isCurrentExport()) {
        setDownloadDocument(document)
        setDownloadModalOpened(true)
      }
    } catch (exportError) {
      if (isCurrentExport()) {
        setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт складу'))
      }
    } finally {
      if (isLatestExport()) {
        setExporting(false)
      }
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
    filterError,
    fromDate,
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
    returnConsignments: availableReturnConsignments,
    returnConsignmentsError: returnConsignmentsState.error,
    searchDraft,
    selectedAvailabilities,
    selectedAvailabilityKeys,
    selectedActionToStorage,
    selectedStorageNetId,
    selectedReturnConsignment,
    storageOptions,
    toDate,
    toolbarLeft,
    toStorageOptions,
    canOpenPreview,
    canOpenAction,
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
    setPreviewOpened,
    submitAction,
    toggleAvailability,
    updateFromDate,
    updatePageSize,
    updatePreviewQty,
    updateSearch,
    updateToDate,
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
    filterError,
    fromDate,
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
    toDate,
    toolbarLeft,
    toStorageOptions,
    canOpenAction,
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
    setPreviewOpened,
    submitAction,
    toggleAvailability,
    updateFromDate,
    updatePageSize,
    updatePreviewQty,
    updateSearch,
    updateToDate,
  } = model

  return (
    <Stack gap="lg">
      {canOpenPreview && selectedAvailabilities.length > 0 ? (
        <Group justify="flex-end" align="end">
          <Button disabled={Boolean(filterError)} leftSection={<IconEye size={16} />} variant="light" onClick={openPreview}>
            {t('Preview')} ({selectedAvailabilities.length})
          </Button>
        </Group>
      ) : null}

      <Card className="app-data-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-storages-filter-bar">
          <Group align="end" gap="sm" wrap="nowrap" className="product-storages-filter-row">
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
              label={t('Від якої дати')}
              max={toDate || undefined}
              type="date"
              value={fromDate}
              onChange={(event) => updateFromDate(event.currentTarget.value)}
            />
            <TextInput
              label={t('До якої дати')}
              min={fromDate || undefined}
              type="date"
              value={toDate}
              onChange={(event) => updateToDate(event.currentTarget.value)}
            />
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Код або назва товару')}
              value={searchDraft}
              style={{ flex: '1 1 240px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Експорт')}>
                <ActionIcon
                  aria-label={t('Експорт')}
                  color="gray"
                  disabled={!selectedStorageNetId || Boolean(filterError) || isExporting}
                  loading={isExporting}
                  size={34}
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
                  size={34}
                  variant="light"
                  onClick={() => {
                    closeStorageActions()
                    reload()
                  }}
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
            </div>
          </Group>
        </div>

        <Stack gap={10} className="product-storages-body">
          {(filterError || error || (!isLoadingStorages && storageOptions.length === 0)) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError ? t(filterError) : error || t('Складів не знайдено')}
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
                onChange={(value) => updatePageSize(Number(value || 50))}
              />
              <Button
                color="gray"
                disabled={Boolean(filterError) || !hasMore || isLoading || isLoadingMore}
                loading={isLoadingMore}
                variant="light"
                onClick={loadMore}
              >
                {t('Завантажити ще')}
              </Button>
            </Group>
          </Group>

          {toolbarLeft}

          <StoragesRosterTable
            columns={columns}
            columnsTemplate={PRODUCT_STORAGES_ROSTER_TEMPLATE}
            data={availabilities}
            emptyText={t('Товарів на складі не знайдено')}
            getRowClassName={(availability) =>
              selectedAvailabilityKeys.has(getAvailabilityKey(availability)) ? 'is-selected' : undefined
            }
            getRowId={(availability, index) => getAvailabilityKey(availability) || String(index)}
            isLoading={isLoading || isLoadingStorages}
            loadingText={t('Завантаження товарів складу')}
            maxHeight="calc(100vh - 320px)"
            minWidth={1180}
            onRowClick={(availability) => toggleAvailability(availability)}
          />
        </Stack>
      </Card>

      <ProductStoragePreviewDrawer
        canProcess={canOpenAction}
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
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.DocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  <span className="document-link-badge document-link-badge-excel">
                    <IconFileTypeXls size={22} stroke={1.8} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.PdfDocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
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
  canProcess,
  opened,
  rows,
  onClose,
  onProcess,
  onRemoveRow,
  onUpdateQty,
}: {
  canProcess: boolean
  opened: boolean
  rows: ProductStorageActionRow[]
  onClose: () => void
  onProcess: () => void
  onRemoveRow: (availability: ProductStorageAvailability) => void
  onUpdateQty: (availability: ProductStorageAvailability, value: number | string) => void
}) {
  const { t } = useI18n()
  const hasInvalidRows = rows.some((row) => !isValidActionRow(row))
  const rowIndexMap = useMemo(
    () =>
      rows.reduce((indexMap, row, index) => {
        indexMap.set(row, index + 1)

        return indexMap
      }, new Map<ProductStorageActionRow, number>()),
    [rows],
  )
  const columns = useMemo<DataTableColumn<ProductStorageActionRow>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        accessor: (row) => rowIndexMap.get(row) || 0,
        cell: (row) => (
          <Text c="dimmed" size="sm">
            {rowIndexMap.get(row) || ''}
          </Text>
        ),
      },
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
    [onRemoveRow, onUpdateQty, rowIndexMap, t],
  )

  return (
    <AppDrawer opened={opened} size="xl" title={`${t('Preview')} (${rows.length})`} onClose={onClose}>
      <Stack gap="md">
        {hasInvalidRows ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {t('Кількість має бути більшою за 0 і не перевищувати доступний залишок')}
          </Alert>
        ) : null}
        {!canProcess ? (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {t('Недостатньо прав для операції зі складською позицією')}
          </Alert>
        ) : null}
        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={{
            columnPinning: {
              left: ['index', 'vendorCode', 'productName'],
              right: ['actions'],
            },
            density: 'normal',
          }}
          emptyText={t('Позиції не обрано')}
          getRowId={(row, index) => getAvailabilityKey(row.availability) || String(index)}
          layoutVersion="product-storages-preview-2"
          maxHeight="calc(100vh - 240px)"
          minWidth={1160}
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
            <Button disabled={!canProcess || !rows.length || hasInvalidRows} leftSection={<IconCheck size={16} />} onClick={onProcess}>
              {t('Виконати')}
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
  const showManagementSwitch = isAdmin
  const showQuantityField = isSingle
  const showPlacementFields = modal.mode === 'transfer' && isSingle && Boolean(selectedToStorage) && !selectedToStorage?.ForDefective
  const modeOptions = getActionModeOptions(modal.scope).map((option) => ({
    ...option,
    label: t(option.label),
  }))
  const singleAvailableQty = getQuantity(modal.rows[0]?.availability)
  const singleMaxQty =
    modal.mode === 'return'
      ? getReturnMaxQty(singleAvailableQty, selectedReturnConsignment)
      : singleAvailableQty
  const displayedQty = isSingle ? Number(form.qty) : sumActionRows(modal.rows)
  const footer = (
    <Group className="product-storages-action-footer" justify="flex-end">
      <Button disabled={isSubmitting} variant="default" onClick={onClose}>
        {t('Скасувати')}
      </Button>
      <Button
        color={CREATE_ACTION_COLOR}
        disabled={isSubmitting}
        leftSection={getActionSubmitIcon(modal.mode)}
        loading={isSubmitting}
        onClick={onSubmit}
      >
        {t(getActionSubmitLabel(modal.mode))}
      </Button>
    </Group>
  )

  return (
    <AppDrawer
      className="app-form-sheet product-storages-action-sheet"
      closeOnClickOutside={false}
      footer={footer}
      opened
      size="standard"
      title={<span className="product-storages-action-sheet-title">{t(getActionTitle(modal))}</span>}
      onClose={() => {
        if (!isSubmitting) {
          onClose()
        }
      }}
    >
      <Stack className="product-storages-action-content" gap="md">
        <SegmentedControl
          className="product-storages-action-mode"
          data={modeOptions}
          disabled={isSubmitting}
          value={modal.mode}
          onChange={(value) => onChangeMode(value as ProductStorageActionMode)}
        />

        <div className="product-storages-action-summary">
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Позицій')}: {modal.rows.length}
          </Badge>
          <Badge className="app-role-pill is-orange" variant="light">
            {t('Кількість')}: {formatAmount(Number.isFinite(displayedQty) ? displayedQty : 0)}
          </Badge>
          <Badge className="app-role-pill is-gray product-storages-action-storage-pill" variant="light">
            {t('Склад')}: {displayValue(fromStorage?.Name)}
          </Badge>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            disabled={isSubmitting}
            label={t('Дата')}
            type="date"
            value={form.fromDate}
            onChange={(event) => { const nextValue = event.currentTarget.value; onChangeForm((current) => ({ ...current, fromDate: nextValue })) }}
          />
          {showManagementSwitch ? (
            <Switch
              checked={form.isManagement}
              color={CREATE_ACTION_COLOR}
              disabled={isSubmitting}
              label={t('Управлінська операція')}
              mt={30}
              onChange={(event) => { const nextValue = event.currentTarget.checked; onChangeForm((current) => ({ ...current, isManagement: nextValue })) }}
            />
          ) : null}
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
              onChange={(event) => { const nextValue = event.currentTarget.value; onChangeForm((current) => ({ ...current, storageNumber: nextValue })) }}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Ряд')}
              value={form.rowNumber}
              onChange={(event) => { const nextValue = event.currentTarget.value; onChangeForm((current) => ({ ...current, rowNumber: nextValue })) }}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Полиця')}
              value={form.cellNumber}
              onChange={(event) => { const nextValue = event.currentTarget.value; onChangeForm((current) => ({ ...current, cellNumber: nextValue })) }}
            />
          </SimpleGrid>
        ) : null}

        {modal.mode === 'return' ? (
          <ReturnConsignmentsPanel
            disabled={isSubmitting}
            isLoading={isLoadingReturnConsignments}
            returnConsignments={returnConsignments}
            selectedConsignmentId={form.consignmentId}
            selectedReturnConsignment={selectedReturnConsignment}
            onSelect={(consignmentId) => onChangeForm((current) => ({ ...current, consignmentId }))}
          />
        ) : null}

        {showQuantityField ? (
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            disabled={isSubmitting}
            label={t('Кількість')}
            max={singleMaxQty}
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
            onChange={(event) => { const nextValue = event.currentTarget.value; onChangeForm((current) => ({ ...current, reason: nextValue })) }}
          />
        ) : null}

        <Textarea
          autosize
          disabled={isSubmitting}
          label={t('Коментар')}
          minRows={2}
          value={form.comment}
          onChange={(event) => { const nextValue = event.currentTarget.value; onChangeForm((current) => ({ ...current, comment: nextValue })) }}
        />

        {(actionError || returnConsignmentsError) && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {actionError || returnConsignmentsError}
          </Alert>
        )}
      </Stack>
    </AppDrawer>
  )
}

function ReturnConsignmentsPanel({
  disabled,
  isLoading,
  returnConsignments,
  selectedConsignmentId,
  selectedReturnConsignment,
  onSelect,
}: {
  disabled: boolean
  isLoading: boolean
  returnConsignments: ProductStorageAvailableConsignment[]
  selectedConsignmentId: string
  selectedReturnConsignment: ProductStorageAvailableConsignment | null
  onSelect: (consignmentId: string) => void
}) {
  const { t } = useI18n()
  const [searchValue, setSearchValue] = useValueState('')
  const normalizedSearchValue = normalizeReturnConsignmentSearchValue(searchValue)
  const visibleConsignments = useMemo(
    () => returnConsignments.filter((consignment) => matchesReturnConsignmentSearch(consignment, normalizedSearchValue)),
    [normalizedSearchValue, returnConsignments],
  )
  const countLabel = normalizedSearchValue
    ? `${visibleConsignments.length}/${returnConsignments.length}`
    : String(returnConsignments.length)

  return (
    <Stack className="product-storages-return-panel" gap="sm">
      <Group align="center" justify="space-between" gap="sm">
        <Text className="app-section-title product-storages-return-title" fw={600} size="sm">
          {t('Прихід')}
        </Text>
        <span className="app-role-pill is-orange product-storages-return-count">
          {countLabel}
        </span>
      </Group>

      <TextInput
        className="product-storages-return-search"
        disabled={isLoading || returnConsignments.length === 0}
        leftSection={<IconSearch size={14} />}
        placeholder={t('Пошук по приходу, даті або постачальнику')}
        value={searchValue}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />

      {isLoading ? (
        <Group className="product-storages-return-empty" gap="xs">
          <Loader size="sm" />
          <Text size="sm">{t('Завантаження приходів')}</Text>
        </Group>
      ) : visibleConsignments.length > 0 ? (
        <ScrollArea.Autosize className="product-storages-return-list" mah={190} type="auto">
          {visibleConsignments.map((consignment, index) => {
            const consignmentId = getConsignmentKey(consignment)
            const isSelected = consignmentId === selectedConsignmentId

            return (
              <button
                className={`product-storages-return-option${isSelected ? ' is-selected' : ''}`}
                disabled={disabled}
                key={consignmentId || index}
                type="button"
                onClick={() => onSelect(consignmentId)}
              >
                <span className="product-storages-return-option-main">
                  <span className="product-storages-return-option-number">
                    {formatDate(consignment.FromDate)} {displayValue(consignment.ProductIncomeNumber)}
                  </span>
                  <span className="product-storages-return-option-meta">
                    {displayValue(getClientName(consignment.Supplier))}
                  </span>
                </span>
                <span className="app-role-pill is-gray product-storages-return-qty">
                  {formatAmount(consignment.RemainingQty)}
                </span>
              </button>
            )
          })}
        </ScrollArea.Autosize>
      ) : (
        <Text className="product-storages-return-empty" size="sm">
          {returnConsignments.length > 0
            ? t('За пошуком приходів не знайдено')
            : t('Доступних приходів для повернення не знайдено')}
        </Text>
      )}

      {selectedReturnConsignment ? (
        <div className="product-storages-return-details">
          <ReturnConsignmentDetail label={t('Постачальник')} value={getClientName(selectedReturnConsignment.Supplier)} />
          <ReturnConsignmentDetail
            label={t('Організація')}
            value={selectedReturnConsignment.Organization?.FullName || selectedReturnConsignment.Organization?.Name}
          />
          <ReturnConsignmentDetail label={t('Доступно по партії')} value={formatAmount(selectedReturnConsignment.RemainingQty)} />
        </div>
      ) : null}
    </Stack>
  )
}

function ReturnConsignmentDetail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="product-storages-return-detail">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  )
}

function useProductStoragesColumns({
  availabilityIndexMap,
  canOpenAction,
  isAllVisibleSelected,
  isSomeVisibleSelected,
  selectedAvailabilityKeys,
  onOpenAction,
  onToggleAvailability,
  onToggleVisible,
}: {
  availabilityIndexMap: Map<ProductStorageAvailability, number>
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
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        accessor: (availability) => availabilityIndexMap.get(availability) || 0,
        cell: (availability) => (
          <Text c="dimmed" size="sm">
            {availabilityIndexMap.get(availability) || ''}
          </Text>
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
        width: 64,
        minWidth: 56,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (availability) => {
          return (
            <Group className="seo-table-action-cell" gap={4} justify="center" wrap="nowrap">
              {canOpenAction ? (
                <Tooltip label={t('Операція зі складської позиції')}>
                  <ActionIcon
                    aria-label={t('Операція зі складської позиції')}
                    color="gray"
                    size={34}
                    variant="light"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenAction(availability)
                    }}
                  >
                    <IconClipboardList size={20} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Group>
          )
        },
      },
    ],
    [
      availabilityIndexMap,
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

function getRosterCellAlignStyle(align?: 'left' | 'center' | 'right'): CSSProperties | undefined {
  if (align === 'right') {
    return { justifySelf: 'end', textAlign: 'right' }
  }

  if (align === 'center') {
    return { justifySelf: 'center', textAlign: 'center' }
  }

  return undefined
}

function isRosterActionCellEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.seo-table-action-cell'))
}

function StoragesRosterTable<TData>({
  columns,
  columnsTemplate,
  data,
  emptyText,
  getRowClassName,
  getRowId,
  isLoading,
  loadingText,
  maxHeight,
  minWidth,
  onRowClick,
}: {
  columns: DataTableColumn<TData>[]
  columnsTemplate: string
  data: TData[]
  emptyText: ReactNode
  getRowClassName?: (row: TData, index: number) => string | undefined
  getRowId: (row: TData, index: number) => string
  isLoading?: boolean
  loadingText: ReactNode
  maxHeight: string
  minWidth: number
  onRowClick?: (row: TData) => void
}) {
  const tableStyle = {
    '--seo-roster-columns': columnsTemplate,
    '--seo-roster-min-width': `${minWidth}px`,
  } as CSSProperties

  return (
    <div className="seo-roster-table product-storages-roster" style={tableStyle}>
      <ScrollArea.Autosize mah={maxHeight} type="auto">
        <div className="seo-roster-head">
          {columns.map((column) => (
            <span
              className={`seo-roster-head-cell is-${column.id}`}
              key={column.id}
              style={getRosterCellAlignStyle(column.align)}
            >
              {column.header}
            </span>
          ))}
        </div>

        <div className="seo-roster-body">
          {isLoading ? (
            <div className="seo-roster-empty">
              <Group gap="xs">
                <Loader size="sm" />
                <span>{loadingText}</span>
              </Group>
            </div>
          ) : data.length ? (
            data.map((row, index) => {
              const rowId = getRowId(row, index)
              const rowClassNames = ['seo-roster-row', 'is-clickable', getRowClassName?.(row, index)]
                .filter(Boolean)
                .join(' ')

              return (
                <div className="seo-roster-row-frame" key={rowId}>
                  <div
                    className={rowClassNames}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      if (isRosterActionCellEventTarget(event.target)) {
                        return
                      }

                      onRowClick?.(row)
                    }}
                    onKeyDown={(event) => {
                      if (isRosterActionCellEventTarget(event.target)) {
                        return
                      }

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onRowClick?.(row)
                      }
                    }}
                  >
                    {columns.map((column) => (
                      <div
                        className={`seo-roster-cell is-${column.id}`}
                        key={column.id}
                        style={getRosterCellAlignStyle(column.align)}
                      >
                        {column.cell ? column.cell(row) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="seo-roster-empty">{emptyText}</div>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  )
}

function buildAvailabilityIndexMap(
  availabilities: ProductStorageAvailability[],
): Map<ProductStorageAvailability, number> {
  return availabilities.reduce((indexMap, availability, index) => {
    indexMap.set(availability, index + 1)

    return indexMap
  }, new Map<ProductStorageAvailability, number>())
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

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
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

  if (!isValidDateInputValue(form.fromDate)) {
    return 'Вкажіть коректну дату операції'
  }

  if (actionModal.scope === 'single') {
    const row = actionModal.rows[0]
    const qty = Number(form.qty)
    const availableQty = getQuantity(row?.availability)
    const maxQty =
      actionModal.mode === 'return'
        ? getReturnMaxQty(availableQty, context.selectedConsignment)
        : availableQty

    if (!Number.isFinite(qty) || qty <= 0) {
      return 'Кількість має бути більшою за 0'
    }

    if (typeof maxQty === 'number' && qty > maxQty) {
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

  if (actionModal.mode === 'return') {
    if (!context.selectedConsignment) {
      return 'Оберіть прихід для повернення'
    }

    if (!context.selectedConsignment.ConsignmentItemId) {
      return 'Обрана партія не має ConsignmentItemId'
    }
  }

  return null
}

function isValidActionRow(row: ProductStorageActionRow): boolean {
  const availableQty = getQuantity(row.availability)

  return row.changedQty > 0 && (typeof availableQty !== 'number' || row.changedQty <= availableQty)
}

function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}

function getReturnMaxQty(
  availableQty: number | undefined,
  selectedConsignment: ProductStorageAvailableConsignment | null,
): number | undefined {
  const remainingQty = selectedConsignment?.RemainingQty

  if (typeof availableQty === 'number' && typeof remainingQty === 'number') {
    return Math.min(availableQty, remainingQty)
  }

  return typeof remainingQty === 'number' ? remainingQty : availableQty
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
        label: storage.Organization?.Name
          ? `${storage.Name} (${storage.Organization.Name})`
          : storage.Name || translate('Без назви'),
        value: storage.NetUid,
      })
    }

    return options
  }, [])
}

function buildToStorageOptions(
  storages: ProductStorageStorage[],
  fromStorage: ProductStorageStorage | null,
  actionOptions: {
    isManagement: boolean
    isPrivilegedUser: boolean
    scope: ProductStorageActionScope
  },
): { label: string; value: string }[] {
  const canUseCrossOrganizationStorages =
    actionOptions.isPrivilegedUser && (actionOptions.scope === 'single' || actionOptions.isManagement)

  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (!storage.NetUid || isSameStorage(storage, fromStorage)) {
      return options
    }

    if (!canUseCrossOrganizationStorages && !isSameStorageOrganization(storage, fromStorage)) {
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
  const availabilityStorage = availability?.Storage || null

  if (!availabilityStorage) {
    return selectedStorage || null
  }

  if (!selectedStorage || !isSameStorage(selectedStorage, availabilityStorage)) {
    return availabilityStorage
  }

  return {
    ...selectedStorage,
    ...availabilityStorage,
    ForDefective: availabilityStorage.ForDefective ?? selectedStorage.ForDefective,
    Id: availabilityStorage.Id ?? selectedStorage.Id,
    Name: availabilityStorage.Name || selectedStorage.Name,
    NetUid: availabilityStorage.NetUid || selectedStorage.NetUid,
    Organization: availabilityStorage.Organization || selectedStorage.Organization,
    OrganizationId: availabilityStorage.OrganizationId ?? selectedStorage.OrganizationId,
  }
}

function isSameStorageOrganization(
  storage: ProductStorageStorage,
  fromStorage: ProductStorageStorage | null,
): boolean {
  const fromOrganizationKey = getStorageOrganizationKey(fromStorage)

  if (!fromOrganizationKey) {
    return true
  }

  return getStorageOrganizationKey(storage) === fromOrganizationKey
}

function getStorageOrganizationKey(storage?: ProductStorageStorage | null): string {
  if (!storage) {
    return ''
  }

  if (storage.Organization?.NetUid) {
    return storage.Organization.NetUid
  }

  const organizationId = storage.OrganizationId ?? storage.Organization?.Id

  return organizationId ? String(organizationId) : ''
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

function hasReturnConsignmentItemId(consignment: ProductStorageAvailableConsignment): boolean {
  return Boolean(consignment.ConsignmentItemId)
}

function matchesReturnConsignmentSearch(consignment: ProductStorageAvailableConsignment, normalizedSearchValue: string): boolean {
  if (!normalizedSearchValue) {
    return true
  }

  const searchableValue = normalizeReturnConsignmentSearchValue([
    formatDate(consignment.FromDate),
    consignment.ProductIncomeNumber,
    getClientName(consignment.Supplier),
    consignment.Organization?.FullName,
    consignment.Organization?.Name,
    formatAmount(consignment.RemainingQty),
  ].filter(Boolean).join(' '))

  return searchableValue.includes(normalizedSearchValue)
}

function normalizeReturnConsignmentSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA')
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
