import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import '../../../shared/ui/console-table-page.css'
import './new-ukraine-sale-return-page.css'
import {
  cancelSaleReturn,
  createSaleReturn,
  exportSaleReturnDocument,
  getReturnStorages,
  getReturnVatWarning,
  getSaleReturns,
  getSalesForReturn,
  getSalesReturnOrganizations,
  searchSalesReturnClients,
} from '../api/salesReturnsApi'
import type {
  ReturnOrderItemDraft,
  SalesReturn,
  SalesReturnClient,
  SalesReturnDocument,
  SalesReturnItem,
  SalesReturnItemStatusValue,
  SalesReturnOrderItem,
  SalesReturnOrganization,
  SalesReturnSale,
  SalesReturnStorage,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatDateTime,
  formatMoney,
  getEntityName,
  getStatusLabel,
  getStatusOptions,
  parseStatusValue,
  readNumber,
} from '../utils'

const SALE_ITEMS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['select', 'saleNumber', 'vendorCode'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const DETAIL_ITEMS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'product'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const RETURNS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['number', 'client'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type SaleItemRow = {
  item: SalesReturnOrderItem
  sale: SalesReturnSale
}

type ReturnsListState = {
  isLoading: boolean
  items: SalesReturn[]
}

type SalesSearchState = {
  isLoading: boolean
  sales: SalesReturnSale[]
}

type ItemEditorState = {
  draft?: ReturnOrderItemDraft
  row: SaleItemRow
}

export function NewUkraineSaleReturnPage() {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useState(() => shiftDateInput(-14))
  const [toDate, setToDate] = useState(() => shiftDateInput(0))
  const [searchDraft, setSearchDraft] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [reloadKey, setReloadKey] = useState(0)
  const [listState, setListState] = useState<ReturnsListState>({
    isLoading: false,
    items: [],
  })
  const [listError, setListError] = useState<string | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null)
  const [downloadDocument, setDownloadDocument] = useState<SalesReturnDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useState(false)
  const [exportingNetId, setExportingNetId] = useState<string | null>(null)
  const [cancelCandidate, setCancelCandidate] = useState<SalesReturn | null>(null)
  const [isCanceling, setCanceling] = useState(false)
  const [createOpened, setCreateOpened] = useState(false)
  const [organizations, setOrganizations] = useState<SalesReturnOrganization[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [clients, setClients] = useState<SalesReturnClient[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [saleSearch, setSaleSearch] = useState('')
  // Wide default so a product from an older sale is actually found ("не находить
  // товар", bug #10) — the "З дати" filter below stays editable to narrow it.
  const [saleFromDate, setSaleFromDate] = useState(() => shiftDateInput(-1825))
  const [saleToDate, setSaleToDate] = useState(() => shiftDateInput(0))
  const [salesState, setSalesState] = useState<SalesSearchState>({
    isLoading: false,
    sales: [],
  })
  const [drafts, setDrafts] = useState<ReturnOrderItemDraft[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [createWarning, setCreateWarning] = useState<string | null>(null)
  const [reviewOpened, setReviewOpened] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [editor, setEditor] = useState<ItemEditorState | null>(null)
  const [editorQty, setEditorQty] = useState<number | ''>('')
  const [editorStatus, setEditorStatus] = useState<SalesReturnItemStatusValue | undefined>()
  const [editorStorageId, setEditorStorageId] = useState<string | null>(null)
  const [editorStorages, setEditorStorages] = useState<SalesReturnStorage[]>([])
  const [editorVatWarning, setEditorVatWarning] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [isLoadingEditorStorages, setLoadingEditorStorages] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)

  const { items, isLoading } = listState
  const filteredItems = useMemo(() => filterReturns(items, searchValue), [items, searchValue])
  const offset = (page - 1) * pageSize
  const canMoveForward = items.length === pageSize
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityKey(organization) === organizationId) || null,
    [organizationId, organizations],
  )
  const selectedClient = useMemo(
    () => clients.find((client) => getEntityKey(client) === clientId) || null,
    [clientId, clients],
  )
  const selectedClientNetUid = selectedClient?.NetUid
  const selectedOrganizationNetUid = selectedOrganization?.NetUid
  const clientOptions = useMemo(() => mergeSelectedClient(clients, selectedClient), [clients, selectedClient])
  const saleItemRows = useMemo(() => flattenSaleItemRows(salesState.sales), [salesState.sales])
  const statusOptions = useMemo(() => getStatusOptions(t), [t])
  const saleItemColumns = useSaleItemColumns({
    drafts,
    onEdit: openEditor,
    onOpenProductCard: setProductCardNetId,
    onRemove: removeDraft,
    searchedVendorCode: saleSearch.trim(),
    t,
  })
  const detailColumns = useDetailColumns({ onOpenProductCard: setProductCardNetId, t })
  const returnColumns = useReturnColumns({
    exportingNetId,
    onCancel: setCancelCandidate,
    onExport: handleExport,
  })

  useEffect(() => {
    let cancelled = false

    async function loadReturns() {
      setListState((currentState) => ({
        ...currentState,
        isLoading: true,
      }))
      setListError(null)

      try {
        const nextReturns = await getSaleReturns({
          from: fromDate,
          limit: pageSize,
          offset,
          to: toDate,
          value: searchValue,
        })

        if (!cancelled) {
          setListState({
            isLoading: false,
            items: nextReturns,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setListState({
            isLoading: false,
            items: [],
          })
          setListError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити повернення'))
        }
      }
    }

    void loadReturns()

    return () => {
      cancelled = true
    }
  }, [fromDate, offset, pageSize, reloadKey, searchValue, t, toDate])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchValue(searchDraft.trim())
      // A new query re-queries from the first page — otherwise a high page
      // offset would ask the server for a page that the filtered set lacks.
      setPage(1)
    }, 200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [searchDraft])

  useEffect(() => {
    if (!createOpened) {
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      try {
        const nextOrganizations = await getSalesReturnOrganizations()

        if (!cancelled) {
          setOrganizations(nextOrganizations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCreateError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організації'))
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [createOpened, t])

  useEffect(() => {
    const normalizedSearch = clientSearch.trim()

    if (!createOpened || normalizedSearch.length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      searchSalesReturnClients(normalizedSearch, controller.signal)
        .then((nextClients) => {
          setClients(nextClients)
          setCreateError(null)
        })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setCreateError(searchError instanceof Error ? searchError.message : t('Не вдалося виконати пошук клієнта'))
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [clientSearch, createOpened, selectedClient, t])

  function updateListSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
  }

  const loadSales = useCallback(async () => {
    // The create-return modal auto-loads the recent-sales window on open (legacy behaviour) so
    // the user can browse/narrow — an earlier empty-filter guard suppressed this and left the
    // grid blank («не находить товар»).
    setSalesState((currentState) => ({
      ...currentState,
      isLoading: true,
    }))
    setCreateError(null)
    setCreateWarning(null)

    try {
      const sales = await getSalesForReturn({
        clientNetId: selectedClientNetUid,
        from: saleFromDate,
        organizationNetId: selectedOrganizationNetUid,
        to: saleToDate,
        value: saleSearch,
      })

      setSalesState({
        isLoading: false,
        sales,
      })

      if (!sales.length) {
        setCreateWarning(t('Продажі для повернення не знайдено'))
      }
    } catch (loadError) {
      setSalesState({
        isLoading: false,
        sales: [],
      })
      setCreateError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі'))
    }
  }, [saleSearch, saleFromDate, saleToDate, selectedClientNetUid, selectedOrganizationNetUid, t])

  useEffect(() => {
    if (!createOpened) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadSales()
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [createOpened, loadSales])

  async function handleExport(saleReturn: SalesReturn) {
    if (!saleReturn.NetUid) {
      return
    }

    setExportingNetId(saleReturn.NetUid)
    setListError(null)

    try {
      setDownloadDocument(await exportSaleReturnDocument(saleReturn.NetUid))
      setDownloadModalOpened(true)
    } catch (exportError) {
      setListError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExportingNetId(null)
    }
  }

  async function confirmCancel() {
    if (!cancelCandidate?.NetUid) {
      return
    }

    setCanceling(true)
    setListError(null)

    try {
      const canceledReturn = await cancelSaleReturn(cancelCandidate.NetUid)

      if (canceledReturn) {
        setListState((currentState) => ({
          ...currentState,
          items: currentState.items.map((item) => (item.NetUid === canceledReturn.NetUid ? { ...item, ...canceledReturn } : item)),
        }))
      }

      notifications.show({
        color: 'green',
        message: t('Повернення скасовано'),
      })
      setCancelCandidate(null)
    } catch (cancelError) {
      setListError(cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати повернення'))
    } finally {
      setCanceling(false)
    }
  }

  function openEditor(row: SaleItemRow) {
    const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

    setEditor({
      draft,
      row,
    })
    setEditorQty(draft?.qty || 1)
    setEditorStatus(draft?.status)
    setEditorStorageId(draft?.storage ? getEntityKey(draft.storage) : null)
    setEditorStorages(draft?.storage ? [draft.storage] : [])
    setEditorError(null)
    setEditorVatWarning(null)
    void loadEditorWarningsAndStorages(row, draft?.status)
  }

  async function loadEditorWarningsAndStorages(row: SaleItemRow, status?: SalesReturnItemStatusValue) {
    const orderItemNetId = row.item.NetUid
    // Fall back to the organization the user filtered by when the sale payload
    // omits the deeply-nested Organization.NetUid — otherwise the editor hard-
    // failed and showed no return storages at all (bug #10).
    const organizationNetId = row.sale.ClientAgreement?.Agreement?.Organization?.NetUid || selectedOrganizationNetUid

    if (!orderItemNetId || !organizationNetId) {
      setEditorError(t('Неможливо визначити продаж або організацію для складів повернення'))
      return
    }

    setLoadingEditorStorages(true)

    try {
      const [storages, vatWarning] = await Promise.all([
        getReturnStorages({
          orderItemNetId,
          organizationNetId,
          status,
        }),
        getReturnVatWarning(orderItemNetId),
      ])

      setEditorStorages(storages)
      setEditorVatWarning(vatWarning || null)
      setEditorStorageId((currentStorageId) => {
        if (currentStorageId && storages.some((storage) => getEntityKey(storage) === currentStorageId)) {
          return currentStorageId
        }

        return storages[0] ? getEntityKey(storages[0]) : null
      })
    } catch (loadError) {
      setEditorError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади повернення'))
    } finally {
      setLoadingEditorStorages(false)
    }
  }

  function saveEditorDraft() {
    if (!editor) {
      return
    }

    const storage = editorStorages.find((item) => getEntityKey(item) === editorStorageId) || null
    const validationError = validateDraft({
      item: editor.row.item,
      qty: editorQty,
      status: editorStatus,
      storage,
      t,
    })

    if (validationError) {
      setEditorError(validationError)
      return
    }

    const nextDraft: ReturnOrderItemDraft = {
      orderItem: editor.row.item,
      qty: Number(editorQty),
      status: editorStatus,
      storage,
    }

    setDrafts((currentDrafts) => [
      ...currentDrafts.filter((draft) => getOrderItemKey(draft.orderItem) !== getOrderItemKey(editor.row.item)),
      nextDraft,
    ])
    setEditor(null)
  }

  function removeDraft(row: SaleItemRow) {
    removeDraftByOrderItem(row.item)
  }

  function removeDraftByOrderItem(orderItem: SalesReturnOrderItem) {
    setDrafts((currentDrafts) => {
      const nextDrafts = currentDrafts.filter((draft) => getOrderItemKey(draft.orderItem) !== getOrderItemKey(orderItem))

      if (!nextDrafts.length) {
        setReviewOpened(false)
      }

      return nextDrafts
    })
  }

  function openReview() {
    const validationError = validateCreatePayload(drafts, t)

    if (validationError) {
      setCreateError(validationError)
      return
    }

    setReviewError(null)
    setReviewOpened(true)
  }

  async function saveReturn() {
    const validationError = validateCreatePayload(drafts, t)

    if (validationError) {
      setReviewError(validationError)
      return
    }

    const firstDraft = drafts[0]
    const client = firstDraft.orderItem.Order?.Sale?.ClientAgreement?.Client
      || salesState.sales.find((sale) => sale.Order?.OrderItems?.some((item) => getOrderItemKey(item) === getOrderItemKey(firstDraft.orderItem)))
        ?.ClientAgreement?.Client

    if (!client) {
      setReviewError(t('Неможливо визначити клієнта для повернення'))
      return
    }

    setSaving(true)
    setReviewError(null)

    try {
      await createSaleReturn({
        Client: client,
        SaleReturnItems: drafts.map((draft) => ({
          OrderItem: draft.orderItem,
          Qty: draft.qty,
          SaleReturnItemStatus: draft.status as SalesReturnItemStatusValue,
          Storage: draft.storage as SalesReturnStorage,
        })),
      })

      notifications.show({
        color: 'green',
        message: t('Повернення створено'),
      })
      setDrafts([])
      setReviewOpened(false)
      setCreateOpened(false)
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      setReviewError(saveError instanceof Error ? saveError.message : t('Не вдалося створити повернення'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="new-sale-return-page console-table-page">
      <div className="console-table-shell new-sale-return-shell">
        <div className="new-sale-return-command-bar app-filter-bar">
          <div className="new-sale-return-period-filter">
            <span className="new-sale-return-filter-label">{t('Період')}</span>
            <div className="new-sale-return-period-fields">
              <TextInput
                aria-label={t('З дати')}
                className="new-sale-return-date-input"
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setPage(1)
                  setFromDate(event.currentTarget.value)
                }}
              />
              <span className="new-sale-return-period-separator" />
              <TextInput
                aria-label={t('По дату')}
                className="new-sale-return-date-input"
                type="date"
                value={toDate}
                onChange={(event) => {
                  setPage(1)
                  setToDate(event.currentTarget.value)
                }}
              />
            </div>
          </div>

          <TextInput
            className="new-sale-return-search-input"
            label={t('Пошук')}
            leftSection={<IconSearch size={15} />}
            placeholder={t('Номер, клієнт, договір або продаж')}
            value={searchDraft}
            onChange={(event) => updateListSearch(event.currentTarget.value)}
          />

          <div className="app-filter-actions new-sale-return-command-actions">
            <Paginator
              hasNext={canMoveForward}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
              onRefresh={() => setReloadKey((value) => value + 1)}
            />
          </div>
          <div className="new-sale-return-create-actions">
            <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
              {t('Створити')}
            </Button>
          </div>
        </div>

        {listError ? (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={16} />} title={t('Помилка')}>
            {listError}
          </Alert>
        ) : null}

        <div className="new-sale-return-page__table console-table-body">
          <DataTable
            columns={returnColumns}
            data={filteredItems}
            defaultLayout={RETURNS_TABLE_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Повернення не знайдено')}
            getRowId={(saleReturn, index) => saleReturn.NetUid || String(saleReturn.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="sales-return-new-returns-1"
            minWidth={1260}
            tableId="sales-return-new-returns"
            onRowClick={setSelectedReturn}
          />
        </div>
      </div>
      <AppDrawer opened={Boolean(selectedReturn)} onClose={() => setSelectedReturn(null)} position="right" size="xl" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Повернення')}</span>}>
        {selectedReturn ? (
          <ReturnDetails saleReturn={selectedReturn} columns={detailColumns} />
        ) : null}
      </AppDrawer>

      <AppDrawer opened={createOpened} onClose={() => setCreateOpened(false)} position="right" size="100%" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Нове повернення')}</span>}>
        <Stack gap="md">
          {createError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />} title={t('Помилка')}>
              {createError}
            </Alert>
          ) : null}
          {createWarning ? (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />} title={t('Увага')}>
              {createWarning}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, md: 5 }}>
            <Select
              clearable
              data={organizations.map((organization) => ({
                label: getEntityName(organization) || t('Без назви'),
                value: getEntityKey(organization),
              }))}
              label={t('Організація')}
              onChange={setOrganizationId}
              searchable
              value={organizationId}
            />
            <Select
              clearable
              data={clientOptions.map((client) => ({
                label: [client.FullName || client.Name, client.RegionCode?.Value].filter(Boolean).join(' · '),
                value: getEntityKey(client),
              }))}
              label={t('Клієнт')}
              onChange={setClientId}
              onSearchChange={setClientSearch}
              searchable
              searchValue={clientSearch}
              value={clientId}
            />
            <TextInput label={t('Артикул')} onChange={(event) => setSaleSearch(event.currentTarget.value)} value={saleSearch} />
            <TextInput label={t('З дати')} onChange={(event) => setSaleFromDate(event.currentTarget.value)} type="date" value={saleFromDate} />
            <TextInput label={t('По дату')} onChange={(event) => setSaleToDate(event.currentTarget.value)} type="date" value={saleToDate} />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button disabled={!drafts.length} leftSection={<IconEye size={16} />} onClick={openReview}>
              {t('Перегляд')} ({drafts.length})
            </Button>
          </Group>

          <DataTable
            columns={saleItemColumns}
            data={saleItemRows}
            defaultLayout={SALE_ITEMS_TABLE_LAYOUT}
            emptyText={t('Продажі або позиції не знайдено')}
            getRowId={(row, index) => `${getOrderItemKey(row.item)}-${index}`}
            isLoading={salesState.isLoading}
            minWidth={1280}
            tableId="sales-return-new-sale-items"
          />
        </Stack>
      </AppDrawer>

      <AppDrawer
        opened={reviewOpened}
        onClose={() => setReviewOpened(false)}
        position="right"
        size="standard"
        closeOnEscape={false}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Перегляд повернення')}</span>}
        footer={
          <Group gap="sm">
            <Button variant="default" onClick={() => setReviewOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!drafts.length}
              leftSection={<IconCheck size={16} />}
              loading={isSaving}
              onClick={() => void saveReturn()}
            >
              {t('Зберегти')}
            </Button>
          </Group>
        }
      >
        <Stack gap="md">
          {reviewError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />} title={t('Помилка')}>
              {reviewError}
            </Alert>
          ) : null}

          {groupDraftsByClient(drafts).map((group) => (
            <Stack gap="xs" key={group.key}>
              <Text fw={600}>{group.clientName}</Text>
              <Stack gap="xs">
                {group.drafts.map((draft) => (
                  <Group key={getOrderItemKey(draft.orderItem)} justify="space-between" wrap="nowrap" gap="md">
                    <div style={{ minWidth: 0 }}>
                      {draft.orderItem.Product?.NetUid ? (
                        <Anchor
                          c="dark.6"
                          underline="always"
                          component="button"
                          display="block"
                          fw={600}
                          maw="100%"
                          truncate
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setProductCardNetId(draft.orderItem.Product?.NetUid || null)
                          }}
                        >
                          {displayValue(draft.orderItem.Product?.VendorCode)}
                        </Anchor>
                      ) : (
                        <Text fw={600} truncate>
                          {displayValue(draft.orderItem.Product?.VendorCode)}
                        </Text>
                      )}
                      {draft.orderItem.Product?.NetUid ? (
                        <Anchor
                          c="dark.6"
                          underline="always"
                          component="button"
                          display="block"
                          maw="100%"
                          size="sm"
                          truncate
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setProductCardNetId(draft.orderItem.Product?.NetUid || null)
                          }}
                        >
                          {displayValue(draft.orderItem.Product?.Name)}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed" truncate>
                          {displayValue(draft.orderItem.Product?.Name)}
                        </Text>
                      )}
                      <Text size="xs" c="dimmed">
                        {formatAmount(draft.qty)} · {getStatusLabel(draft.status, t)} · {displayValue(draft.storage?.Name)}
                      </Text>
                    </div>
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="red"
                        onClick={() => removeDraftByOrderItem(draft.orderItem)}
                        variant="subtle"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
            </Stack>
          ))}

        </Stack>
      </AppDrawer>

      <AppModal opened={Boolean(editor)} onClose={() => setEditor(null)} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Позиція повернення')}</span>}>
        {editor ? (
          <Stack gap="md">
            <div>
              {editor.row.item.Product?.NetUid ? (
                <Anchor
                  c="dark.6"
                  underline="always"
                  component="button"
                  fw={600}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setProductCardNetId(editor.row.item.Product?.NetUid || null)
                  }}
                >
                  {displayValue(editor.row.item.Product?.VendorCode)}
                </Anchor>
              ) : (
                <Text fw={600}>{displayValue(editor.row.item.Product?.VendorCode)}</Text>
              )}
              {editor.row.item.Product?.NetUid ? (
                <Anchor
                  c="dark.6"
                  underline="always"
                  component="button"
                  display="block"
                  size="sm"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setProductCardNetId(editor.row.item.Product?.NetUid || null)
                  }}
                >
                  {displayValue(editor.row.item.Product?.Name)}
                </Anchor>
              ) : (
                <Text size="sm" c="dimmed">{displayValue(editor.row.item.Product?.Name)}</Text>
              )}
            </div>
            {editorError ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {editorError}
              </Alert>
            ) : null}
            {editorVatWarning ? (
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                {editorVatWarning}
              </Alert>
            ) : null}
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <NumberInput
                allowDecimal
                decimalScale={3}
                label={t('Кількість')}
                max={readNumber(editor.row.item.Qty)}
                min={0}
                onChange={(value) => setEditorQty(typeof value === 'number' ? value : '')}
                value={editorQty}
              />
              <Select
                clearable
                data={statusOptions}
                label={t('Причина')}
                onChange={(value) => {
                  const nextStatus = parseStatusValue(value)

                  setEditorStatus(nextStatus)
                  void loadEditorWarningsAndStorages(editor.row, nextStatus)
                }}
                value={typeof editorStatus === 'number' ? String(editorStatus) : null}
              />
              <Select
                clearable
                data={editorStorages.map((storage) => ({
                  label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : ''].filter(Boolean).join(' '),
                  value: getEntityKey(storage),
                }))}
                disabled={isLoadingEditorStorages}
                label={t('Склад повернення')}
                onChange={setEditorStorageId}
                searchable
                value={editorStorageId}
              />
            </SimpleGrid>
            {!isLoadingEditorStorages && !editorError && editorStorages.length === 0 && (
              <Text c="dimmed" size="xs">
                {t('Немає складів, доступних для повернення за умовами цієї причини')}
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditor(null)}>
                {t('Скасувати')}
              </Button>
              <Button color={CREATE_ACTION_COLOR} onClick={saveEditorDraft}>
                {editor.draft ? t('Оновити') : t('Додати')}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </AppModal>

      <AppModal opened={downloadModalOpened} onClose={() => setDownloadModalOpened(false)} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Документи')}</span>}>
        <Stack gap="sm">
          <DownloadLink icon={<ExcelIcon size={16} />} label={t('Excel')} url={downloadDocument?.DocumentURL || downloadDocument?.XlsxDocument} />
          <DownloadLink icon={<IconFileTypePdf size={16} />} label={t('PDF')} url={downloadDocument?.PdfDocumentURL || downloadDocument?.PdfDocument} />
        </Stack>
      </AppModal>

      <AppModal opened={Boolean(cancelCandidate)} onClose={() => setCancelCandidate(null)} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Скасувати повернення')}</span>}>
        <Stack gap="md">
          <Text>{t('Скасувати повернення')} {cancelCandidate?.Number}?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCancelCandidate(null)}>
              {t('Ні')}
            </Button>
            <Button color="red" loading={isCanceling} onClick={() => void confirmCancel()}>
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Box>
  )
}

function useReturnColumns({
  exportingNetId,
  onCancel,
  onExport,
}: {
  exportingNetId: string | null
  onCancel: (saleReturn: SalesReturn) => void
  onExport: (saleReturn: SalesReturn) => void
}): DataTableColumn<SalesReturn>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SalesReturn>[]>(
    () => [
      {
        id: 'number',
        header: t('Повернення'),
        accessor: (saleReturn) => saleReturn.Number,
        cell: (saleReturn) => <ReturnDocumentCell saleReturn={saleReturn} />,
        width: 170,
        minWidth: 150,
      },
      {
        id: 'client',
        header: t('Клієнт / договір'),
        accessor: (saleReturn) => saleReturn.Client?.FullName || saleReturn.Client?.Name,
        cell: (saleReturn) => <ReturnClientCell saleReturn={saleReturn} />,
        width: 320,
        minWidth: 260,
        fill: true,
      },
      {
        id: 'organization',
        header: t('Організація / склад'),
        accessor: (saleReturn) => [
          saleReturn.ClientAgreement?.Agreement?.Organization?.Name,
          saleReturn.Storage?.Name,
        ].filter(Boolean).join(' '),
        cell: (saleReturn) => <ReturnOrganizationCell saleReturn={saleReturn} />,
        width: 260,
        minWidth: 210,
      },
      {
        id: 'sales',
        header: t('Продажі'),
        accessor: (saleReturn) => getSaleNumbers(saleReturn),
        cell: (saleReturn) => <ReturnSalesCell saleReturn={saleReturn} />,
        width: 190,
        minWidth: 150,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        accessor: (saleReturn) => getReturnUserName(saleReturn.CreatedBy),
        cell: (saleReturn) => <ReturnResponsibleCell saleReturn={saleReturn} />,
        width: 210,
        minWidth: 170,
      },
      {
        id: 'total',
        header: t('Сума'),
        accessor: (saleReturn) => readNumber(saleReturn.TotalAmountLocal) ?? 0,
        align: 'right',
        cell: (saleReturn) => <ReturnAmountCell saleReturn={saleReturn} />,
        width: 130,
        minWidth: 110,
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        cell: (saleReturn) => (
          <ReturnActionsCell
            exportingNetId={exportingNetId}
            saleReturn={saleReturn}
            onCancel={onCancel}
            onExport={onExport}
          />
        ),
        enableSorting: false,
        width: 86,
        minWidth: 78,
      },
    ],
    [exportingNetId, onCancel, onExport, t],
  )
}

function ReturnActionsCell({
  exportingNetId,
  saleReturn,
  onCancel,
  onExport,
}: {
  exportingNetId: string | null
  saleReturn: SalesReturn
  onCancel: (saleReturn: SalesReturn) => void
  onExport: (saleReturn: SalesReturn) => void
}) {
  const { t } = useI18n()

  return (
    <div className="new-sale-return-actions-cell">
      <Tooltip label={t('Експорт')}>
        <ActionIcon
          aria-label={t('Експорт')}
          color="gray"
          loading={exportingNetId === saleReturn.NetUid}
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            onExport(saleReturn)
          }}
        >
          <IconDownload size={15} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Скасувати')}>
        <ActionIcon
          aria-label={t('Скасувати')}
          color="gray"
          disabled={saleReturn.IsCanceled}
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            onCancel(saleReturn)
          }}
        >
          <IconTrash size={15} />
        </ActionIcon>
      </Tooltip>
    </div>
  )
}

function ReturnDocumentCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const { t } = useI18n()
  const number = displayValue(saleReturn.Number)
  const date = formatDateTime(saleReturn.FromDate)

  return (
    <div className="new-sale-return-document-cell">
      <span className="new-sale-return-document-copy">
        <span className="new-sale-return-title-line">
          <span className="new-sale-return-document-number" title={number}>{number}</span>
          {saleReturn.IsCanceled ? <span className="app-role-pill is-red new-sale-return-canceled-tag">{t('Скасовано')}</span> : null}
        </span>
        <span className="new-sale-return-muted-line is-mono" title={date}>{date}</span>
      </span>
    </div>
  )
}

function ReturnClientCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const client = displayValue(saleReturn.Client?.FullName || saleReturn.Client?.Name)
  const agreement = displayValue(saleReturn.ClientAgreement?.Agreement?.Name)
  const region = displayValue(saleReturn.Client?.RegionCode?.Value)

  return (
    <div className="new-sale-return-client-cell">
      <span className="app-role-pill is-gray new-sale-return-region-tag">{region}</span>
      <span className="new-sale-return-two-line">
        <span className="new-sale-return-main-line" title={client}>{client}</span>
        <span className="new-sale-return-muted-line" title={agreement}>{agreement}</span>
      </span>
    </div>
  )
}

function ReturnOrganizationCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const organization = displayValue(saleReturn.ClientAgreement?.Agreement?.Organization?.Name)
  const storage = displayValue(saleReturn.Storage?.Name)

  return <ReturnTwoLineValue primary={organization} secondary={storage} />
}

function ReturnSalesCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const sales = getSaleNumbers(saleReturn).trim()
  const saleNumbers = sales.split(/\s+/).filter(Boolean)

  return (
    <span className="new-sale-return-sales-cell" title={sales}>
      {saleNumbers.length ? (
        <span className="new-sale-return-sales-pills">
          {saleNumbers.map((number) => (
            <span className="app-role-pill is-gray new-sale-return-sale-pill" key={number}>
              {number}
            </span>
          ))}
        </span>
      ) : (
        <span className="new-sale-return-muted-inline" />
      )}
    </span>
  )
}

function ReturnResponsibleCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const userName = getReturnUserName(saleReturn.CreatedBy)
  const [lastName, givenName] = splitReturnProfileName(userName)

  return (
    <div className="new-sale-return-responsible-cell">
      <span className="new-sale-return-two-line">
        <span className="new-sale-return-main-line" title={userName}>{lastName}</span>
        <span className="new-sale-return-muted-line" title={userName}>{givenName}</span>
      </span>
    </div>
  )
}

function ReturnAmountCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const currency = displayValue(saleReturn.ClientAgreement?.Agreement?.Currency?.Code || saleReturn.Currency?.Code)

  return (
    <span className="new-sale-return-amount-cell">
      <strong className="app-money">{formatMoney(saleReturn.TotalAmountLocal)}</strong>
      <small className="app-money-meta">{currency}</small>
    </span>
  )
}

function ReturnTwoLineValue({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <span className="new-sale-return-two-line">
      <span className="new-sale-return-main-line" title={primary}>{primary}</span>
      <span className="new-sale-return-muted-line" title={secondary}>{secondary}</span>
    </span>
  )
}

function filterReturns(rows: SalesReturn[], value: string): SalesReturn[] {
  const query = value.trim().toLowerCase()

  if (!query) {
    return rows
  }

  return rows.filter((saleReturn) => {
    const haystack = [
      saleReturn.Number,
      saleReturn.Client?.FullName,
      saleReturn.Client?.Name,
      saleReturn.ClientAgreement?.Agreement?.Name,
      saleReturn.ClientAgreement?.Agreement?.Organization?.Name,
      getReturnUserName(saleReturn.CreatedBy),
      getSaleNumbers(saleReturn),
      saleReturn.Storage?.Name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

function getReturnUserName(user?: SalesReturn['CreatedBy']): string {
  return user?.FullName?.trim() || [user?.LastName, user?.Name].filter(Boolean).join(' ').trim()
}

function splitReturnProfileName(value: string): [string, string] {
  const normalized = value.trim()

  if (!normalized) {
    return ['', '']
  }

  const [firstPart, ...rest] = normalized.split(/\s+/)

  return [firstPart || normalized, rest.join(' ')]
}

function useSaleItemColumns({
  drafts,
  onEdit,
  onOpenProductCard,
  onRemove,
  searchedVendorCode,
  t,
}: {
  drafts: ReturnOrderItemDraft[]
  onEdit: (row: SaleItemRow) => void
  onOpenProductCard: (netId: string) => void
  onRemove: (row: SaleItemRow) => void
  searchedVendorCode: string
  t: (value: string) => string
}): DataTableColumn<SaleItemRow>[] {
  return useMemo(
    () => [
      {
        id: 'select',
        header: '',
        cell: (row) => {
          const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

          return (
            <Checkbox
              aria-label={t('Обрати позицію')}
              checked={Boolean(draft)}
              onChange={() => (draft ? onRemove(row) : onEdit(row))}
            />
          )
        },
        enableSorting: false,
        width: 70,
      },
      {
        id: 'saleNumber',
        header: t('Продаж'),
        accessor: (row) => row.sale.SaleNumber?.Value,
        cell: (row) => <Text fw={600}>{displayValue(row.sale.SaleNumber?.Value)}</Text>,
        width: 150,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (row) => row.item.Product?.VendorCode,
        cell: (row) => {
          const netId = row.item.Product?.NetUid
          const isHighlighted = Boolean(searchedVendorCode && row.item.Product?.VendorCode === searchedVendorCode)

          if (!netId) {
            return isHighlighted ? (
              <Text fw={600} bg="#78ff33" px={4}>
                {displayValue(row.item.Product?.VendorCode)}
              </Text>
            ) : (
              displayValue(row.item.Product?.VendorCode)
            )
          }

          return (
            <Anchor
              bg={isHighlighted ? '#78ff33' : undefined}
              c="dark.6"
              underline="always"
              component="button"
              fw={600}
              px={isHighlighted ? 4 : undefined}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {displayValue(row.item.Product?.VendorCode)}
            </Anchor>
          )
        },
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (row) => row.item.Product?.Name,
        cell: (row) => {
          const netId = row.item.Product?.NetUid

          return netId ? (
            <Anchor
              c="dark.6"
              underline="always"
              component="button"
              size="sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {displayValue(row.item.Product?.Name)}
            </Anchor>
          ) : (
            displayValue(row.item.Product?.Name)
          )
        },
        width: 260,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (row) => row.sale.ClientAgreement?.Client?.FullName,
        cell: (row) => displayValue(row.sale.ClientAgreement?.Client?.FullName),
        width: 220,
      },
      {
        id: 'soldQty',
        header: t('К-сть'),
        accessor: (row) => row.item.Qty,
        cell: (row) => formatAmount(row.item.Qty),
        align: 'right',
        width: 100,
      },
      {
        id: 'returnedQty',
        header: t('Повернено'),
        accessor: (row) => row.item.ReturnItemQty,
        cell: (row) => formatAmount(row.item.ReturnItemQty),
        align: 'right',
        width: 110,
      },
      {
        id: 'price',
        header: t('Сума'),
        accessor: (row) => row.item.TotalAmountLocal,
        cell: (row) => <span className="app-money">{formatMoney(row.item.TotalAmountLocal)}</span>,
        align: 'right',
        width: 120,
      },
      {
        id: 'draft',
        header: t('Повернення'),
        cell: (row) => {
          const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

          return draft ? (
            <Badge className="app-role-pill" variant="light">
              {formatAmount(draft.qty)} · {getStatusLabel(draft.status, t)}
            </Badge>
          ) : ''
        },
        width: 240,
      },
      {
        id: 'actions',
        header: '',
        cell: (row) => (
          <Group gap="xs" wrap="nowrap">
            <Button size="xs" variant="light" onClick={() => onEdit(row)}>
              {drafts.some((draft) => getOrderItemKey(draft.orderItem) === getOrderItemKey(row.item)) ? t('Змінити') : t('Додати')}
            </Button>
          </Group>
        ),
        enableSorting: false,
        width: 110,
      },
    ],
    [drafts, onEdit, onOpenProductCard, onRemove, searchedVendorCode, t],
  )
}

function useDetailColumns({
  onOpenProductCard,
  t,
}: {
  onOpenProductCard: (netId: string) => void
  t: (value: string) => string
}): DataTableColumn<SalesReturnItem>[] {
  return useMemo(
    () => [
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => item.OrderItem?.Product?.VendorCode,
        cell: (item) => {
          const netId = item.OrderItem?.Product?.NetUid

          return netId ? (
            <Anchor
              c="dark.6"
              underline="always"
              component="button"
              fw={600}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {displayValue(item.OrderItem?.Product?.VendorCode)}
            </Anchor>
          ) : (
            <Text fw={600}>{displayValue(item.OrderItem?.Product?.VendorCode)}</Text>
          )
        },
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.OrderItem?.Product?.Name,
        cell: (item) => {
          const netId = item.OrderItem?.Product?.NetUid

          return netId ? (
            <Anchor
              c="dark.6"
              underline="always"
              component="button"
              size="sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {displayValue(item.OrderItem?.Product?.Name)}
            </Anchor>
          ) : (
            displayValue(item.OrderItem?.Product?.Name)
          )
        },
        width: 260,
      },
      {
        id: 'qty',
        header: t('Кількість'),
        accessor: (item) => item.Qty,
        cell: (item) => formatAmount(item.Qty),
        align: 'right',
        width: 110,
      },
      {
        id: 'status',
        header: t('Причина'),
        accessor: (item) => getStatusLabel(item.SaleReturnItemStatus, t),
        cell: (item) => getStatusLabel(item.SaleReturnItemStatus, t),
        width: 220,
      },
      {
        id: 'storage',
        header: t('Склад'),
        accessor: (item) => item.Storage?.Name,
        cell: (item) => displayValue(item.Storage?.Name),
        width: 180,
      },
      {
        id: 'amount',
        header: t('Сума'),
        accessor: (item) => item.AmountLocal,
        cell: (item) => <span className="app-money">{formatMoney(item.AmountLocal)}</span>,
        align: 'right',
        width: 120,
      },
      {
        id: 'vatAmount',
        header: t('ПДВ'),
        accessor: (item) => (item.OrderItem?.Order?.Sale?.IsVatSale ? item.VatAmountLocal : undefined),
        cell: (item) => (item.OrderItem?.Order?.Sale?.IsVatSale ? <span className="app-money">{formatMoney(item.VatAmountLocal)}</span> : ''),
        align: 'right',
        width: 120,
      },
    ],
    [onOpenProductCard, t],
  )
}

function ReturnDetails({
  columns,
  saleReturn,
}: {
  columns: DataTableColumn<SalesReturnItem>[]
  saleReturn: SalesReturn
}) {
  const { t } = useI18n()
  const items = saleReturn.SaleReturnItems || []

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <DetailValue label={t('Номер')} value={saleReturn.Number} />
        <DetailValue label={t('Дата')} value={formatDateTime(saleReturn.FromDate)} />
        <DetailValue label={t('Клієнт')} value={saleReturn.Client?.FullName || saleReturn.Client?.Name} />
        <DetailValue label={t('Договір')} value={saleReturn.ClientAgreement?.Agreement?.Name} />
        <DetailValue label={t('Організація')} value={saleReturn.ClientAgreement?.Agreement?.Organization?.Name} />
        <DetailValue label={t('Склад')} value={saleReturn.Storage?.Name} />
        <DetailValue label={t('Сума')} value={formatMoney(saleReturn.TotalAmountLocal)} />
        <DetailValue label={t('Статус')} value={saleReturn.IsCanceled ? t('Скасовано') : t('Активне')} />
      </SimpleGrid>
      <DataTable
        columns={columns}
        data={items}
        defaultLayout={DETAIL_ITEMS_TABLE_LAYOUT}
        emptyText={t('Позиції не знайдено')}
        getRowId={(item, index) => item.NetUid || String(item.Id || index)}
        minWidth={900}
        tableId="sales-return-detail-items"
      />
    </Stack>
  )
}

function DownloadLink({
  icon,
  label,
  url,
}: {
  icon: ReactNode
  label: string
  url?: string
}) {
  if (!url) {
    return <Text c="dimmed">{label}</Text>
  }

  return (
    <Anchor c="dark.6" href={url} rel="noreferrer" target="_blank" underline="always">
      <Group gap="xs">
        {icon}
        <span>{label}</span>
      </Group>
    </Anchor>
  )
}

function DetailValue({ label, value }: { label: string; value: unknown }) {
  const text = displayValue(value)

  return (
    <div className="new-sale-return-detail-field">
      <span>{label}</span>
      <strong>{text}</strong>
    </div>
  )
}

function flattenSaleItemRows(sales: SalesReturnSale[]): SaleItemRow[] {
  return sales.flatMap((sale) =>
    (sale.Order?.OrderItems || []).map((item) => ({
      item: {
        ...item,
        Order: {
          ...item.Order,
          Sale: sale,
        },
      },
      sale,
    })),
  )
}

function groupDraftsByClient(drafts: ReturnOrderItemDraft[]): Array<{
  key: string
  clientName: string
  drafts: ReturnOrderItemDraft[]
}> {
  const groups: Array<{ key: string; clientName: string; drafts: ReturnOrderItemDraft[] }> = []

  drafts.forEach((draft) => {
    const client = draft.orderItem.Order?.Sale?.ClientAgreement?.Client
    const key = client ? getEntityKey(client) : ''
    const existing = groups.find((group) => group.key === key)

    if (existing) {
      existing.drafts.push(draft)
      return
    }

    groups.push({
      clientName: getEntityName(client),
      drafts: [draft],
      key,
    })
  })

  return groups
}

function validateDraft({
  item,
  qty,
  status,
  storage,
  t,
}: {
  item: SalesReturnOrderItem
  qty: number | ''
  status?: SalesReturnItemStatusValue
  storage: SalesReturnStorage | null
  t: (value: string) => string
}) {
  const numericQty = typeof qty === 'number' ? qty : 0
  const availableQty = readNumber(item.Qty)

  if (!Number.isFinite(numericQty) || numericQty <= 0) {
    return t('Кількість повернення має бути більшою за нуль')
  }

  if (typeof availableQty === 'number' && numericQty > availableQty) {
    return t('Кількість повернення не може перевищувати кількість у продажу')
  }

  if (typeof status !== 'number') {
    return t('Оберіть причину повернення')
  }

  if (!storage?.Id) {
    return t('Оберіть склад повернення')
  }

  return null
}

function validateCreatePayload(drafts: ReturnOrderItemDraft[], t: (value: string) => string): string | null {
  if (!drafts.length) {
    return t('Оберіть хоча б одну позицію для повернення')
  }

  const clientNetIds = new Set(
    drafts.flatMap((draft) => {
      const netUid = draft.orderItem.Order?.Sale?.ClientAgreement?.Client?.NetUid
      return netUid ? [netUid] : []
    }),
  )

  if (clientNetIds.size > 1) {
    return t('Повернення можна створити лише для одного клієнта')
  }

  const invalidDraft = drafts.find((draft) => !draft.storage?.Id || typeof draft.status !== 'number' || draft.qty <= 0)

  if (invalidDraft) {
    return t('Перевірте кількість, причину та склад у вибраних позиціях')
  }

  return null
}

function getSaleNumbers(saleReturn: SalesReturn): string {
  const numbers = new Set<string>()

  ;(saleReturn.SaleReturnItems || []).forEach((item) => {
    const saleNumber = item.OrderItem?.Order?.Sale?.SaleNumber?.Value

    if (saleNumber) {
      numbers.add(saleNumber)
    }
  })

  return [...numbers].join(' ')
}

function getOrderItemKey(item: SalesReturnOrderItem): string {
  return item.NetUid || String(item.Id || '')
}

function getEntityKey(entity: { Id?: number; NetUid?: string }): string {
  return entity.NetUid || String(entity.Id || '')
}

function mergeSelectedClient(clients: SalesReturnClient[], selectedClient: SalesReturnClient | null): SalesReturnClient[] {
  if (!selectedClient || clients.some((client) => getEntityKey(client) === getEntityKey(selectedClient))) {
    return clients
  }

  return [selectedClient, ...clients]
}

function shiftDateInput(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}
