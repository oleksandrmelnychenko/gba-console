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
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
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

const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']

const RETURNS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['date', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

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
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
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
  const [saleFromDate, setSaleFromDate] = useState(() => shiftDateInput(-14))
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

  const { items, isLoading } = listState
  const offset = (page - 1) * pageSize
  const canMoveBackward = page > 1
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
  const returnsColumns = useReturnsColumns({
    exportingNetId,
    onCancel: setCancelCandidate,
    onExport: handleExport,
    onOpen: setSelectedReturn,
    t,
  })
  const saleItemColumns = useSaleItemColumns({
    drafts,
    onEdit: openEditor,
    onRemove: removeDraft,
    searchedVendorCode: saleSearch.trim(),
    t,
  })
  const detailColumns = useDetailColumns(t)

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
    setSearchValue(nextSearchValue.trim())
  }

  const loadSales = useCallback(async () => {
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
    const organizationNetId = row.sale.ClientAgreement?.Agreement?.Organization?.NetUid

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
    <Box p="lg">
      <Stack gap="md">
        <Group justify="flex-end" align="flex-start">
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
            {t('Створити')}
          </Button>
        </Group>

        {listError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title={t('Помилка')}>
            {listError}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 5 }}>
          <TextInput
            label={t('З дати')}
            type="date"
            value={fromDate}
            onChange={(event) => {
              setPage(1)
              setFromDate(event.currentTarget.value)
            }}
          />
          <TextInput
            label={t('По дату')}
            type="date"
            value={toDate}
            onChange={(event) => {
              setPage(1)
              setToDate(event.currentTarget.value)
            }}
          />
          <TextInput label={t('Пошук')} value={searchDraft} onChange={(event) => updateListSearch(event.currentTarget.value)} />
          <Select
            data={pageSizeOptions.map((option) => ({ label: option, value: option }))}
            label={t('Рядків')}
            onChange={(value) => {
              setPage(1)
              setPageSize(Number(value || PAGE_SIZE))
            }}
            value={String(pageSize)}
          />
          <Group align="flex-end">
            <ActionIcon aria-label={t('Оновити')} loading={isLoading} onClick={() => setReloadKey((value) => value + 1)} variant="light">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </SimpleGrid>

        <DataTable
          columns={returnsColumns}
          data={items}
          defaultLayout={RETURNS_TABLE_LAYOUT}
          emptyText={t('Повернення не знайдено')}
          getRowId={(item, index) => item.NetUid || String(item.Id || index)}
          isLoading={isLoading}
          minWidth={1180}
          onRowClick={setSelectedReturn}
          rowClassName={(item) => (item.IsCanceled ? 'sales-return-canceled-row' : undefined)}
          tableId="sales-returns-ukraine"
          toolbarLeft={
            <Text size="xs" c="dimmed">
              {t('Сторінка')} {page}
            </Text>
          }
          toolbarRight={
            <Group gap="xs">
              <ActionIcon aria-label={t('Попередня')} disabled={!canMoveBackward} onClick={() => setPage((value) => Math.max(1, value - 1))} variant="subtle">
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon aria-label={t('Наступна')} disabled={!canMoveForward} onClick={() => setPage((value) => value + 1)} variant="subtle">
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
          }
        />
      </Stack>

      <AppDrawer opened={Boolean(selectedReturn)} onClose={() => setSelectedReturn(null)} position="right" size="xl" title={t('Повернення')}>
        {selectedReturn ? (
          <ReturnDetails saleReturn={selectedReturn} columns={detailColumns} />
        ) : null}
      </AppDrawer>

      <AppDrawer opened={createOpened} onClose={() => setCreateOpened(false)} position="right" size="100%" title={t('Нове повернення')}>
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

      <AppModal opened={reviewOpened} onClose={() => setReviewOpened(false)} size="xl" title={t('Перегляд повернення')}>
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
                      <Text fw={600} truncate>
                        {displayValue(draft.orderItem.Product?.VendorCode)}
                      </Text>
                      <Text size="sm" c="dimmed" truncate>
                        {displayValue(draft.orderItem.Product?.Name)}
                      </Text>
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

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setReviewOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button disabled={!drafts.length} leftSection={<IconCheck size={16} />} loading={isSaving} onClick={() => void saveReturn()}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal opened={Boolean(editor)} onClose={() => setEditor(null)} size="lg" title={t('Позиція повернення')}>
        {editor ? (
          <Stack gap="md">
            <div>
              <Text fw={600}>{displayValue(editor.row.item.Product?.VendorCode)}</Text>
              <Text size="sm" c="dimmed">{displayValue(editor.row.item.Product?.Name)}</Text>
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
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setEditor(null)}>
                {t('Скасувати')}
              </Button>
              <Button onClick={saveEditorDraft}>
                {editor.draft ? t('Оновити') : t('Додати')}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </AppModal>

      <AppModal opened={downloadModalOpened} onClose={() => setDownloadModalOpened(false)} title={t('Документи')}>
        <Stack gap="sm">
          <DownloadLink icon={<IconFileTypeXls size={16} />} label={t('Excel')} url={downloadDocument?.DocumentURL || downloadDocument?.XlsxDocument} />
          <DownloadLink icon={<IconFileTypePdf size={16} />} label={t('PDF')} url={downloadDocument?.PdfDocumentURL || downloadDocument?.PdfDocument} />
        </Stack>
      </AppModal>

      <AppModal opened={Boolean(cancelCandidate)} onClose={() => setCancelCandidate(null)} title={t('Скасувати повернення')}>
        <Stack gap="md">
          <Text>{t('Скасувати повернення')} {cancelCandidate?.Number}?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCancelCandidate(null)}>
              {t('Ні')}
            </Button>
            <Button color="red" loading={isCanceling} onClick={() => void confirmCancel()}>
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Box>
  )
}

function useReturnsColumns({
  exportingNetId,
  onCancel,
  onExport,
  onOpen,
  t,
}: {
  exportingNetId: string | null
  onCancel: (saleReturn: SalesReturn) => void
  onExport: (saleReturn: SalesReturn) => void
  onOpen: (saleReturn: SalesReturn) => void
  t: (value: string) => string
}): DataTableColumn<SalesReturn>[] {
  return useMemo(
    () => [
      {
        id: 'date',
        header: t('Дата'),
        accessor: (saleReturn) => saleReturn.FromDate,
        cell: (saleReturn) => formatDateTime(saleReturn.FromDate),
        width: 160,
      },
      {
        id: 'number',
        header: t('Номер'),
        accessor: (saleReturn) => saleReturn.Number,
        cell: (saleReturn) => (
          <Group gap="xs">
            <Text fw={600}>{displayValue(saleReturn.Number)}</Text>
            {saleReturn.IsCanceled ? <Badge color="red">{t('Скасовано')}</Badge> : null}
          </Group>
        ),
        width: 190,
      },
      {
        id: 'total',
        header: t('Сума'),
        accessor: (saleReturn) => saleReturn.TotalAmountLocal,
        cell: (saleReturn) => formatMoney(saleReturn.TotalAmountLocal),
        align: 'right',
        width: 110,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        accessor: (saleReturn) => saleReturn.ClientAgreement?.Agreement?.Currency?.Code || saleReturn.Currency?.Code,
        cell: (saleReturn) => displayValue(saleReturn.ClientAgreement?.Agreement?.Currency?.Code || saleReturn.Currency?.Code),
        width: 100,
      },
      {
        id: 'regionCode',
        header: t('Код регіону'),
        accessor: (saleReturn) => saleReturn.Client?.RegionCode?.Value,
        cell: (saleReturn) => displayValue(saleReturn.Client?.RegionCode?.Value),
        width: 120,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (saleReturn) => saleReturn.Client?.FullName,
        cell: (saleReturn) => displayValue(saleReturn.Client?.FullName || saleReturn.Client?.Name),
        width: 240,
      },
      {
        id: 'organization',
        header: t('Організація'),
        accessor: (saleReturn) => saleReturn.ClientAgreement?.Agreement?.Organization?.Name,
        cell: (saleReturn) => displayValue(saleReturn.ClientAgreement?.Agreement?.Organization?.Name),
        width: 180,
      },
      {
        id: 'storage',
        header: t('Склад'),
        accessor: (saleReturn) => saleReturn.Storage?.Name,
        cell: (saleReturn) => displayValue(saleReturn.Storage?.Name),
        width: 160,
      },
      {
        id: 'agreement',
        header: t('Договір'),
        accessor: (saleReturn) => saleReturn.ClientAgreement?.Agreement?.Name,
        cell: (saleReturn) => displayValue(saleReturn.ClientAgreement?.Agreement?.Name),
        width: 180,
      },
      {
        id: 'sales',
        header: t('Продажі'),
        accessor: (saleReturn) => getSaleNumbers(saleReturn),
        cell: (saleReturn) => displayValue(getSaleNumbers(saleReturn)),
        width: 180,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        accessor: (saleReturn) => saleReturn.CreatedBy?.LastName,
        cell: (saleReturn) => displayValue(saleReturn.CreatedBy?.LastName || saleReturn.CreatedBy?.FullName),
        width: 160,
      },
      {
        id: 'actions',
        header: '',
        cell: (saleReturn) => (
          <Group gap="xs" wrap="nowrap">
            <Tooltip label={t('Переглянути')}>
              <ActionIcon aria-label={t('Переглянути')} onClick={() => onOpen(saleReturn)} variant="subtle">
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Експорт')}>
              <ActionIcon
                aria-label={t('Експорт')}
                loading={exportingNetId === saleReturn.NetUid}
                onClick={(event) => {
                  event.stopPropagation()
                  onExport(saleReturn)
                }}
                variant="subtle"
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Скасувати')}>
              <ActionIcon
                aria-label={t('Скасувати')}
                color="red"
                disabled={saleReturn.IsCanceled}
                onClick={(event) => {
                  event.stopPropagation()
                  onCancel(saleReturn)
                }}
                variant="subtle"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
        enableSorting: false,
        width: 140,
      },
    ],
    [exportingNetId, onCancel, onExport, onOpen, t],
  )
}

function useSaleItemColumns({
  drafts,
  onEdit,
  onRemove,
  searchedVendorCode,
  t,
}: {
  drafts: ReturnOrderItemDraft[]
  onEdit: (row: SaleItemRow) => void
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
        cell: (row) =>
          searchedVendorCode && row.item.Product?.VendorCode === searchedVendorCode ? (
            <Text fw={600} bg="#78ff33" px={4}>
              {displayValue(row.item.Product?.VendorCode)}
            </Text>
          ) : (
            displayValue(row.item.Product?.VendorCode)
          ),
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (row) => row.item.Product?.Name,
        cell: (row) => displayValue(row.item.Product?.Name),
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
        accessor: (row) => row.item.ReturnedQty,
        cell: (row) => formatAmount(row.item.ReturnedQty),
        align: 'right',
        width: 110,
      },
      {
        id: 'price',
        header: t('Сума'),
        accessor: (row) => row.item.TotalAmountLocal,
        cell: (row) => formatMoney(row.item.TotalAmountLocal),
        align: 'right',
        width: 120,
      },
      {
        id: 'draft',
        header: t('Повернення'),
        cell: (row) => {
          const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

          return draft ? (
            <Badge variant="light">
              {formatAmount(draft.qty)} · {getStatusLabel(draft.status, t)}
            </Badge>
          ) : '—'
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
    [drafts, onEdit, onRemove, searchedVendorCode, t],
  )
}

function useDetailColumns(t: (value: string) => string): DataTableColumn<SalesReturnItem>[] {
  return useMemo(
    () => [
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => item.OrderItem?.Product?.VendorCode,
        cell: (item) => <Text fw={600}>{displayValue(item.OrderItem?.Product?.VendorCode)}</Text>,
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.OrderItem?.Product?.Name,
        cell: (item) => displayValue(item.OrderItem?.Product?.Name),
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
        cell: (item) => formatMoney(item.AmountLocal),
        align: 'right',
        width: 120,
      },
      {
        id: 'vatAmount',
        header: t('ПДВ'),
        accessor: (item) => (item.OrderItem?.Order?.Sale?.IsVatSale ? item.VatAmountLocal : undefined),
        cell: (item) => (item.OrderItem?.Order?.Sale?.IsVatSale ? formatMoney(item.VatAmountLocal) : '—'),
        align: 'right',
        width: 120,
      },
    ],
    [t],
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
    return <Text c="dimmed">{label}: {displayValue(null)}</Text>
  }

  return (
    <Anchor href={url} target="_blank" rel="noreferrer">
      <Group gap="xs">
        {icon}
        <span>{label}</span>
      </Group>
    </Anchor>
  )
}

function DetailValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={600}>{displayValue(value)}</Text>
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
      clientName: getEntityName(client) || '—',
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
    drafts
      .map((draft) => draft.orderItem.Order?.Sale?.ClientAgreement?.Client?.NetUid)
      .filter(Boolean),
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
