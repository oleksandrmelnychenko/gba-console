import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Download, FileText, Plus, RefreshCw, RotateCcw, Search, SquarePen, Trash2 } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  deleteTaxFreeCarrier,
  exportTaxFreeCarriersDocument,
  getTaxFreeCarriers,
  searchTaxFreeCarriers,
} from '../api/taxFreeCarriersApi'
import { TAX_FREE_CARRIER_MANAGE_PERMISSION, TAX_FREE_CARRIER_PRINT_PERMISSION } from '../permissions'
import type { TaxFreeCarrier, TaxFreeCarrierExportColumn, TaxFreeCarrierExportDocument } from '../types'
import './tax-free-carriers-page.css'

const CARRIERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'lastName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const EXPORT_COLUMNS: TaxFreeCarrierExportColumn[] = [
  { Number: 1, TableName: 'Statham', ColumnName: 'LastName', Translate: 'Прізвище' },
  { Number: 2, TableName: 'Statham', ColumnName: 'FirstName', Translate: "Ім'я" },
  { Number: 3, TableName: 'Statham', ColumnName: 'MiddleName', Translate: 'По батькові' },
]

function useTaxFreeCarriersPageModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuth()
  const canManage = hasPermission(TAX_FREE_CARRIER_MANAGE_PERMISSION)
  const canPrint = hasPermission(TAX_FREE_CARRIER_PRINT_PERMISSION)
  const [carriers, setCarriers] = useValueState<TaxFreeCarrier[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [activeSearch, setActiveSearch] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [carrierToDelete, setCarrierToDelete] = useValueState<TaxFreeCarrier | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<TaxFreeCarrierExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const carrierIndexMap = useMemo(() => buildIndexMap(carriers), [carriers])

  useTaxFreeCarriersLoader({ activeSearch, reloadKey, setCarriers, setError, setLoading })

  const refreshSignal = (location.state as { refresh?: number } | null)?.refresh
  const lastRefreshSignal = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (refreshSignal === undefined || refreshSignal === lastRefreshSignal.current) {
      return
    }

    lastRefreshSignal.current = refreshSignal
    reload()
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, refreshSignal])

  function updateSearchDraft(value: string) {
    setSearchDraft(value)

    const nextSearch = value.trim()
    setActiveSearch(nextSearch.length >= 3 ? nextSearch : '')
  }

  function resetSearch() {
    setSearchDraft('')
    setActiveSearch('')
  }

  function openCreate() {
    navigate('/tax-free/carriers/new', { state: { backgroundLocation: location } })
  }

  function openEdit(carrier: TaxFreeCarrier) {
    if (carrier.NetUid) {
      navigate(`/tax-free/carriers/edit/${carrier.NetUid}`, { state: { backgroundLocation: location } })
    }
  }

  async function confirmDelete() {
    const netId = carrierToDelete?.NetUid

    if (!netId) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteTaxFreeCarrier(netId)
      notifications.show({ color: 'green', message: t('Перевізника видалено') })
      setCarrierToDelete(null)
      reload()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити перевізника'))
    } finally {
      setDeleting(false)
    }
  }

  function closeDownload() {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }

  async function exportDocument() {
    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    setDownloadOpened(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await exportTaxFreeCarriersDocument(EXPORT_COLUMNS)

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(exportError instanceof Error ? exportError.message : t('Документ недоступний для завантаження'))
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }

  const columns = useCarrierColumns({ canManage, carrierIndexMap, onDelete: setCarrierToDelete, onEdit: openEdit })

  return {
    canManage, canPrint, carrierToDelete, carriers, columns, downloadDocument, downloadError, downloadOpened,
    error, isDeleting, isDownloading, isLoading, searchDraft, closeDownload, confirmDelete,
    exportDocument, openCreate, openEdit, reload, resetSearch, setCarrierToDelete, updateSearchDraft,
  }
}

function useTaxFreeCarriersLoader({
  activeSearch,
  reloadKey,
  setCarriers,
  setError,
  setLoading,
}: {
  activeSearch: string
  reloadKey: number
  setCarriers: (value: TaxFreeCarrier[]) => void
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadCarriers() {
      setLoading(true)
      setError(null)

      try {
        const nextCarriers = activeSearch ? await searchTaxFreeCarriers(activeSearch) : await getTaxFreeCarriers()

        if (!cancelled) {
          setCarriers(nextCarriers)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCarriers([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перевізників'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCarriers()

    return () => {
      cancelled = true
    }
  }, [activeSearch, reloadKey, setCarriers, setError, setLoading, t])
}

export function TaxFreeCarriersPage() {
  const model = useTaxFreeCarriersPageModel()

  return (
    <Stack className="tax-free-carriers-page" gap={6}>
      <CarriersTableCard model={model} />
      <CarriersDeleteModal model={model} />
      <CarriersDownloadModal model={model} />
    </Stack>
  )
}

function CarriersTableCard({ model }: { model: ReturnType<typeof useTaxFreeCarriersPageModel> }) {
  const { t } = useI18n()
  const {
    canManage, canPrint, columns, carriers, error, exportDocument, isDownloading, isLoading,
    openCreate, openEdit, reload, resetSearch, searchDraft, updateSearchDraft,
  } = model

  return (
    <Card className="app-data-card tax-free-carriers-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar tax-free-carriers-filter-bar">
        <Group align="end" gap={10} wrap="nowrap" className="tax-free-carriers-filter-row">
          <TextInput
            size="sm"
            label={t('Пошук')}
            leftSection={<Search size={16} />}
            placeholder={t('Прізвище')}
            value={searchDraft}
            style={{ flex: '1 1 auto', minWidth: 180 }}
            onChange={(event) => updateSearchDraft(event.currentTarget.value)}
          />
          <div className="app-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути')} onClick={resetSearch}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            {canPrint && (
              <Tooltip label={t('Завантажити')}>
                <ActionIcon
                  aria-label={t('Завантажити')}
                  variant="default"
                  size={34}
                  loading={isDownloading}
                  onClick={exportDocument}
                >
                  <Download size={17} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                variant="light"
                onClick={reload}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          {canManage && (
            <div className="tax-free-carriers-create-actions">
              <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={16} />} onClick={openCreate}>
                {t('Додати')}
              </Button>
            </div>
          )}
        </Group>
      </div>

      <div className="tax-free-carriers-card__body">
        {error && (
          <Alert className="tax-free-carriers-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={carriers}
          defaultLayout={CARRIERS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Перевізників не знайдено')}
          getRowId={(carrier, index) => String(carrier.NetUid || carrier.Id || index)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="tax-free-carriers-table-1"
          loadingText={t('Завантаження перевізників')}
          minWidth={760}
          tableId="tax-free-carriers"
          onRowClick={openEdit}
        />
      </div>
    </Card>
  )
}

function CarriersDeleteModal({ model }: { model: ReturnType<typeof useTaxFreeCarriersPageModel> }) {
  const { t } = useI18n()
  const { carrierToDelete, confirmDelete, isDeleting, setCarrierToDelete } = model

  return (
    <AppModal
      centered
      opened={Boolean(carrierToDelete)}
      title={t('Ви впевнені, що хочете видалити?')}
      onClose={() => setCarrierToDelete(null)}
    >
      <Stack gap="md">
        <Text>{getCarrierName(carrierToDelete)}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isDeleting} variant="light" onClick={() => setCarrierToDelete(null)}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<Trash2 size={16} />} loading={isDeleting} onClick={confirmDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function CarriersDownloadModal({ model }: { model: ReturnType<typeof useTaxFreeCarriersPageModel> }) {
  const { t } = useI18n()
  const { closeDownload, downloadDocument, downloadError, downloadOpened, isDownloading } = model

  return (
    <AppModal centered opened={downloadOpened} title={t('Завантажити')} onClose={closeDownload}>
      <Stack gap="sm">
        {isDownloading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : downloadError ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
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
                  <FileText size={22} strokeWidth={1.8} />
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

function useCarrierColumns({
  canManage,
  carrierIndexMap,
  onDelete,
  onEdit,
}: {
  canManage: boolean
  carrierIndexMap: Map<TaxFreeCarrier, number>
  onDelete: (carrier: TaxFreeCarrier) => void
  onEdit: (carrier: TaxFreeCarrier) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<TaxFreeCarrier>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (carrier) => carrierIndexMap.get(carrier) || 0,
        cell: (carrier) => (
          <Text c="dimmed" size="sm">
            {carrierIndexMap.get(carrier) || ''}
          </Text>
        ),
      },
      {
        id: 'lastName',
        header: t('Прізвище'),
        minWidth: 180,
        accessor: (carrier) => carrier.LastName,
        cell: (carrier) => <Text fw={700}>{displayValue(carrier.LastName)}</Text>,
      },
      {
        id: 'firstName',
        header: t("Ім'я"),
        minWidth: 180,
        accessor: (carrier) => carrier.FirstName,
        cell: (carrier) => displayValue(carrier.FirstName),
      },
      {
        id: 'middleName',
        header: t('По батькові'),
        minWidth: 180,
        accessor: (carrier) => carrier.MiddleName,
        cell: (carrier) => displayValue(carrier.MiddleName),
      },
      {
        id: 'actions',
        header: '',
        width: canManage ? 96 : 58,
        minWidth: canManage ? 96 : 58,
        maxWidth: canManage ? 96 : 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (carrier) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label={t('Редагування Перевізника')}>
                <ActionIcon aria-label={t('Редагування Перевізника')} color="gray" variant="subtle" onClick={() => onEdit(carrier)}>
                  <SquarePen size={18} />
                </ActionIcon>
              </Tooltip>
              {canManage && (
                <Tooltip label={t('Видалити')}>
                  <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" onClick={() => onDelete(carrier)}>
                    <Trash2 size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Box>
        ),
      },
    ],
    [canManage, carrierIndexMap, onDelete, onEdit, t],
  )
}

function buildIndexMap(carriers: TaxFreeCarrier[]): Map<TaxFreeCarrier, number> {
  return carriers.reduce((indexMap, carrier, index) => {
    indexMap.set(carrier, index + 1)

    return indexMap
  }, new Map<TaxFreeCarrier, number>())
}

function getCarrierName(carrier: TaxFreeCarrier | null): string {
  if (!carrier) {
    return ''
  }

  return [carrier.LastName, carrier.FirstName, carrier.MiddleName].filter(Boolean).join(' ').trim()
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
